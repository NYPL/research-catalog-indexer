const elasticsearch = require('elasticsearch')
const kms = require('../kms')

let _client = null
let connectionUri = null

const client = async (opts) => {
  if (!_client) {
    if (!process.env.ELASTICSEARCH_CONNECTION_URI && !(opts && opts.connectionUri)) throw new Error('Missing ELASTICSEARCH_CONNECTION_URI env variable; aborting.')
    const encrypted = process.env.ELASTICSEARCH_CONNECTION_URI
    connectionUri = await kms.decrypt(encrypted)
    _client = new elasticsearch.Client({
      host: connectionUri
    })
  }
  return _client
}

module.exports = { client }
