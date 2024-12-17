/**
*
* Usage:
*   node scripts/update-property-by-csv.js --csv CSV --propertyName PROP [--limit L] [--offset O]
*
*   Where:
*     - CSV {string} - A path to a local CSV containing id, nyplSource,
*                      & propertyValue columns (strictly, in that order)
*     - PROP {string} - The name of the property to update
**/
const fs = require('fs')
const csv = require('csv')
const csvParser = require('csv-parser')
const { parseArgs } = require('node:util')
const dotenv = require('dotenv')

const { client: makeEsClient } = require('../lib/elastic-search/client')
const logger = require('../lib/logger')
const NyplSourceMapper = require('../lib/utils/nypl-source-mapper')
const {
  awsCredentialsFromIni,
  castArgsToInts,
  delay,
  die,
  lineCount,
  printProgress,
  retry
} = require('./utils')
const { setCredentials: kmsSetCredentials } = require('../lib/kms')

/**
* Parse script arguments from process.argv:
**/
const parseArguments = () => {
  const argv = parseArgs({
    allowNegative: true,
    options: {
      csv: { type: 'string' },
      propertyName: { type: 'string' },
      envfile: {
        type: 'string',
        default: './config/qa.env'
      },
      batchSize: {
        type: 'string',
        default: '100'
      },
      dryrun: {
        type: 'boolean',
        default: false
      },
      haltOn404: {
        type: 'boolean',
        default: false
      },
      headers: {
        type: 'boolean',
        default: true
      },
      limit: {
        type: 'string',
        default: ''
      },
      offset: {
        type: 'string',
        default: '0'
      },
      verbose: {
        type: 'boolean',
        default: false
      }
    }
  })

  castArgsToInts(argv, ['batchSize', 'limit', 'offset'])

  return argv.values
}

const usage = () => {
  console.log('Usage: node scripts/update-property-by-csv.js --csv CSV --propertyName NAME [--limit L] [--offset O]')
  return true
}

// Ensure we're looking at the right profile
const awsCreds = awsCredentialsFromIni()
kmsSetCredentials(awsCreds)

let processedCount = 0

let currentBatch = []

/**
* Build a stream transform for batching stream by specified `size`
* (and not to exceed `total`)
**/
const batchAndLimitTransform = (size, total) => {
  let batchedTotal = 0
  return csv.transform({ parallel: 1 }, (record, done) => {
    // Handle total (which may be set by --limit):
    // If total that we've batched equals total, return early
    if (total && batchedTotal === total) {
      done(null, null)
      return
    }

    currentBatch.push(record)
    batchedTotal += 1

    if (currentBatch.length === size || batchedTotal === total) {
      const batch = currentBatch
      currentBatch = []

      done(null, batch)
    } else {
      // Seems to strip it from the stream:
      done(null, null)
    }
  })
}

/**
* Given a ES _bulk response, analyzes the response for errors. Returns an object that defines:
*  - errored {object[]} - Array of objects representing non-404 errors, one per document
*  - missing {object[]} - Array of objects representing 404 errors, one per document
**/
const parseErroredDocuments = (bulkResponse, operations) => {
  // The items array has the same order of the dataset we just indexed.
  // The presence of the `error` key indicates that the operation
  // that we did for the document has failed.
  return bulkResponse.items
    .map((action, i) => {
      const operation = Object.keys(action)[0]
      const error = action[operation].error
      if (!error) return null
      return {
        // If the status is 429 it means that you can retry the document,
        // otherwise it's very likely a mapping error, and you should
        // fix the document before to try it again.
        status: action[operation].status,
        error: action[operation].error,
        operation: operations[i * 2],
        document: operations[i * 2 + 1]
      }
    })
    .filter((error) => error)
    .reduce((categories, error) => {
      if (error.status === 404) categories.missing.push(error)
      else categories.errored.push(error)
      return categories
    }, { errored: [], missing: [] })
}

/**
* Given an array of CSV rows, builds an array of ES _bulk operations
*
* @param {Object[]} rows - Array of CSV rows
**/
const buildEsBulkOperations = async (rows, propertyName) => {
  const nyplSourceMapper = await NyplSourceMapper.instance()

  const updatePairs = rows
    .map((row) => {
      const [id, nyplSource, propertyValue] = Object.values(row)
      return { id, nyplSource, propertyValue }
    })
    // Strip empty values:
    .filter(({ propertyValue }) => propertyValue.trim())
    .map(({ id, nyplSource, propertyValue }) => {
      const prefix = nyplSourceMapper.prefix(nyplSource, 'bib')
      const uri = `${prefix}${id}`
      return [
        { update: { _index: process.env.ELASTIC_RESOURCES_INDEX_NAME, _id: uri } },
        { doc: { [propertyName]: propertyValue } }
      ]
    })
  return updatePairs.flat()
}

/**
* Given an array of ES _bulk operations, commits the operations, parses the
* response, and rejects if any non-skippable errors encountered.
*
* @param {Object[]} operations - Array of ES _bulk operations
**/
const postEsBulkOperations = async (operations, options) => {
  if (options.verbose) {
    console.log('Posting: ', operations)
  }
  // ES-Client-Upgrade-Note: Note that 'body' is named 'operations' in v8 client:
  const bulkResponse = await esClient.bulk({ refresh: false, body: operations })

  let missingCount = 0
  // ES-Client-Upgrade-Note: Note that 'body' is probably dropped in v8 client:
  if (bulkResponse.body.errors) {
    const { errored, missing } = parseErroredDocuments(bulkResponse.body, operations)
    if (errored.length) {
      console.log('Error updating some documents:', errored)
      throw new Error('Error updating some documents')
    }
    if (options.haltOn404 && missing.length) {
      console.log('Encountered 404 updating some documents:', missing)
      throw new Error('Error updating some documents')
    }
    missingCount = missing.length
  }

  const docsSummary = bulkResponse.body.items
    .map((i) => i.update._id)
    .slice(0, 3)
    .join(', ') + ', ...'
  const missingSummary = missingCount ? ` (${missingCount} missing)` : ''
  console.log(`Bulk updated ${bulkResponse.body.items.length} documents (${docsSummary})${missingSummary}`)
}

/**
* Process a single CSV batch.
* @param {Object[]} rows - Array of CSV rows
**/
const processBatch = (options) => {
  return csv.transform(null, async (rows, done) => {
    const operations = await buildEsBulkOperations(rows, options.propertyName)

    if (options.dryrun) {
      console.log('[Dryrun] Would post: ', operations)
      await delay(1000)
    } else {
      const bulkCall = () => postEsBulkOperations(operations, options)
      await bulkCall()
        // Retry 3 times with back-off:
        .catch(retry(bulkCall, 3))
      await delay(200)
    }

    processedCount += rows.length
    done(null, rows)
  })
}

let esClient

/**
* Process a CSV. Accepts options:
* - csv {string} - Path to csv
* - offset {int} - Starting index
* - limit {int} - Max number of rows to process
* - batchSize {int} - Number of records to process/save at a time.
**/
const processCsv = async (options) => {
  esClient = await makeEsClient()

  const startTime = new Date()
  const total = options.limit || await lineCount(options.csv) - options.offset

  const csvOptions = {
    // Does CSV have headers to skip over?
    headers: options.headers,
    // Skip over header line:
    skipLines: options.headers ? 1 : 0
  }
  // Start at a specific CSV offset?
  if (options.offset) {
    csvOptions.skipLines += options.offset
  }
  console.log({ csvOptions })
  const readStream = fs.createReadStream(options.csv)
    .pipe(csvParser(csvOptions))

  readStream
    .pipe(batchAndLimitTransform(options.batchSize, total))
    .pipe(processBatch(options))
    .on('data', (data) => {
      printProgress(processedCount, total, options.batchSize, startTime)

      if (options.limit && processedCount >= options.limit) {
        console.log('Closing stream early.')
        readStream.destroy()
      }
    })
    .on('end', () => {
      console.log('Done')
    })
}

// Only parse arguments and execute if invoked via cmdline:
const isCalledViaCommandLine = /scripts\/update-property-by-csv(.js)?/.test(fs.realpathSync(process.argv[1]))
if (isCalledViaCommandLine) {
  const args = parseArguments()

  if (!args.envfile) usage() && die('--envfile required')
  dotenv.config({ path: args.envfile })
  logger.setLevel(process.env.LOG_LEVEL || 'info')

  if (args.csv && args.propertyName) {
    processCsv(args)
  } else usage()
}

// Export for unit tests:
module.exports = {
  parseErroredDocuments,
  buildEsBulkOperations
}
