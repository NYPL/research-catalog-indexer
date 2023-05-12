const elasticsearch = require('elasticsearch')
const kms = require('../kms')

let _client = null

const client = async (opts = {}) => {
  opts = Object.assign({
    connectionUri: process.env.ELASTICSEARCH_CONNECTION_URI
  }, opts)

  if (!_client) {
    if (!opts.connectionUri) throw new Error('Missing ELASTICSEARCH_CONNECTION_URI env variable; aborting.')

    const encrypted = opts.connectionUri
    const connectionUri = await kms.decrypt(encrypted)

    _client = new elasticsearch.Client({
      host: connectionUri
    })
  }
  return _client
}

module.exports = { client }
