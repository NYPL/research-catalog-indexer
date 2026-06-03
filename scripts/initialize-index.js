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
  console.log('Usage: node mapping-check --envfile [path to .env] [--index INDEX]')
  return true
}

/**
* Main script function.
*/
exports.run = async (options = {}) => {
  const client = await esClient.client()
  const exists = (await client.indices.exists({ index: options.index })).body

  if (exists) {
    die(`Index ${options.index} exists. Exiting`)
  }

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
  const reindexRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  const oldIndex = process.env.RESOURCES_INDEX
  reindexRl.question(`copy contents of ${oldIndex} to ${options.index}? Only "yes" will trigger copy... `, async answer => {
    if (answer === 'yes') {
      console.log(`Copying contents of ${oldIndex} to ${options.index}`)
      const resp = await client.reindex({ waitForCompletion: false, body: { source: { oldIndex }, dest: { index: options.index } } })
      console.log(`Started reindex task #${resp.body.task}`)
    } else console.log('only yes will trigger reindex. Goodbye!')
    reindexRl.close()
  })
  console.log(`Don't forget to: \n\tUpdate this repo with new index\n\tUpdate Discovery API with new index\n\tUpdate browse index with ${options.index} \n\tDelete ${oldIndex}`)
  console.log('Done')
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
