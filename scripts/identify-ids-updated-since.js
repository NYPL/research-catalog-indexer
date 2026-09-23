/**
 * Build a CSV of distinct bib ids (id,nyplSource) that need reindexing because
 * their bib, item, or holding record was updated since a given timestamp.
 *
 * A bib needs reindexing if:
 *  - the bib record itself was updated, OR
 *  - one of its items was updated OR
 *  - one of its holdings was updated (holdings only apply to sierra-nypl bibs?)
 *
 * The resulting CSV is in the shape bulk-index.js expects:
 *   id,nyplSource
 *
 * Usage:
 *   node scripts/identify-ids-updated-since.js --since 2026-09-14T10:00:00-04:00 \
 *     --envfile config/production-bulk-index.env --outfile updated-bib-ids.csv
 *
 */
const fs = require('fs')
const dotenv = require('dotenv')
const { Pool } = require('pg')
const Cursor = require('pg-cursor')
const kms = require('../lib/kms.js')
const logger = require('../lib/logger')
const { setAwsProfile, printProgress, die } = require('./utils')

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    outfile: './updated-bib-ids.csv',
    batchSize: 5000,
    holdingsDateColumn: 'updatedDate',
    queryTimeoutMinutes: 5
  },
  string: ['since', 'envfile', 'outfile']
})

const usage = () => {
  console.log('Usage:')
  console.log('  node scripts/identify-ids-updated-since.js --envfile [path] --since [timestamp] --outfile [output.csv]')
  return true
}

const db = {
  dbConnectionPools: null,
  initPools: async () => {
    db.dbConnectionPools = {
      itemService: await db.initPool('ITEM'),
      bibService: await db.initPool('BIB'),
      holdingsService: await db.initPool('HOLDINGS')
    }
  },
  initPool: async (prefix) => {
    const [user, password, host] = await Promise.all([
      kms.decrypt(process.env[`${prefix}_SERVICE_DB_USER`]),
      kms.decrypt(process.env[`${prefix}_SERVICE_DB_PW`]),
      kms.decrypt(process.env[`${prefix}_SERVICE_DB_HOST`])
    ]).catch((e) => {
      logger.error('Error decrypting db config. Be sure to specify an --envfile with encrypted db connection info.', e)
      process.exit(1)
    })
    const config = {
      user,
      host,
      database: process.env[`${prefix}_SERVICE_DB_NAME`],
      password,
      query_timeout: 1000 * 60 * argv.queryTimeoutMinutes
    }
    return new Pool(config)
  },
  connect: (name) => db.dbConnectionPools[name].connect(),
  endPools: () => Promise.all(Object.values(db.dbConnectionPools).map((pool) => pool.end()))
}

const readCursorRecurser = async (batchSize, cursor, retry = 1) => {
  if (retry > 3) throw new Error('Error connecting to db after 3 tries')
  try {
    return await cursor.read(batchSize)
  } catch (e) {
    logger.warn('readCursorRecursor error: ', e)
    logger.info(`readCursorRecursor retry #${retry}`)
    return await readCursorRecurser(batchSize, cursor, ++retry)
  }
}

const streamQuery = async (poolName, query, params, onBatch) => {
  logger.info(`Querying ${poolName}: ${query} | ${JSON.stringify(params)}`)
  const client = await db.connect(poolName)
  const cursor = client.query(new Cursor(query, params))

  let count = 0
  const startTime = new Date()
  let done = false
  while (!done) {
    const rows = await readCursorRecurser(argv.batchSize, cursor)
    if (rows.length === 0) {
      done = true
      break
    }
    onBatch(rows)
    count += rows.length
    printProgress(count, null, argv.batchSize, startTime)
  }

  await new Promise((resolve) => cursor.close(() => {
    client.release()
    resolve()
  }))
}

const run = async () => {
  setAwsProfile()
  if (!argv.envfile) return usage() && die('--envfile required')
  if (!argv.since && !argv.inspect) return usage() && die('--since required (e.g. --since 2026-09-14T10:00:00-04:00)')

  dotenv.config({ path: argv.envfile })
  logger.setLevel(process.env.LOG_LEVEL || 'info')

  await db.initPools()

  // dedupe across all three sources, keyed by `${nyplSource}/${id}`
  const seenKeys = new Set()
  fs.writeFileSync(argv.outfile, '')
  const appendNewBibs = (pairs) => {
    const newLines = pairs
      .filter(({ id, nyplSource }) => id != null && nyplSource != null)
      .filter(({ id, nyplSource }) => {
        const key = `${nyplSource}/${id}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })
      .map(({ id, nyplSource }) => `${id},${nyplSource}\n`)
    if (newLines.length) fs.appendFileSync(argv.outfile, newLines.join(''))
  }

  // bibs
  await streamQuery(
    'bibService',
    'SELECT id, nypl_source FROM bib WHERE updated_date >= $1',
    [argv.since],
    (rows) => appendNewBibs(rows.map((row) => ({ id: row.id, nyplSource: row.nyplSource || row.nypl_source })))
  )

  // items updated from their parent bib(s)
  await streamQuery(
    'itemService',
    'SELECT bib_ids, nypl_source FROM item WHERE updated_date >= $1',
    [argv.since],
    (rows) => appendNewBibs(rows.flatMap((row) => (row.bibIds || row.bib_ids || []).map((bibId) => ({ id: bibId, nyplSource: row.nyplSource || row.nypl_source }))))
  )

  // holdings updated from their parent bib(s) (holdings only apply to sierra-nypl bibs)
  await streamQuery(
    'holdingsService',
    `SELECT "bibIds" FROM records WHERE "${argv.holdingsDateColumn}" >= $1`,
    [argv.since],
    (rows) => appendNewBibs(rows.flatMap((row) => (row.bibIds || []).map((bibId) => ({ id: bibId, nyplSource: 'sierra-nypl' }))))
  )

  await db.endPools()

  logger.info(`Wrote ${seenKeys.size} bib ids to ${argv.outfile}`)
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}

module.exports = { db }
