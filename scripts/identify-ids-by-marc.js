/**
 * Export IDs by MARC Query
 *
 * This script allows you to query the BibService or ItemService by MARC tag
 * (and optionally subfield) and output the matching `id` and `nypl_source`
 * to a CSV file.
 *
 * Usage:
 *   node scripts/identify-ids-by-marc.js --envfile [path to .env] --type (bib|item) --hasMarc 001 [--hasSubfield S] --toCsv [output.csv]
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
const { to: copyTo } = require('pg-copy-streams')
const { pipeline } = require('node:stream/promises')
const kms = require('../lib/kms.js')
const logger = require('../lib/logger')
const { setAwsProfile, capitalize, die } = require('./utils')

const usage = () => {
  console.log('Usage:')
  console.log('  node scripts/identify-ids-by-marc.js --envfile [path] --type (bib|item) --hasMarc [marc] --toCsv [output.csv]')
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
      password // ,
      // query_timeout: 1000 * 60 * 5
    }
    return new Pool(config)
    // return new Client(config)
  },
  connect: (name) => db.dbConnectionPools[name].connect(),
  endPools: () => {
    return Promise.all(
      Object.values(db.dbConnectionPools).map((pool) => pool.end())
    )
  }
}

/**
 *  Given criteria, builds a SQL (string) for querying relevant db
 */
const buildSqlQuery = (options) => {
  const type = options.type
  const table = type

  const selects = [table]
  const wheres = []
  wheres.push("(is_nypl_research OR nypl_source != 'sierra-nypl')")

  if (options.nyplSource && options.nyplSource !== 'all') {
    wheres.push(`nypl_source = '${options.nyplSource}'`)
  }

  if (options.hasMarc) {
    wheres.push(`marc_tags @> ARRAY['${options.hasMarc}']`)
  }

  if (options.hasSubfield) {
    // Since we're additionally filtering on subfield, parse varfields:
    selects.push('json_array_elements(bib.var_fields::json) jV')

    // .. with matching marcTag
    wheres.push("json_typeof(bib.var_fields::json) = 'array'")
    wheres.push(`jV->>'marcTag' = '${options.hasMarc}'`)

    // .. And then parse embedded subfields:
    wheres.push("json_typeof(jV->'subfields') = 'array'")
    selects.push("json_array_elements(jV->'subfields') jVS")

    // .. To filter on matching subfield tag:
    wheres.push(`jVS->>'tag' = '${options.hasSubfield}'`)
  }

  let sqlFromAndWhere = selects.join(', ')
  if (wheres.length) {
    sqlFromAndWhere += ' WHERE ' + wheres.join(' AND ')
  }

  let query = `SELECT id, nypl_source FROM ${sqlFromAndWhere}`
  if (options.limit) {
    query += ` LIMIT ${options.limit}`
  }

  return { query, type }
}

const run = async () => {
  setAwsProfile()
  if (!argv.envfile) return usage() && die('--envfile required')
  dotenv.config({ path: argv.envfile })

  return buildCsv(argv)
}

const buildCsv = async (options) => {
  return module.exports._buildCsv(options)
}

const _buildCsv = async (options) => {
  if (!options.type) return usage() && die('--type required')
  if (!['item', 'bib'].includes(options.type)) return usage() && die('--type must be item or bib')
  if (!options.hasMarc) return usage() && die('--hasMarc required')
  if (!options.toCsv) return usage() && die('--toCsv required')

  logger.setLevel(process.env.LOG_LEVEL || 'info')

  await db.initPools()

  const { query, params, type } = buildSqlQuery(options)
  const copyQuery = [
    'COPY (',
    query,
    ') TO STDOUT WITH CSV DELIMITER \',\''
  ].join('')

  logger.info(`Querying ${capitalize(type)}Service: ${copyQuery} | ${JSON.stringify(params)}`)
  const client = await db.connect(`${type}Service`)

  try {
    const sourceStream = client.query(copyTo(copyQuery))
    const writeStream = fs.createWriteStream(options.toCsv)

    let rowsRead = 0
    sourceStream.on('data', (d) => {
      const data = Buffer.from(d).toString('utf8')
      rowsRead += data.split('\n').length - 1
      console.log(`Read ${rowsRead} rows`)
    })

    await pipeline(sourceStream, writeStream) // process.stdout)
  } catch (e) {
    console.error('Encountered sql error: ', e)
    throw e
  } finally {
    client.release()
  }

  await db.endPools()
}

module.exports = {
  buildCsv,
  buildSqlQuery,
  _buildCsv
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}
