/**
* Script to initialize a new resources index. Includes creation, settings,
* and mappings initialization.
*
* Usage:
*   node scripts/initialize-index --envfile CONFIG --index INDEX
*/
const dotenv = require('dotenv')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))
const logger = require('../lib/logger')
const esClient = require('../lib/elastic-search/client')
const { schema } = require('../lib/elastic-search/index-schema')
const { awsCredentialsFromIni, die } = require('./utils')
const { setCredentials: kmsSetCredentials } = require('../lib/kms')
const indexSettings = require('../lib/elastic-search/index-settings.json')

const usage = () => {
  console.log('Usage: node mapping-check --envfile [path to .env] [--index INDEX]')
  return true
}

// Ensure we're looking at the right profile
const awsCreds = awsCredentialsFromIni()
kmsSetCredentials(awsCreds)

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
        properties: schema()
      }
    }
  })

  console.log('Done')
}

const isCalledViaCommandLine = /scripts\/initialize-index(.js)?/.test(fs.realpathSync(process.argv[1]))
if (isCalledViaCommandLine) {
  if (!argv.envfile) usage() && die('--envfile required')
  if (!argv.index) usage() && die('--index required')

  dotenv.config({ path: argv.envfile })
  logger.setLevel(process.env.LOG_LEVEL || 'info')

  exports.run(argv)
}
