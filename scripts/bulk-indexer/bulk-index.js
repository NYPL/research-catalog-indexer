/**
 *  Bulk Index
 *
 *  This script allows you to index lots of records in bulk based on either:
 *   1. an arbitrary Bib- or ItemService SQL query.
 *   2. a CSV containing identifiers
 *
 *  Common Arguments
 *
 *    These arguments are generally available however the script is invoked:
 *
 *     - batchSize {int}: How many records to index at one time. Default 100
 *     - dryrun {boolean}: Set to true to perform all work, but skip writing to index.
 *     - envfile {string}: Path to local .env file. Default ./config/qa-bulk-index.env
 *     - limit {int}: How many records to process. Default null (no limit)
 *     - nyplSource {string}: NYPL Source value. Default 'sierra-nypl'
 *     - offset {int}: How many records to skip over in the CSV. Default 0
 *     - table {string}: Override primary table name used (e.g. bib_v2)
 *     - type {string}: Required. One of item or bib
 *     - properties {string}: comma-delineated list of bib-level properties to run update for
 *     - recapBarcodeCustomerCodeMap {string}: Path to local CSV containing barcode and customer-code pairs.
 *         When provided, allows script to skip many expensive SCSB API calls.
 *         This CSV may be provided by ReCAP staff or generated from our ES.
 *
 *  Performing property-specific bib-only update:
 *
 *    Perform bulk update to specified properties. To date, this script is intended for use on bib-level properties
 *    with no dependencies on item or holding data. Recommended params include --batchSize 1000, as well as setting
 *    process.env.STOP_REFRESH to true to avoid latency in the resources index while running.
 *
 *    Example:
 *      node scripts/bulk-index.js [...bulk index args]  --batchSize 1000 (recommended) \
 *        --properties subjectLiteral,addedAuthorTitle (--skipApiPrefetch true --skipDbPrefetch true \
 *        --updateOnly true) (not required if passed as env vars)
 *
 *    Property-specific arguments:
 *     - skipDbPrefetch {boolean}: Flag to skip item and holding fetches from the DB. Can be false for any bib-level
 *       updates, must be true for item or holding level updates. Can also be controlled via SKIP_DB_PREFETCH env var.
 *     - skipApiPrefetch {boolean}: Skip API calls to M2 customer code store and SCSB. Can be true for any bib-level
 *       update. Can be true for item level updates that do not have to do with live SCSB or M2 customer code data.
 *       Can also be controlled via SKIP_API_PREFETCH env var.
 *     - updateOnly {boolean}: Flag to run as update only script and not standard bulk index overwrite. Can also be
 *       controlled via UPDATE_ONLY env var.
 *
 *
 *  I. Updating by Bib/Item Service query:
 *
 *    node scripts/bulk-index.js --type (item|bib) [--nyplSource NYPLSOURCE]
 *
 *    Arguments:
 *      - orderBy {string}: Columns to order query by. Default '' (no sort).
 *        e.g. `--orderBy id`. Sortable columns include `id`, `updated_date`,
 *        `created_date`.
 *
 *    One of these mutually exclusive arguments must be used so that the script
 *    has something to query on:
 *     - type
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
 *      - csv {string}: Path to local CSV. Required.
 *      - csvIdColumn {int}: Column index (0-indexed) in CSV from which to extract the id. Required.
 *      - csvNyplSourceColumn {int}: Column index (0-indexed) in CSV from which to extract the nyplSource.
 *        Required unless CSV contains prefixed ids or --nyplSource is speified
 *      - csvDropChecksum {boolean}: Whether or not to remove the Sierra check-digit from extracted ids.
 *        Default false.
 *
 *
 *  bulk-index
 *   - by params / jobfile
 *   - creates jobfile if missing
 *   - creates statusfile if missing
 *   - observes state transition rules:
 *     - | state        | event        | next_state         |
 *       |--------------|--------------|--------------------|
 *       | preparing    | csv-built    | running            |
 *       | running      | error        | failed             |
 *       |              | completed    | completed          |
 *       | failed       | restarted    | preparing          |
 *
 */
const fs = require('fs')
const { parse: csvParse } = require('csv-parse/sync')
const argv = require('minimist')(process.argv.slice(2), {
  default: {
    csvIdColumn: 0,
    csvNyplSourceColumn: 1,
    batchSize: 100,
    dryrun: false,
    envfile: './config/qa-bulk-index.env',
    limit: null,
    nyplSource: 'sierra-nypl',
    offset: 0,
    properties: '',
    recapBarcodeCustomerCodeMap: null,
    skipPrefetch: false,
    updateOnly: false,
    jobfile: null
  },
  boolean: ['updateOnly', 'skipDeletes', 'dryrun'],
  string: ['hasMarc', 'hasSubfield', 'bibId', 'fromDate', 'toDate', 'jobfile', 'envfile'],
  integer: ['limit', 'offset', 'batchSize']
})

const isCalledViaCommandLine = /scripts\/bulk-index(.js)?/.test(fs.realpathSync(process.argv[1]))
const dotenv = require('dotenv')
const { initializeJobState, resumeJob, enableNrInstrumentation } = require('./bulk-indexer')

// Conditionally set up NR instrumentation
// If NR is enablable..
if (isCalledViaCommandLine && process.env.NEW_RELIC_LICENSE_KEY) {
  // Build NR app-name based on envfile:
  const newrelicEnvironment = argv.envfile.includes('production') ? 'Prod' : 'QA'
  process.env.NEW_RELIC_APP_NAME = `Research Catalog Indexer (${newrelicEnvironment})`
  const newrelic = require('newrelic')

  // Overwrite `instrument` with appropriate NR function:
  const instrument = newrelic.startBackgroundTransaction.bind(newrelic)
  enableNrInstrumentation(instrument)
}

const {
  die,
  setAwsProfile,
  Timer
} = require('../utils')
const logger = require('../../lib/logger')
const { loadNyplCoreData } = require('../../lib/load-core-data.js')
const { setIndexToNoRefresh, setIndexRefresh } = require('../../lib/elastic-search/requests.js')

if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME) {
  logger.info(`Enabling NewRelic reporting for ${process.env.NEW_RELIC_APP_NAME}`)
}

const usage = () => {
  console.log([
    'Usage:',
    'Reindex a single record:',
    '  node bulk-index --envfile [path to .env] (--bibId id|--itemId id)',
    'Reindex by nypl-source:',
    '  node bulk-index --envfile [path to .env] --type (bib|item) --nyplSource SOURCE',
    'Reindex by CSV (containing prefixed ids):',
    '  node bulk-index --envfile [path to .env] --csv FILE --csvIdColumn 0',
    'Perform any reindex only for specific bib-only properties by adding the following to any reindex args: ',
    '  --properties subjectLiteral,addedAuthorTitle --skipPrefetch true  --updateOnly true'
  ].join('\n'))
  return true
}

/**
 *  Check that we have all necessary params
 *  Raise error if something's amiss.
 */
const validateParams = (argv) => {
  let message
  const updateOnly = process.env.UPDATE_ONLY === 'true' || argv.updateOnly
  const properties = process.env.PROPERTIES || argv.properties
  if ((updateOnly || properties) && !(updateOnly && properties)) {
    message = 'Must provide --properties when UPDATE_ONLY=true or --updateOnly true (and vice versa)'
  } else if (
    (
      !argv.type ||
      (
        !argv.csv && !argv.hasMarc
      )
    )
  ) {
    message = 'Insufficient params'
  }
  if (message) {
    throw new Error(message)
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

// Main dispatcher:
const run = async () => {
  // Validate args:
  try {
    validateParams(argv)
  } catch (e) {
    if (isCalledViaCommandLine) {
      usage()
      die(e)
    }
  }

  // Assume all cli args are indexer options
  const options = { ...argv }
  delete options._

  // Build a job state file based on index criteria
  const jobState = initializeJobState(options)

  if (jobState.runnable()) {
    await resumeJob(jobState)
  } else {
    logger.info(`Refusing to start ${jobState.status()} job`)
  }
}

const preflightSetup = async () => {
  setAwsProfile()
  dotenv.config({ path: argv.envfile })
  logger.setLevel(process.env.LOG_LEVEL || 'info')
  if (process.env.STOP_REFRESH === 'true') {
    await setIndexToNoRefresh()
  }
  await loadNyplCoreData()
  totalTimer.startTimer()
}

const cleanup = async () => {
  if (process.env.STOP_REFRESH === 'true') await setIndexRefresh(process.env.ELASTIC_RESOURCES_INDEX_NAME, '30s')
  // TODO: move unindexed id batches into a single file
  // if (process.env.UPDATE_ONLY || argv.updateOnly) {
  //   exec(`cat temp-unindexed-records* > unindexed-records-${(argv.properties || process.env.PROPERTIES)}-${Date.now()}.txt; rm temp-unindexed-records*`)
  // }
  totalTimer.endTimer()
  totalTimer.howMany('hours')
  // Preserve any non-zero exitCode already set (e.g. by a swallowed CSV error) instead of forcing success:
  process.exit(process.exitCode || 0)
}

const totalTimer = new Timer('bulk update')

if (isCalledViaCommandLine) {
  preflightSetup()
    .then(run)
    .catch((e) => {
      logger.error(e.message)
    })
    .finally(cleanup)
}

module.exports = {
  _testing: {
    validateParams,
    barcodeCustomerCodeMapFromCsv
  }
}
