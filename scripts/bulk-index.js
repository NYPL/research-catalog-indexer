/**
 *  Bulk Index
 *
 *  This script allows you to index lots of records in bulk based on either:
 *   1. an arbitrary Bib- or ItemService SQL query.
 *   2. a CSV containing identifiers
 *
 *  I. Updating by Bib/Item Service query:
 *
 *    node scripts/bulk-index.js --type (item|bib) [--hasMarc MARC] [--hasSubfield S] [--nyplSource NYPLSOURCE]
 *
 *    Arguments:
 *      type {string}: Required. One of item or bib
 *      hasMarc {string}: Marc tag that must be present in the record
 *      hasSubfield {string}: When used with hasMarc, restricts to records matching both marc tag and subfield
 *      nyplSource {string}: NYPL Source value. Default 'sierra-nypl'
 *      orderBy {string}: Columns to order query by. Default '' (no sort).
 *        e.g. `--orderBy id`. Sortable columns include `id`, `updated_date`,
 *        `created_date`.
 *      limit {int}: How many records to process. Default null (no limit)
 *      offset {int}: How many records to skip over. Default 0
 *      batchSize {int}: How many records to index at one time. Default 100
 *      dryrun {boolean}: Set to true to perform all work, but skip writing to index.
 *      envfile {string}: Path to local .env file. Default ./config/qa-bulk-index.env
 *
 *    One of these mutually exclusive arguments must be used so that the script
 *    has something to query on:
 *     - hasMarc
 *     - bibId
 *
 *    Note that omitting --limit may cause the query to take a long time to
 *    return due to the size of the databases.
 *
 *    Using --orderBy may slow down the query, but will ensure you can resume
 *    when a job fails by setting --offset to the index of the last successful
 *    batch. (Otherwise, results are processed in an unstable order between jobs.)
 *
 *    Examples
 *
 *    To reindex all NYPL bibs with marc 001 in QA:
 *      node scripts/bulk-index.js --type bib --hasMarc 001
 *
 *    To reindex all NYPL bibs with 700 $t in QA:
 *      node scripts/bulk-index.js --type bib --hasMarc 700 --hasSubfield t
 *
 *    To reindex all bibs in QA:
 *      node scripts/bulk-index.js --type bib
 *
 *  II. Updating by CSV:
 *
 *      node scripts/bulk-index --csv CSVFILE --csvIdColumn 0 [--csvDropChecksum]
 *
 *    CSV is may contain any number of columns, but one of them must contain prefixed ids (e.g. b1234)
 *
 *    Arguments:
 *      csv {string}: Path to local CSV. Required.
 *      csvIdColumn {int}: Column index (0-indexed) in CSV from which to extract the id. Required.
 *      csvDropChecksum {boolean}: Whether or not to remove the Sierra check-digit from extracted ids. Default false.
 *      limit {int}: How many records to process. Default null (no limit)
 *      offset {int}: How many records to skip over in the CSV. Default 0
 *      batchSize {int}: How many records to index at one time. Default 100
 *      dryrun {boolean}: Set to true to perform all work, but skip writing to index.
 *      envfile {string}: Path to local .env file. Default ./config/qa-bulk-index.env
 *      table {string}: Override primary table name used (e.g. bib_v2)
 *
 *  III. Perform property-specific bib-only update:
 *
 *      node scripts/bulk-index.js [...bulk index args]  --properties subjectLiteral,addedAuthorTitle --skipPrefetch true --updateOnly true
 *
 *      Perform bulk update to specified properties. To date, this script is intended for use on bib-level properties
 *      with no dependencies on item or holding data.
 *
 *      Arguments:
 *        any bulk-index argument for specifying the scope of the update
 *        properties {string}: comma-delineated list of bib-level properties to run update for
 *        skipPrefetch {boolean}: flag to skip item and holding fetches from the DB, as well as API calls to M2 customer code store and SCSB
 *        updateOnly {boolean}: flag to run as update only script and not standard bulk index overwrite
 */
const fs = require('fs')
const { parse: csvParse } = require('csv-parse/sync')

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    limit: null,
    offset: 0,
    batchSize: 100,
    nyplSource: 'sierra-nypl',
    dryrun: false,
    updateOnly: false,
    envfile: './config/qa-bulk-index.env',
    skipPrefetch: false
  },
  boolean: ['updateOnly'],
  string: ['hasMarc', 'hasSubfield', 'bibId', 'fromDate', 'toDate'],
  integer: ['limit', 'offset', 'batchSize']
})

const isCalledViaCommandLine = /scripts\/bulk-index(.js)?/.test(fs.realpathSync(process.argv[1]))

const dotenv = require('dotenv')

// Conditionally set up NR instrumentation
// Initialize `instrument` as a pass-through
let instrument = (label, cb) => cb()
// If NR is enablable..
if (isCalledViaCommandLine && process.env.NEW_RELIC_LICENSE_KEY) {
  // Build NR app-name based on envfile:
  const newrelicEnvironment = argv.envfile.includes('production') ? 'Prod' : 'QA'
  process.env.NEW_RELIC_APP_NAME = `Research Catalog Indexer (${newrelicEnvironment})`
  const newrelic = require('newrelic')

  // Overwrite `instrument` with appropriate NR function:
  instrument = newrelic.startBackgroundTransaction.bind(newrelic)

  /* (label, cb) => {
    return newrelic.startBackgroundTransaction(label, cb)
  } */
}

const { Pool } = require('pg')
const Cursor = require('pg-cursor')

const kms = require('../lib/kms.js')
const prefetchers = require('../lib/prefetch.js')
const indexer = require('../index')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('../lib/prefilter')
const {
  awsCredentialsFromIni,
  batch,
  batchIdentifiersByTypeAndNyplSource,
  delay,
  die,
  camelize,
  capitalize,
  printProgress
} = require('./utils')
const schema = require('../lib/elastic-search/index-schema.js')
const { setCredentials: kmsSetCredentials } = require('../lib/kms')
const logger = require('../lib/logger')
const { loadNyplCoreData } = require('../lib/load-core-data.js')
logger.setLevel(process.env.LOG_LEVEL || 'info')

if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME) {
  logger.info(`Enabling NewRelic reporting for ${process.env.NEW_RELIC_APP_NAME}`)
}

const usage = () => {
  console.log([
    'Usage:',
    'Reindex a single record:',
    '  node reindex-record --envfile [path to .env] (--bibId id|--itemId id)',
    'Reindex by has-marc:',
    '  node reindex-record --envfile [path to .env] --type (bib|item) --hasMarc 001 [--hasSubfield S]',
    'Reindex by nypl-source:',
    '  node reindex-record --envfile [path to .env] --type (bib|item) --nyplSource SOURCE [--hasSubfield S]',
    'Reindex by CSV (containing prefixed ids):',
    '  node reindex-record --envfile [path to .env] --csv FILE --csvIdColumn 0',
    'Perform any reindex only for specific bib-only properties by adding the following to any reindex args: ',
    '  --properties subjectLiteral,addedAuthorTitle --skipPrefetch true  --updateOnly true'
  ].join('\n'))
  return true
}

const awsCreds = awsCredentialsFromIni()
kmsSetCredentials(awsCreds)

const db = {
  dbConnectionPools: null,

  /**
   *  Initialize all db connection pools
   */
  initPools: async () => {
    db.dbConnectionPools = {
      itemService: await db.initPool('ITEM'),
      bibService: await db.initPool('BIB'),
      holdingsService: await db.initPool('HOLDINGS')
    }
  },

  /**
   *  Given a db name (ITEM, BIB, HOLDINGS), decrypts related config and returns
   *  a db Pool instance
   */
  initPool: async (prefix) => {
    const [user, password, host] = await Promise.all([
      kms.decrypt(process.env[`${prefix}_SERVICE_DB_USER`]),
      kms.decrypt(process.env[`${prefix}_SERVICE_DB_PW`]),
      kms.decrypt(process.env[`${prefix}_SERVICE_DB_HOST`])
    ])
      .catch((e) => {
        logger.error('Error decrypting db config. Be sure to specify an --envfile with encrypted db connection info.')
        process.exit()
      })
    const config = {
      user,
      host,
      database: process.env[`${prefix}_SERVICE_DB_NAME`],
      password
    }
    return new Pool(config)
  },

  /**
   *  Get db connection for named db
   */
  connect: (name) => db.dbConnectionPools[name].connect(),

  /**
   *  Sever connections will all db connection pools
   */
  endPools: () => {
    Object.entries(db.dbConnectionPools)
      .forEach(([name, pool]) => {
        logger.debug(`Stopping ${name} pool`)
        pool.end()
      })
  }
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
const sierraItemsByBibIds = async (bibIds, nyplSource) => {
  const itemClient = await db.connect('itemService')

  const query = `SELECT * FROM item
    WHERE nypl_source = '${nyplSource}'
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
  if (bibIds.length === 0) return {}

  const holdingsClient = await db.connect('holdingsService')

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

const overwriteSchema = () => {
  const originalSchemaMethod = schema.schema
  const newSchema = { uri: true }
  argv.properties.split(',').filter((property) => {
    const validSchemaProp = !!originalSchemaMethod()[property]
    if (!validSchemaProp) throw new Error(`${property} not a valid ES document property.`)
    return validSchemaProp
  }).forEach((prop) => { newSchema[prop] = true })
  console.log(newSchema)
  schema.schema = () => {
    return newSchema
  }
  schema.schema.originalMethod = originalSchemaMethod
}

const restoreSchema = () => {
  if (schema.schema.originalFunction) {
    schema.schema = schema.schema.originalFunction
      .bind(schema)
  }
}

/**
 *  Here we're overwriting the application modelPrefetch routine to prefetch
 *  items and holdings by direct sql connection to the Item- and
 *  HoldingsService databases
 */
const fetchFromDbConnection = async (bibs) => {
  if (bibs.length === 0) return bibs
  const distinctSources = Array.from(new Set(bibs.map((b) => b.nyplSource)))
  if (distinctSources.length > 1) {
    throw new Error(`Model prefetch encountered batch with multiple nyplSources: ${distinctSources.join(',')}`)
  }

  // Get distinct bib ids:
  const bibIds = Array.from(new Set(bibs.map((b) => b.id)))
  const nyplSource = bibs[0].nyplSource

  // Fetch all items and holdings for this set of bibs:
  const [itemsByBibId, holdingsByBibId] = await Promise.all([
    sierraItemsByBibIds(bibIds, nyplSource),
    nyplSource === 'sierra-nypl' ? sierraHoldingsByBibIds(bibIds) : Promise.resolve({})
  ])

  // Attach holdings and items to bibs:
  bibs = bibs.map((bib) => {
    // Wrap in SierraHolding class and apply suppression:
    bib._holdings = filteredSierraHoldingsForHoldings(holdingsByBibId[bib.id] || [])
    // Apply suppression/is-research filtering to items:
    bib._items = filteredSierraItemsForItems(itemsByBibId[bib.id]) || []
    // Ensure items have a reference to their bib:
    bib._items.forEach((item) => {
      item._bibs = [bib]
    })
    return bib
  })

  return bibs
}

const overwriteGeneralPrefetch = () => {
  const originalFunction = prefetchers.generalPrefetch
  if (argv.skipPrefetch) {
    prefetchers.generalPrefetch = async (bibs) => Promise.resolve(bibs)

    prefetchers.modelPrefetch.originalFunction = originalFunction
  }
}

const restoreGeneralPrefetch = () => {
  if (prefetchers.generalPrefetch.originalFunction) {
    prefetchers.generalPrefetch = prefetchers.generalPrefetch.originalFunction
      .bind(prefetchers)
  }
}

const overwriteModelPrefetch = () => {
  const originalFunction = prefetchers.modelPrefetch
  if (argv.skipPrefetch) prefetchers.modelPrefetch = async (bibs) => Promise.resolve(bibs)
  else prefetchers.modelPrefetch = fetchFromDbConnection

  prefetchers.modelPrefetch.originalFunction = originalFunction
}

const restoreModelPrefetch = () => {
  if (prefetchers.modelPrefetch.originalFunction) {
    prefetchers.modelPrefetch = prefetchers.modelPrefetch.originalFunction
      .bind(prefetchers)
  }
}

/**
* Build a Bib/Item Service db query based on given options.
*
* Supported options:
* - bibId {number} - Bib id
* - itemId {number} - Bib id
* - ids {int[]} - Array of ids
* - type {string} - Either 'bib' or 'item'
* - nyplSource {string}
* - hasMarc {string} - Query by presence of a marc field (e.g. '001')
* - hasSubfield {string} - When used with hasMarc, restricts to records with given marc tag and subfield (e.g. 't')
* - limit {integer} - Limit query to count
* - offset {integer} - Start query at offset
* - orderBy {string} - SQL phrase to use in ORDER BY ...
* - fromDate {string} - Date string at the bottom of range for updated_date field
* - toDate {string} - Date string at the top of range for updated_date field
* - table {string} - Defaults to using the type (bib, item) as table name, but this field lets you specify a different table e.g. bib_v2
**/
const buildSqlQuery = (options) => {
  let sqlFromAndWhere = null
  let params = []
  let type = null
  let table = null

  // Just querying a single bib/item id?
  if (options.nyplSource && (options.bibId || options.itemId)) {
    type = options.bibId ? 'bib' : 'item'
    table = options.table ? options.table : type
    sqlFromAndWhere = `${table}
      WHERE nypl_source = $1
      AND id = $2`
    params = [
      options.nyplSource,
      options.bibId || options.itemId
    ]

    options.limit = 1

    // Querying a collection of ids?
  } else if (options.nyplSource && options.type && options.ids) {
    type = options.type
    table = options.table ? options.table : type
    sqlFromAndWhere = `${table}
      WHERE nypl_source = $1
      AND id IN (${options.ids.map((id) => `'${id}'`).join(',')})`
    params = [
      options.nyplSource
    ]
    options.limit = options.ids.length

    // Support for a date range query
  } else if (options.type && options.fromDate) {
    type = options.type
    const fromDate = options.fromDate
    const toDate = options.toDate != null ? options.toDate : new Date().toISOString().split('T')[0]

    table = options.table ? options.table : type
    sqlFromAndWhere = `${table}
      WHERE updated_date BETWEEN '${fromDate}' AND '${toDate}'`

    // Querying by type (and possibly hasMarc / nyplSource):
  } else if (options.type) {
    type = options.type
    table = options.table ? options.table : type

    // Build array of SELECT clauses:
    const selects = [table]
    // Build array of WHERE clauses:
    const wheres = []

    // Filter on nyplSource:
    if (options.nyplSource) {
      wheres.push('nypl_source = $1')
      params.push(options.nyplSource)
    }

    // Filter on having a specific marc field:
    if (options.hasMarc) {
      selects.push('json_array_elements(var_fields::json) jV')
      wheres.push("jV->>'marcTag' = $2")
      params.push(options.hasMarc)
    }

    // Filter on existence of specific subfield:
    if (options.hasSubfield) {
      selects.push("json_array_elements(jV->'subfields') jVS")
      wheres.push("jVS->>'tag' = $3")
      params.push(options.hasSubfield)
    }

    sqlFromAndWhere = selects.join(',\n')
    if (wheres.length) {
      sqlFromAndWhere += '\nWHERE ' + wheres.join('\nAND ')
    }
  } else {
    throw new Error('Insufficient options to buildSqlQuery')
  }

  // Determine whether or not to use an inner-select to de-dupe the records:
  const dedupe = !!options.hasMarc

  const primaryColumns = dedupe ? 'DISTINCT id, nypl_source' : '*'
  let query = `SELECT ${primaryColumns} FROM ${sqlFromAndWhere}` +
    (options.orderBy ? ` ORDER BY ${options.orderBy}` : '') +
    (options.limit ? ` LIMIT ${options.limit}` : '') +
    (options.offset ? ` OFFSET ${options.offset}` : '')
  // Some queries will return bibs multiple times because a matched var/subfield repeats.
  // To ensure we only handle such bibs once, we must de-deupe the results on id & nypl_source.
  // We use an inner-select to identify all of the distinct bibs (by id and nypl_source)
  // which we then JOIN to retrieve all fields.
  if (dedupe) {
    query = 'SELECT R.*' +
      ` FROM (\n${query}\n) _R` +
      ` INNER JOIN ${type} R ON _R.id=R.id AND _R.nypl_source=R.nypl_source`
  }

  return { query, params, type }
}

/**
 *  Reindex a bunch of bibs based on a BibService query
 */
const updateByBibOrItemServiceQuery = async (options) => {
  options = Object.assign({
    // Default progress logger:
    progressCallback: (count, total, startTime) => printProgress(count, total, argv.batchSize, startTime)
  }, options)

  let cursor
  let client

  const { query, params, type } = buildSqlQuery(options)

  await instrument('Bulk-index initial query', async () => {
    logger.info(`Querying ${capitalize(type)}Service: ${query} | ${JSON.stringify(params)}`)

    client = await db.connect(`${type}Service`)
    cursor = client.query(new Cursor(query, params))
  })

  const total = options.limit
  let count = 0
  const startTime = new Date()
  let done = false
  while (!done && (count < options.limit || !options.limit)) {
    await instrument('Bulk-index batch', async () => {
      // Pull next batch of records from the cursor:
      const rows = await cursor.read(options.batchSize)

      // Did we reach the end?
      if (rows.length === 0) {
        logger.info(`Cursor reached the end. Stopping after ${count} processed.`)
        done = true
        return
      }

      // Transform bib/item properties to match what Bib/ItemService would have returned:
      const records = convertCommonModelProperties(rows)

      // Trigger reindex:
      let retries = 3
      let processed = false
      while (!processed && retries > 0) {
        await indexer.processRecords(capitalize(type), records, { updateOnly: argv.updateOnly, dryrun: argv.dryrun })
          .then(() => {
            if (retries < 3) logger.info(`Succeeded on retry ${3 - retries}`)
            processed = true
          })
          .catch(async (e) => {
            if (!(e instanceof SkipPrefetchError)) {
              logger.warn(`Retrying due to error: ${e}`)
              console.trace(e)
              await delay(3000)
              retries -= 1
            } else throw e
          })
      }
      count += rows.length

      // Log out progress so far:
      options.progressCallback(count, total, startTime)
    })
  }

  cursor.close(() => {
    client.release()
  })
}

/**
* Update index by CSV.
*
* Options param may include:
*  - csv {string} - Path to local CSV file. Required.
*  - csvIdColumn {int} - Column index (0-indexed) in CSV from which to extract the id. Required.
*  - type {string} - Type of record (item, bib, holding). Required if CSV contains numeric ids.
*  - nyplSource {string} - NyplSource value (e.g. sierra-nypl). Required if CSV contains numeric ids.
*  - csvDropChecksum {boolean} - Whether or not to remove the Sierra check-digit from extracted ids. Default false.
*  - offset {int} - 0-indexed line number to start at. Default 0
*  - limit {int}  - Number of rows to process. Default no-limit.
*/
const updateByCsv = async (options = { offset: 0 }) => {
  if (!options.csv) throw new Error('--csv is required')
  if (isNaN(options.csvIdColumn)) {
    throw new Error('--csvIdColumn is required')
  }

  const rawContent = fs.readFileSync(options.csv, 'utf8')
  const rows = csvParse(rawContent)

  // Slice rows-to-process using --offset and --limit:
  const end = options.limit ? options.limit + options.offset : rows.length
  const rowsToProcess = rows.slice(options.offset, end)
    .map((row) => row[options.csvIdColumn])
    // Do input values have Sierra check digit? Remove them:
    .map((uri) => options.csvDropChecksum ? uri.substring(0, uri.length - 1) : uri)

  logger.info(`Processing ${options.csv} rows ${options.offset} to ${end} (${rowsToProcess.length} rows)`)

  // Test first row to determine whether we need to interpret as prefixed
  // identifiers or just plain numeric ids:
  const isPrefixedIds = /^[a-z]+\d+$/.test(rowsToProcess[0])
  const isNumericIds = /^\d+$/.test(rowsToProcess[0])
  if (!isPrefixedIds && !isNumericIds) {
    logger.info('First few rows: ', rowsToProcess.slice(0, 3))
    throw new Error(`Invalid id found in first row: ${rowsToProcess[0]}. Aborting.`)
  } else if (isNumericIds && (!options.type || !options.nyplSource)) {
    throw new Error('CSV has numeric ids but no `type` specified')
  } else {
    const batches = isPrefixedIds
      ? await batchIdentifiersByTypeAndNyplSource(rowsToProcess, argv.batchSize)
      : batch(
        // Convert numeric ids to identifier objects (with nyplSource & type props):
        rowsToProcess.map((id) => {
          return { id, nyplSource: options.nyplSource, type: options.type }
        }),
        argv.batchSize
      )

    await db.initPools()
    // Add stats to options object (for progress reporting):
    const optionsWithStats = Object.assign(options, {
      count: 0,
      total: rowsToProcess.length,
      startTime: new Date()
    })
    await processCsvBatch(batches, 0, optionsWithStats)
    db.endPools()
  }
}

/**
* Process a single CSV batch.
* @param batches {object[][]} - 2D array of identifier objects (with nyplSource, type, and id props)
* @param index {int} - Index of the batch to process.
*/
const processCsvBatch = async (batches, index = 0, options) => {
  const batch = batches[index]
  await updateByBibOrItemServiceQuery(
    Object.assign(options, {
      // argv.offset should not influence sql offset:
      offset: null,
      type: batch[0].type,
      nyplSource: batch[0].nyplSource,
      ids: batch.map((record) => record.id),
      // NOOP the progress callback:
      progressCallback: () => true
    })
  )

  // Log out progress so far:
  printProgress(options.count + batch.length, options.total, options.batchSize, options.startTime)

  if (batches.length > index + 1) {
    // Update `count` (for progress stats):
    const updatedOptions = Object.assign(options, {
      count: options.count + batch.length
    })
    return processCsvBatch(batches, index + 1, updatedOptions)
  } else {
    logger.info('Finished CSV batches.')
  }
}

/**
* Abort a run for a named reason. When invoked via CLI, calls `die`
* to kill process. Otherwise just logs error.
*/
const cancelRun = (message) => {
  if (isCalledViaCommandLine) die(message)
  else logger.error('Error: ' + message)
}

// Main dispatcher:
const run = async () => {
  dotenv.config({ path: argv.envfile })

  // Validate args:
  if (
    (
      !(argv.type) &&
      !argv.bibId &&
      !argv.itemId &&
      !argv.csv
    ) || (
      argv.type &&
      !['bib', 'item'].includes(argv.type)
    ) 
  ) {
    usage()
    cancelRun('Insufficient params')
  }

  // Enable direct-db access to Item, Bib, and Holdings services:
  overwriteModelPrefetch()
  overwriteGeneralPrefetch()
  overwriteSchema()
  // Require one of:
  // - csv
  // - bib/item id
  // - type, plus another qualifier (hasMarc or nyplSource)
  if (argv.csv) {
    await updateByCsv(argv)
      .catch((e) => {
        logger.error(`Error: ${e.message}`, e)
      })
  } else if (
    argv.bibId ||
    argv.itemId ||
    (
      argv.type &&
      (
        argv.hasMarc ||
        argv.nyplSource ||
        argv.fromDate
      )
    )
  ) {
    await db.initPools()
    await updateByBibOrItemServiceQuery(argv)
      .catch((e) => {
        logger.error('Error ', e)
        logger.error(e.stack)
      })
    db.endPools()
  }
  // Disable direct-db access to Item, Bib, and Holdings services (formality)
  restoreModelPrefetch()
  restoreGeneralPrefetch()
  restoreSchema()
}

if (isCalledViaCommandLine) {
  loadNyplCoreData().then(() => run())
}

module.exports = {
  updateByCsv,
  db,
  buildSqlQuery,
  overwriteModelPrefetch,
  restoreModelPrefetch
}
