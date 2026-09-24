/**
 * Export IDs by MARC Query
 *
 * This script allows you to query the BibService or ItemService by MARC tag
 * (and optionally subfield) and output the matching `id` and `nypl_source`
 * to a CSV file.
 *
 * Usage:
 *   node scripts/export-ids-by-marc.js --envfile [path to .env] --type (bib|item) --hasMarc 001 [--hasSubfield S] --toCsv [output.csv]
 */

const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2), {
  default: {
    batchSize: 1000,
    nyplSource: 'sierra-nypl'
  },
  string: ['hasMarc', 'hasSubfield', 'type', 'toCsv', 'nyplSource', 'envfile'],
  integer: ['limit', 'batchSize']
})
const dotenv = require('dotenv')
const { Pool } = require('pg')
const Cursor = require('pg-cursor')
const kms = require('../lib/kms.js')
const logger = require('../lib/logger')
const { setAwsProfile, capitalize, printProgress, die } = require('./utils')

const usage = () => {
  console.log('Usage:')
  console.log('  node scripts/export-ids-by-marc.js --envfile [path] --type (bib|item) --hasMarc [marc] --toCsv [output.csv]')
  return true
}

const db = {
  dbConnectionPools: null,
  initPools: async () => {
    db.dbConnectionPools = {
      itemService: await db.initPool('ITEM'),
      bibService: await db.initPool('BIB')
    }
  },
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
      password,
      query_timeout: 1000 * 60 * 5
    }
    return new Pool(config)
  },
  connect: (name) => db.dbConnectionPools[name].connect(),
  endPools: () => {
    return Promise.all(
      Object.values(db.dbConnectionPools).map((pool) => pool.end())
    )
  }
}

const buildSqlQuery = (options) => {
  const type = options.type
  const table = type

  const selects = [table]
  const wheres = []
  const params = []

  if (options.nyplSource && options.nyplSource !== 'all') {
    params.push(options.nyplSource)
    wheres.push(`nypl_source = $${params.length}`)
  }

  if (options.hasMarc) {
    selects.push('json_array_elements(var_fields::json) jV')
    params.push(options.hasMarc)
    wheres.push(`jV->>'marcTag' = $${params.length}`)
  }

  if (options.hasSubfield) {
    selects.push("json_array_elements(jV->'subfields') jVS")
    params.push(options.hasSubfield)
    wheres.push(`jVS->>'tag' = $${params.length}`)
  }

  let sqlFromAndWhere = selects.join(',\n')
  if (wheres.length) {
    sqlFromAndWhere += '\nWHERE ' + wheres.join('\nAND ')
  }

  let query = `SELECT DISTINCT id, nypl_source FROM ${sqlFromAndWhere}`
  if (options.limit) {
    query += ` LIMIT ${options.limit}`
  }

  return { query, params, type }
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

const run = async () => {
  setAwsProfile()
  if (!argv.envfile) return usage() && die('--envfile required')
  if (!argv.type) return usage() && die('--type required')
  if (!['item', 'bib'].includes(argv.type)) return usage() && die('--type must be item or bib')
  if (!argv.hasMarc) return usage() && die('--hasMarc required')
  if (!argv.toCsv) return usage() && die('--toCsv required')

  dotenv.config({ path: argv.envfile })
  logger.setLevel(process.env.LOG_LEVEL || 'info')

  await db.initPools()

  const { query, params, type } = buildSqlQuery(argv)

  logger.info(`Querying ${capitalize(type)}Service: ${query} | ${JSON.stringify(params)}`)
  const client = await db.connect(`${type}Service`)
  const cursor = client.query(new Cursor(query, params))

  let count = 0
  const startTime = new Date()
  let done = false

  while (!done && (!argv.limit || count < argv.limit)) {
    let rows
    try {
      rows = await readCursorRecurser(argv.batchSize, cursor)
    } catch (e) {
      cursor.close(() => client.release())
      throw e
    }

    if (rows.length === 0) {
      logger.info(`Cursor reached the end. Stopping after ${count} processed.`)
      done = true
      break
    }

    fs.appendFileSync(argv.toCsv, rows.map(row => `${row.id},${row.nypl_source}\n`).join(''))
    count += rows.length
    printProgress(count, argv.limit, argv.batchSize, startTime)
  }

  await new Promise((resolve) => {
    cursor.close(() => {
      client.release()
      resolve()
    })
  })
  await db.endPools()
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}

module.exports = {
  buildSqlQuery
}
