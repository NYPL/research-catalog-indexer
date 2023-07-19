/**
 *  Rebuild Elasticsearch document by for the named bib by retrieving Bib
 *  record from Bib Service, encoding it, and pushing it through Bib stream.
 *  Optionally does same for all descendent holdings and items.
 *
 *  Usage:
 *    node scripts/reindex-record --envfile [config file] --all --uri [uri]
 *
 *  Req. Params:
 *    `--envfile`: Specifies path to config file containing encrypted platform
 *                 api creds and elasticsearch endpint
 *    `--uri`: The bibId
 *
 *  Opt. Params:
 *    `--all`: When used, instructs script to also push all holdings and items
 *    `--dryrun`: If set, fetches data and talks about writing to streams
 *                without actually doing so
 *
 *  Example:
 *
 *  // To reindex b10128427 from QA Bib and Item services into QA ES index:
 *  node scripts/reindex-record --envfile config/qa.env --all --uri b10128427
 */

const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')
const NyplStreamsClient = require('@nypl/nypl-streams-client')

const { bibById, modelPrefetch } = require('../lib/platform-api/requests')
const { awsInit, die } = require('./utils')

const argv = require('minimist')(process.argv.slice(2))

const dotenv = require('dotenv')

const usage = () => {
  console.log('Usage: node reindex-record --uri [bnum/inum/hnum] --envfile [path to .env]')
  return true
}

if (!argv.envfile) usage() && die('--envfile required')

dotenv.config({ path: argv.envfile })

const logger = require('../lib/logger')
logger.setLevel(process.env.LOG_LEVEL || 'info')

const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: process.env.NYPL_API_BASE_URL })

const writeToStream = (schemaName, records) => {
  if (records.length === 0) return Promise.resolve()

  const streamName = `${schemaName}-${process.env.STREAM_ENVIRONMENT}`
  if (argv.dryrun) {
    console.log(`DRYRUN: Would write ${records.length} ${schemaName} records to ${streamName}`)
    return Promise.resolve()
  } else {
    return streamsClient.write(streamName, records, { avroSchemaName: schemaName })
  }
}

const reindexBib = async (nyplSource, id) => {
  awsInit()

  const bib = await bibById(nyplSource, id)
  const [{ _items: items, _holdings: holdings }] = await modelPrefetch([bib])

  console.log('Reindexing bib' + (argv.all ? ` and ${items.length} item(s), ${holdings.length} holding(s)` : ''))

  let streamTasks = [
    writeToStream('Bib', [bib])
  ]
  if (argv.all) {
    streamTasks = streamTasks.concat([
      writeToStream('Item', items),
      writeToStream('Holding', holdings)
    ])
  }
  await Promise.all(streamTasks)
  console.log('Finished writing all records to streams')
}

if (argv.uri) {
  const { id, type, nyplSource } = (new NyplSourceMapper()).splitIdentifier(argv.uri)
  switch (type) {
    case 'bib':
      reindexBib(nyplSource, id)
      break
  }
} else usage()
