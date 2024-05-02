const elasticsearch = require('@elastic/elasticsearch')
const url = require('node:url')
const logger = require('../logger')
const kms = require('../kms')

let _clientPromise = null

/**
*  Given connection options with encrypted config, resolves a singleton ES
*  client instance
*/
const client = (opts = {}) => {
  opts = Object.assign({
    connectionUri: process.env.ELASTICSEARCH_CONNECTION_URI
  }, opts)

  if (!_clientPromise) {
    _clientPromise = makeClient(opts)
  }

  return _clientPromise
}

/**
*  Given connection optinos with encrypted config, resolves a Elasticsearch
*  client
*/
const makeClient = async (opts) => {
  const connectionUri = await kms.decrypt(opts.connectionUri)

  // Parse ES connection string:
  const { protocol, auth, host, port } = url.parse(connectionUri)
  const [username, password] = auth ? auth.split(':') : []
  const options = {
    node: `${protocol}//${host}`,
    port,
    auth: { username, password }
  }
  logger.info(`Connecting to ES at ${host}:${port} ${username && password ? 'with creds' : 'w/out creds'}`)

  return new elasticsearch.Client(options)
}

module.exports = { client }
