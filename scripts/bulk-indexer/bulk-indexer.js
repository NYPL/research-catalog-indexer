const fs = require('fs')
const path = require('path')
const { parse: csvParse } = require('csv-parse/sync')
const { Pool } = require('pg')

const kms = require('../../lib/kms.js')
const prefetchers = require('../../lib/prefetch.js')
const indexer = require('../../index')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('../../lib/prefilter')
const {
  batch,
  die,
  camelize,
  capitalize,
  groupIdentifierEntitiesByTypeAndNyplSource,
  lineCount,
  printProgress
} = require('../utils')
const schema = require('../../lib/elastic-search/index-config/index-schema.js')
const logger = require('../../lib/logger')
const { buildCsv: buildCsvForMarc } = require('../identify-ids-by-marc')
const NyplSourceMapper = require('../../lib/utils/nypl-source-mapper')
const { JobState } = require('./job-state')

if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME) {
  logger.info(`Enabling NewRelic reporting for ${process.env.NEW_RELIC_APP_NAME}`)
}

let instrument = (label, cb) => cb()
const enableNrInstrumentation = (cb) => {
  instrument = cb
}

/**
 *  Set up db pools
 */
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
        process.exit(1)
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
 *  Given an array of bib ids, returns a hash relating each of those bib ids to
 *  an array of items for that bib
 */
const sierraItemsByBibIds = async (bibIds, nyplSource) => {
  const itemClient = await db.connect('itemService')

  const query = `SELECT * FROM item
    WHERE nypl_source = '${nyplSource}'
    AND bib_ids ?| array[${bibIds.map((id) => `'${id}'`).join(',')}]`
  const result = await itemClient.query(query)

  const items = _convertCommonModelProperties(result.rows)

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

  const holdings = _convertCommonModelProperties(result.rows)

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

const presentInSchema = (property, schema) => {
  const schemaProperties = Object.keys(schema)
  return schemaProperties.find((schemaProperty) => {
    if (property === schemaProperty) return true
    else if (schema[schemaProperty].type === 'nested') {
      return presentInSchema(property, schema[schemaProperty].properties)
    } else return false
  })
}

const overwriteSchema = (properties) => {
  const originalSchemaMethod = schema.schema

  const newSchema = { uri: true }
  logger.info(`Overwriting schema to only contain properties: ${properties}`)
  properties.split(',').filter((property) => {
    const validSchemaProp = !!presentInSchema(property, originalSchemaMethod())
    if (!validSchemaProp) throw new Error(`${property} not a valid ES document property`)
    return validSchemaProp
  }).forEach((prop) => { newSchema[prop] = true })
  schema.schema = () => {
    return newSchema
  }
  schema.originalMethod = originalSchemaMethod
}

const restoreSchema = () => {
  if (schema.originalMethod) {
    schema.schema = schema.originalMethod
  }
}

const fetchModelsFromDbConnection = async (bibs) => {
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
  logger.info('skipping API fetching')
  prefetchers.generalPrefetch = async (bibs) => Promise.resolve(bibs)
  prefetchers.generalPrefetch.originalFunction = originalFunction
}

const restoreGeneralPrefetch = () => {
  if (prefetchers.generalPrefetch.originalFunction) {
    prefetchers.generalPrefetch = prefetchers.generalPrefetch.originalFunction
      .bind(prefetchers)
  }
}

/**
 *  Here we're overwriting the application modelPrefetch routine to prefetch
 *  items and holdings by direct sql connection to the Item- and
 *  HoldingsService databases
 */
const overwriteModelPrefetch = (options = {}) => {
  const originalFunction = prefetchers.modelPrefetch
  if (options.skipDbPrefetch || process.env.SKIP_DB_PREFETCH === 'true') {
    logger.info('Skipping db prefetch')
    prefetchers.modelPrefetch = async (bibs) => Promise.resolve(bibs)
  } else prefetchers.modelPrefetch = fetchModelsFromDbConnection

  prefetchers.modelPrefetch.originalFunction = originalFunction
}

const restoreModelPrefetch = () => {
  if (prefetchers.modelPrefetch.originalFunction) {
    prefetchers.modelPrefetch = prefetchers.modelPrefetch.originalFunction
      .bind(prefetchers)
  }
}

/**
 *  Given a CSV row and an options hash
 *  attempts to extract a plainobject representing the identifier, definining:
 *    - id
 *    - nyplSource
 */
const castRowToIdentifier = (row, options) => {
  const id = row[options.idColumn]

  // If the CSV already tells us the nyplSource, trust it instead of guessing
  // from the id's shape
  if (typeof options.nyplSourceColumn !== 'undefined') {
    const nyplSource = row[options.nyplSourceColumn]
    if (!options.sourceMapper.validSource(nyplSource)) {
      throw new Error(`Invalid nyplSource: ${nyplSource}`)
    }
    return {
      id,
      nyplSource
    }
  }

  const isPrefixedId = /^[a-z]+\d+$/.test(id)

  if (isPrefixedId) {
    const split = options.sourceMapper.splitIdentifier(id)
    if (!split || !split.type || !split.nyplSource) {
      throw new Error(`Invalid prefixed id: ${id}`)
    }
    return split
  } else {
    return {
      id,
      nyplSource: null
    }
  }
}

/**
 *  Given a path to a CSV, returns a plainobject mapping col 0 to col 1
 */
const barcodeCustomerCodeMapFromCsv = (path) => {
  logger.info(`Loading barcode-recap-customer-code map from ${path}`)
  return csvParse(fs.readFileSync(path, 'utf8'))
    .reduce((h, [barcode, cc]) => Object.assign(h, { [barcode]: cc }), {})
}

/**
 *  Given a type (bib|item), an nyplSource, and an array of ids, returns all records
 */
const recordsByIds = async (type, nyplSource, ids) => {
  const sqlFromAndWhere = `${type}
    WHERE nypl_source = $1
    AND id IN (${ids.map((id) => `'${id}'`).join(',')})`
  const params = [
    nyplSource
  ]
  const limit = ids.length

  const query = `SELECT * FROM ${sqlFromAndWhere} LIMIT ${limit}`

  let rows = null
  logger.info(`Querying ${capitalize(type)}Service: ${query} | ${JSON.stringify(params)}`)

  const client = await db.connect(`${type}Service`)
  rows = (await client.query(query, params)).rows
  rows = _convertCommonModelProperties(rows)

  return rows
}

/**
 *  Given a type (bib|item), an nyplSource, and an array of ids, indexes all records.
 */
const indexByIds = async (type, nyplSource, ids, options) => {
  const records = await instrument('Looking up records by ids', () => {
    return recordsByIds(type, nyplSource, ids)
  })
  await instrument('Index records', () => {
    return indexer.processRecords(capitalize(type), records, options)
  })

  return records
}

/**
* Update index by CSV.
*
* Options param may include:
*  - csv {string} - Path to local CSV file. Required.
*  - csvIdColumn {int} - Column index (0-indexed) in CSV from which to extract the id. Required.
*  - csvNyplSourceColumn {int} - Column index (0-indexed) in CSV from which to extract the nyplSource. Required if --nyplSource omitted.
*  - type {string} - Type of record (item, bib, holding). Required if CSV contains numeric ids.
*  - nyplSource {string} - NyplSource value (e.g. sierra-nypl). Required if CSV contains numeric ids.
*  - csvDropChecksum {boolean} - Whether or not to remove the Sierra check-digit from extracted ids. Default false.
*  - offset {int} - 0-indexed line number to start at. Default 0
*  - limit {int}  - Number of rows to process. Default no-limit.
*  - batchSize {int} - Number of records to process in each batch
*  - skipDeletes {boolean} - Whether to skip deleting suppressed records, useful if doing a large bulk where we are trying to update fields on existing records
*/
const updateByCsv = async (options = {}) => {
  options = {
    offset: 0,
    updateOnly: process.env.UPDATE_ONLY === 'true',
    skipApiPrefetch: process.env.SKIP_API_PREFETCH === 'true',
    onUpdate: () => null,
    ...options
  }

  const rawContent = fs.readFileSync(options.csv, 'utf8')
  const rows = csvParse(rawContent, { trim: true, skip_empty_lines: true })

  const sourceMapper = await NyplSourceMapper.instance()

  const rowsToProcess = extractAndValidateIdentifiers(rows, options, sourceMapper)

  if (rowsToProcess.length > 0) {
    const batches = groupIdentifierEntitiesByTypeAndNyplSource(rowsToProcess)
      .map((grouped) => batch(grouped, options.batchSize))
      .flat()

    await db.initPools()
    // Add stats to options object (for progress reporting):
    const optionsWithStats = Object.assign(options, {
      startingOffset: options.offset,
      count: 0,
      total: rowsToProcess.length,
      startTime: new Date()
    })

    enableBulkIndexOverrides(options)
    await _processCsvBatch(batches, 0, optionsWithStats)
    revertBulkIndexerOverrides()
  }
}

/**
 *  Enable various overrides for performance reasons
 */
const enableBulkIndexOverrides = (options) => {
  // Use db for sub-model lookups
  overwriteModelPrefetch(options)

  // Skip various item-specific bulk computations (ReCAP & M2 customer code prefetching, date parsing):
  if (options.skipApiPrefetch) {
    overwriteGeneralPrefetch()
  }

  // Only update specific properties?
  const updatingSpecificProperties = options.updateOnly && options.properties ? options.properties : false
  if (updatingSpecificProperties) {
    overwriteSchema(updatingSpecificProperties)
  }
}

/**
 *  Restore effect of above.
 */
const revertBulkIndexerOverrides = () => {
  restoreModelPrefetch()
  restoreGeneralPrefetch()
  restoreSchema()
}

/**
 * Extract and validate identifiers from CSV rows
 */
const extractAndValidateIdentifiers = (rows, options, sourceMapper) => {
  const end = options.limit ? Math.min(rows.length, options.limit + options.offset) : rows.length
  const rowsToProcess = rows.slice(options.offset, end)
    .map((row) => castRowToIdentifier(row, { idColumn: options.csvIdColumn, nyplSourceColumn: options.csvNyplSourceColumn, sourceMapper }))

  logger.info(`Processing ${options.csv} rows ${options.offset} to ${end} (${rowsToProcess.length} rows)`)

  // Test first row to determine whether we need to interpret as prefixed
  // identifiers or just plain numeric ids:
  if (rowsToProcess.length > 0) {
    const identifiersHaveNyplSource = rowsToProcess[0].nyplSource
    const identifiersHaveType = rowsToProcess[0].type

    if (!options.nyplSource && !identifiersHaveNyplSource) {
      const errorMsg = 'Must specify --nyplSource if not apparent from CSV (use --csvNyplSourceColumn N if CSV includes nyplSource)'
      throw new Error(errorMsg)
    } else if (!options.type && !identifiersHaveType) {
      const errorMsg = 'Must specify --type if not apparent from CSV'
      throw new Error(errorMsg)
    }
  }

  return rowsToProcess
}

/**
 *  Handler for jobs in 'preparing' state:
 *  Given a state, generates relevant CSV for given criteria, updating state to reference new CSV
 * */
const prepareCsv = async (state) => {
  if (state.csvCount()) {
    return
  }

  // Build CSV:
  if (!state.csvPath()) {
    state.addMessage(`Building CSV for ${state.basePath}`)
    const csv = state.basePath + '.csv'
    await buildCsvForMarc({ ...state.data.params, toCsv: csv })
    state.save({ csv })
  }

  // Count rows:
  if (state.csvPath() && fs.existsSync(state.csvPath())) {
    state.addMessage(`Counting rows in ${state.csvPath()}`)
    const count = await lineCount(state.csvPath())
    state.save({ count })
  }

  if (state.csvPath() && state.csvCount()) {
    return handleJobEvent(state, 'csv-built')
  } else {
    return handleJobEvent(state, 'error')
  }
}

/**
 * Handler for jobs in 'indexing' state
 */
const indexRecords = async (state) => {
  const options = state.data.params

  if (state.data.offset) {
    options.offset = state.data.offset
    state.addMessage(`Resuming offset ${options.offset}`)
  }

  try {
    await updateByCsv({
      ...options,
      csv: state.csvPath(),
      onUpdate: (newOffset) => {
        state.save({ offset: newOffset })
      }
    })
  } catch (e) {
    return handleJobEvent(state, 'error')
  }

  return handleJobEvent(state, 'completed')
}

/**
 *  Handler for jobs in state 'complete'
 */
const finishJob = (state) => {
  logger.info('Job complete')
}

const STATUS_FAILED = 'failed'
const STATUS_INDEXING = 'indexing'
const STATUS_COMPLETED = 'completed'
const STATUS_PREPARING = 'preparing'

/**
 * Declare state-machine describing valid states, their handlers, and what states they transition to given certain events.
 */
const STATES = {
  [STATUS_PREPARING]: {
    handler: prepareCsv,
    events: {
      error: STATUS_FAILED,
      'csv-built': STATUS_INDEXING
    }
  },
  [STATUS_INDEXING]: {
    handler: indexRecords,
    events: {
      error: STATUS_FAILED,
      completed: STATUS_COMPLETED
    }
  },
  [STATUS_FAILED]: {
    handler: die
  },
  [STATUS_COMPLETED]: {
    handler: finishJob
  }
}

class BulkIndexJobState extends JobState {
  runnable () {
    return ![STATUS_FAILED, STATUS_COMPLETED].includes(this.status())
  }

  filePath () {
    const defaultPath = JobState.prototype.filePath.bind(this)()

    if (this.status() === STATUS_COMPLETED) {
      const dateString = this.data.started.split('T').shift()
      const dir = path.dirname(this.basePath)
      const base = path.basename(this.basePath)
      return path.join(dir, `${dateString}-${base}-status.json`)
    } else {
      return defaultPath
    }
  }

  csvPath () {
    return this.data.csv
  }

  csvCount () {
    return this.csvPath() && this.data.count
  }

  static fromParams (params) {
    return JobState.fromParams(params, BulkIndexJobState)
  }
}

/**
 *  Given a state, invokes handler relevant for current status
 */
const resumeJob = (state) => {
  if (!(state.status() in STATES)) {
    return Promise.reject(new Error(`Invalid status: ${state.status()}`))
  }

  try {
    return STATES[state.status()].handler(state)
  } catch (e) {
    console.error('Error: ', e)
    throw e
  }
}

/**
 * Emit named event, triggering state change and invoking relevant handler
 */
const handleJobEvent = (state, event) => {
  if (!(event in STATES[state.status()].events)) {
    throw new Error(`Don't know how to handle event '${event}' in state '${state.status()}'`)
  }

  const newState = STATES[state.status()].events[event]
  state.updateStatus(newState, `Handling '${event}' event: Transitioning from ${state.status()} to ${newState}`)

  return resumeJob(state)
}

/**
 * Given index criteria, builds a JobState object
 * */
const initializeJobState = (params) => {
  return BulkIndexJobState.fromParams(params)
}

/**
 *  Perform transformations on a db result so that it resembles the object
 *  returned from the Bib/Item services
 */
const _convertCommonModelProperties = (models) => {
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
* Process a single CSV batch.
* @param batches {object[][]} - 2D array of identifier objects (with nyplSource, type, and id props)
* @param index {int} - Index of the batch to process.
*/
const _processCsvBatch = async (batches, index = 0, options) => {
  const batch = batches[index]

  // Determine type of batch by examining first record (fall back on options)
  const type = batch[0].type || options.type
  // Determine nyplSource of batch by examining first record (fall back on options)
  const nyplSource = batch[0].nyplSource || options.nyplSource
  const ids = batch.map((r) => r.id)

  await indexByIds(type, nyplSource, ids, options)

  // Log out progress so far:
  printProgress(options.count + batch.length, options.total, options.batchSize, options.startTime)

  if (options.onUpdate) {
    options.onUpdate(options.startingOffset + options.count + batch.length)
  }

  if (batches.length > index + 1) {
    // Update `count` (for progress stats):
    const updatedOptions = Object.assign(options, {
      count: options.count + batch.length
    })
    return _processCsvBatch(batches, index + 1, updatedOptions)
  } else {
    logger.info('Finished CSV batches.')
  }
}

module.exports = {
  initializeJobState,
  resumeJob,
  updateByCsv,
  prepareCsv,
  db,
  overwriteModelPrefetch,
  restoreModelPrefetch,
  indexByIds,
  enableNrInstrumentation,
  indexRecords,
  _testing: {
    overwriteGeneralPrefetch,
    restoreGeneralPrefetch,
    overwriteSchema,
    recordsByIds,
    restoreSchema,
    barcodeCustomerCodeMapFromCsv,
    extractAndValidateIdentifiers
  }
}
