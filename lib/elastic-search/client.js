const elasticsearch = require('@elastic/elasticsearch')
const url = require('node:url')
const logger = require('../logger')
const kms = require('../kms')

/**
 * Get an ES base client
 */
const client = () => {
  if (!this._esClient) {
    this._esClient = makeClient()
  }
  return this._esClient
}

let connectionConfig = null

/**
* Resolve a ES client (after decrypting config, if necessary)
*/
const makeClient = async () => {
  if (!connectionConfig) {
    connectionConfig = await decryptConnectionConfig()
  }
  // Parse ES connection string, which is likely multiple http base URIs
  // separated by a comma:
  const elasticUris = connectionConfig.uris.split(',')
  const urisParsed = elasticUris.map((uri) => {
    // Extract parts of the URI:
    const { protocol, auth, host } = url.parse(uri)
    const [username, password] = auth ? auth.split(':') : []
    return {
      protocol,
      host,
      username,
      password
    }
  })
  // Build ES client connection config:
  const config = {}
  config.nodes = urisParsed.map((uri) => `${uri.protocol}//${uri.host}`)

  // Configure auth:
  if (connectionConfig.apiKey) {
    // Auth with `apiKey`:
    config.auth = { apiKey: connectionConfig.apiKey }
  } else if (urisParsed[0].username) {
    // Auth with username, password:
    config.auth = { username: urisParsed[0].username, password: urisParsed[0].password }
  }

  // Log out some of the connection details for debugging purposes:
  const authMethod = urisParsed[0].username ? 'with creds' : (connectionConfig.apiKey ? 'with apiKey' : 'w/out creds')
  logger.info(`Connecting to ES at ${urisParsed.map((u) => u.host).join(',')}/${process.env.ELASTIC_RESOURCES_INDEX_NAME} ${authMethod}`)

  return new elasticsearch.Client(config)
}

/**
* Resolve a plainobject with decrypted ES config
*/
const decryptConnectionConfig = async () => {
  const [uris, apiKey] = await Promise.all(
    [
      process.env.ENCRYPTED_ELASTICSEARCH_URI,
      process.env.ENCRYPTED_ELASTICSEARCH_API_KEY
    ].map(kms.decrypt)
  )
  return {
    uris,
    apiKey
  }
}

module.exports = { client }
