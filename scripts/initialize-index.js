/**
* Script to initialize a new resources index. Includes creation, settings,
* and mappings initialization.
*
* Usage:
*   node scripts/initialize-index --envfile CONFIG --index INDEX
*/
const dotenv = require('dotenv')
const fs = require('fs')
const readline = require('node:readline')

const argv = require('minimist')(process.argv.slice(2))
const logger = require('../lib/logger')
const esClient = require('../lib/elastic-search/client')
const { schema } = require('../lib/elastic-search/index-schema')
const { die, setAwsProfile } = require('./utils')
const indexSettings = require('../lib/elastic-search/index-settings.json')

const usage = () => {
  console.log('Usage: node scripts/initialize-index.js --envfile [path to .env] [--index INDEX]')
  return true
}

/**
* Main script function.
*/
exports.run = async (options = {}) => {
  const client = await esClient.client()
  const exists = (await client.indices.exists({ index: options.index })).body

  if (exists) {
    console.log(`Index ${options.index} exists.`)
  } else {
    console.log(`Initializing ${options.index}`)

    await client.indices.create({
      index: options.index,
      body: {
        settings: indexSettings,
        mappings: {
          dynamic: 'strict',
          properties: schema()
        }
      }
    })
    console.log(`Index ${options.index} initialized.`)
  }
  await optionallyCopyContentsToNewIndex(options.index)
}

const optionallyCopyContentsToNewIndex = async (newIndexName) => {
  const client = await esClient.client()
  const reindexRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  const oldIndex = process.env.ELASTIC_RESOURCES_INDEX_NAME
  await reindexRl.question(`copy contents of ${oldIndex} to ${newIndexName}? Only "yes" will trigger copy... `, async answer => {
    if (answer === 'yes') {
      console.log(`Copying contents of ${oldIndex} to ${newIndexName}`)
      const resp = await client.reindex({ waitForCompletion: false, body: { source: { index: oldIndex }, dest: { index: newIndexName } } })
      console.log(`Started reindex task ${resp.body.task}`)
      console.log(`Don't forget to: \n\tUpdate this repo with ${newIndexName}\n\tUpdate Discovery API with ${newIndexName} after verifying with the mapping-check.js script in that repo\n\tUpdate index alias with ${newIndexName} (referenced by browse-term-indexer\n\tDelete ${oldIndex}`)
    } else console.log('only yes will trigger reindex. Goodbye!')
    reindexRl.close()
  })
}

const isCalledViaCommandLine = /scripts\/initialize-index(.js)?/.test(fs.realpathSync(process.argv[1]))
if (isCalledViaCommandLine) {
  setAwsProfile()
  if (!argv.envfile) usage() && die('--envfile required')
  if (!argv.index) usage() && die('--index required')

  dotenv.config({ path: argv.envfile })
  logger.setLevel(process.env.LOG_LEVEL || 'info')

  exports.run(argv)
}
