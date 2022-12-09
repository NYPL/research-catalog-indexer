// configure(opts) : Call with an opts hash containing config vars to configure the client. Must support "connectionUri", giving the URI of ES domain
// writeRecords(bibs): Given an array of bibs, should add updatedAt timestamp properties to each document, and write the resources in bulk mode to the ES index. See the existing method for guidance. ) Method should resolve the ES response.
const elasticsearch = require('elasticsearch')
const kms = require('../kms')
const logger = require('../logger')

let client = null
let connectionUri = null

const _client = async (opts) => {
  if (!client) {
    connectionUri = await kms.decryptElasticCreds()
    client = new elasticsearch.Client({
      host: connectionUri
    })
  }
  return client
}

const writeRecords = async (records) => {
  logger.debug('Writing batch of ' + records.length + 'resources', records)
  try {
    return await _indexGeneric(process.env.ELASTIC_RESOURCES_INDEX_NAME, records, false)
  } catch (e) {
    logger.error('writeRecords error: ', e)
  }
}

const _indexGeneric = async (indexName, records, update) => {
  const body = []
  logger.debug('Index: Indexed ' + records.length + ' doc to ' + indexName)
  logger.debug('Indexing: ', records)

  records.forEach(function (record) {
    const uri = (typeof record.uri) === 'object' ? record.uri[0] : record.uri

    const indexStatement = { _index: indexName, _id: uri }

    // when would type be anything but resource?
    indexStatement._type = record._type ? record._type : 'resource'
    // No longer need the _type (and it's going to throw an error bc it's redundant??):
    delete record._type
    if (record._parent) {
      // No longer need the parent
      indexStatement.parent = record._parent
      delete record._parent
    }

    if (update) {
      delete record.uri
      record = { doc: record }
    }

    const updatedAt = (new Date()).getTime()
    record.updatedAt = updatedAt

    // Is this an update or an index (creates or overwrites entire doc)
    const actionLine = update ? { update: indexStatement } : { index: indexStatement }
    body.push(actionLine)
    body.push(record)
  })
  try {
    const resp = await _client().bulk({ body })
    logger.debug('resp: ', JSON.stringify(resp))
    // do we want to throw if there are any errors? or retry errored records?
    // old code has promise.reject on any error, but what do we want to happen?
    if (!resp.errors) logger.debug('Index success')
  } catch (err) {
    logger.error('_indexGeneric error: ', err)
  }
}

module.exports = { writeRecords, internal: { _client, _indexGeneric } }
