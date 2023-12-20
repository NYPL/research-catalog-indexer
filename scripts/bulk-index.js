/**
 *  Bulk Index
 *
 *  This script allows you to index lots of records in bulk based on an
 *  arbitrary Bib- or ItemService SQL query.
 *
 *  Usage:
 *    node scripts/bulk-index --type (item|bib) [--hasMarc MARC] [--nyplSource NYPLSOURCE]
 *
 *  Arguments:
 *    type {string}: Required. One of item or bib
 *    hasMarc {string}: Marc tag that must be present in the record
 *    nyplSource {string}: NYPL Source value. Default 'sierra-nypl'
 *    orderBy {string}: Columns to order query by. Default '' (no sort).
 *      e.g. `--orderBy id`. Sortable columns include `id`, `updated_date`,
 *      `created_date`.
 *    limit {int}: How many records to process. Default null (no limit)
 *    offset {int}: How many records to skip over. Default 0
 *    batchSize {int}: How many records to index at one time. Default 100
 *    dryrun {boolean}: Set to true to perform all work, but skip writing to index.
 *    envfile {string}: Path to local .env file. Default ./config/qa-bulk-index.env
 *
 *  One of these mutually exclusive arguments must be used so that the script
 *  has something to query on:
 *   - hasMarc
 *   - bibId
 *
 *  Note that omitting --limit may cause the query to take a long time to
 *  return due to the size of the databases.
 *
 *  Using --orderBy may slow down the query, but will ensure you can resume
 *  when a job fails by setting --offset to the index of the last successful
 *  batch. (Otherwise, results are processed in an unstable order between jobs.)
 *
 *  Examples
 *
 *  To reindex all NYPL bibs with marc 001 in QA:
 *    node scripts/bulk-index --type bib --hasMarc 001
 *
 *
 */
const { Pool } = require('pg')
const Cursor = require('pg-cursor')

const kms = require('../lib/kms.js')
const modelPrefetcher = require('../lib/model-prefetch')
const { processRecords } = require('../index')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('../lib/prefilter')

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    limit: null,
    offset: 0,
    batchSize: 100,
    nyplSource: 'sierra-nypl',
    dryrun: false,
    envfile: './config/qa-bulk-index.env'
  },
  string: ['hasMarc', 'bibId'],
  integer: ['limit', 'offset', 'batchSize']
})
const dotenv = require('dotenv')
dotenv.config({ path: argv.envfile })

const { awsInit, die, camelize } = require('./utils')
const logger = require('../lib/logger')
logger.setLevel(process.env.LOG_LEVEL || 'info')

const usage = () => {
  console.log('Usage: node scripts/bulk-index --type (bib|item) [--hasMarc MARC] [--bibId BIBID]')
  return true
}

// Ensure we're looking at the right profile and region
awsInit()

/**
 *  Given a db name (ITEM, BIB, HOLDINGS), decrypts related config and returns
 *  a db Pool instance
 */
const initPool = async (prefix) => {
  const [user, password, host] = await Promise.all([
    kms.decrypt(process.env[`${prefix}_SERVICE_DB_USER`]),
    kms.decrypt(process.env[`${prefix}_SERVICE_DB_PW`]),
    kms.decrypt(process.env[`${prefix}_SERVICE_DB_HOST`])
  ])
  const config = {
    user,
    host,
    database: process.env[`${prefix}_SERVICE_DB_NAME`],
    password
  }
  return new Pool(config)
}

let dbConnectionPools = null

/**
 *  Initialize all db connection pools
 */
const initPools = async () => {
  dbConnectionPools = {
    itemService: await initPool('ITEM'),
    bibService: await initPool('BIB'),
    holdingsService: await initPool('HOLDINGS')
  }
}

/**
 *  Sever connections will all db connection pools
 */
const endPools = () => {
  Object.entries(dbConnectionPools)
    .forEach(([name, pool]) => {
      console.log(`Stopping ${name} pool`)
      pool.end()
    })
}

/**
 *  Perform transformations on a db result so that it resembles the object
 *  returned from the Bib/Item services
 */
const convertCommonModelProperties = (models) => {
  return models.map((model) => {
    // camelize all root level property names:
    Object.keys(model)
      .forEach((k) => {
        if (/_/.test(k)) {
          const newProperty = camelize(k)
          model[newProperty] = model[k]
          delete model[k]
        }
      })
    return model
  })
}

/**
 *  Given an array of bib ids, returns a hash relating each of those bib ids to
 *  an array of items for that bib
 */
const sierraItemsByBibIds = async (bibIds) => {
  const itemClient = await dbConnectionPools.itemService.connect()

  const query = `SELECT * FROM item
    WHERE nypl_source = 'sierra-nypl'
    AND bib_ids ?| array[${bibIds.map((id) => `'${id}'`).join(',')}]`
  const result = await itemClient.query(query)

  const items = convertCommonModelProperties(result.rows)

  const itemsByBibId = items.reduce((byBibId, item) => {
    item.bibIds.forEach((bibId) => {
      if (!byBibId[bibId]) {
        byBibId[bibId] = []
      }
      byBibId[bibId].push(item)
    })
    return byBibId
  }, {})

  itemClient.release()

  logger.debug(`ItemService DB: Retrieved ${items.length} item(s) for ${bibIds.length} bib id(s) using query ${query}`)

  return itemsByBibId
}

/**
 *  Given an array of bib ids, returns a hash relating each of those bib ids to
 *  an array of holdings for that bib
 */
const sierraHoldingsByBibIds = async (bibIds) => {
  const holdingsClient = await dbConnectionPools.holdingsService.connect()

  const query = `SELECT * FROM records
    WHERE "bibIds" && array[${bibIds.join(',')}]`
  const result = await holdingsClient.query(query)

  const holdings = convertCommonModelProperties(result.rows)

  const holdingsByBibId = holdings.reduce((byBibId, item) => {
    item.bibIds.forEach((bibId) => {
      if (!byBibId[bibId]) {
        byBibId[bibId] = []
      }
      byBibId[bibId].push(item)
    })
    return byBibId
  }, {})

  logger.debug(`HoldinsgService DB: Retrieved ${holdings.length} holdings(s) for ${bibIds.length} bib id(s) using query ${query}`)

  holdingsClient.release()

  return holdingsByBibId
}

/**
 *  Here we're overwriting the application modelPrefetch routine to prefetch
 *  items and holdings by direct sql connection to the Item- and
 *  HoldingsService databases
 */
modelPrefetcher.modelPrefetch = async (bibs) => {
  if (bibs.length === 0) return bibs

  // Get distinct bib ids:
  const bibIds = Array.from(new Set(bibs.map((b) => b.id)))

  // Fetch all items and holdings for this set of bibs:
  const [itemsByBibId, holdingsByBibId] = await Promise.all([
    sierraItemsByBibIds(bibIds),
    sierraHoldingsByBibIds(bibIds)
  ])

  // Attach holdings and items to bibs:
  bibs = bibs.map((bib) => {
    // Wrap in SierraHolding class and apply suppression:
    bib._holdings = filteredSierraHoldingsForHoldings(holdingsByBibId[bib.id] || [])
    // Apply suppression/is-research filtering to items:
    bib._items = filteredSierraItemsForItems(itemsByBibId[bib.id]) || []
    return bib
  })

  return bibs
}

/**
 *  Print a summary of progress so far given:
 *
 *  @param count {int} - Number of records processed to date
 *  @param total {int} Total number of records in the job
 *  @param startTime {Date} - When did the job begin?
 */
const printProgress = (count, total, startTime) => {
  const progress = count / total
  const ellapsed = (new Date() - startTime) / 1000
  const recordsPerSecond = count / ellapsed
  const recordsPerHour = recordsPerSecond * 60 * 60
  console.log([
    `Reading bibs ${count} - ${count + argv.batchSize} of ${total || '?'}`,
    progress ? `: ${(progress * 100).toFixed(2)}%` : '',
    recordsPerHour ? ` (${Math.round(recordsPerHour).toLocaleString()} records/h)` : '' //,
  ].join(''))
}

/**
 *  Reindex a bunch of bibs based on a BibService query
 */
const updateBibs = async () => {
  await initPools()

  let sqlFromAndWhere = null
  let sqlParams = []
  if (argv.bibId) {
    sqlFromAndWhere = `bib B
      WHERE B.nypl_source = $1
      AND B.id = $2`
    sqlParams = [
      argv.nyplSource,
      argv.bibId
    ]
  } else if (argv.type === 'bib' && argv.hasMarc) {
    sqlFromAndWhere = `bib B,
      json_array_elements(B.var_fields::json) jV
      WHERE B.nypl_source = $1
      AND jV->>'marcTag' = $2`
    sqlParams = [
      argv.nyplSource,
      argv.hasMarc
    ]
  }

  const query = `SELECT * FROM ${sqlFromAndWhere}` +
    (argv.orderBy ? ` ORDER BY ${argv.orderBy}` : '') +
    (argv.limit ? ` LIMIT ${argv.limit}` : '') +
    (argv.offset ? ` OFFSET ${argv.offset}` : '')

  console.log(`Querying BibService: ${query} | ${JSON.stringify(sqlParams)}`)

  const bibClient = await dbConnectionPools.bibService.connect()
  const cursor = bibClient.query(new Cursor(query, sqlParams))

  const total = argv.limit
  let count = 0
  const startTime = new Date()
  while (count < argv.limit || !argv.limit) {
    // Log out progress os far:
    printProgress(count, total, startTime)

    // Pull next batch of bibs from the cursor:
    const rows = await cursor.read(argv.batchSize)

    // Did we reach the end?
    if (rows.length === 0) {
      console.log(`Cursor reached the end. Stopping after ${count} processed.`)
      break
    }

    // Transform bib properties to match what BibService would have returned:
    const bibs = convertCommonModelProperties(rows)

    // Trigger reindex:
    await processRecords('Bib', bibs, { dryrun: argv.dryrun })

    count += rows.length
  }

  cursor.close(() => {
    bibClient.release()
  })

  endPools()
}

if (!argv.type || !(argv.hasMarc || argv.bibId)) {
  usage()
  die('Missing --type and/or a --hasMarc or --bibId query')
}

updateBibs()
  .catch((e) => {
    console.log('Error ', e)
    console.log(e.stack)
  })
