const es = require('./client')
const logger = require('../logger')

// takes array of JSON-ified EsBib records and indexes them to index specified in env vars
// indexing creates or overwrites existing doc
const writeRecords = async (records) => {
  logger.debug('Writing batch of ' + records.length + 'resources', records)
  try {
    const resp = await _indexGeneric(process.env.ELASTIC_RESOURCES_INDEX_NAME, records, false)
    logger.debug('resp: ', JSON.stringify(resp))
    logger.debug('Index: ' + (resp.errors ? 'Error' : 'Success'))
    return resp
  } catch (e) {
    logger.error('writeRecords error: ', e)
  }
}

// Takes index name, array of esBib records, and a boolean indicating whether 
// we want to update or index
const _indexGeneric = async (indexName, records, update) => {
  const body = []
  logger.debug('Index: Indexed ' + records.length + ' doc to ' + indexName)
  logger.debug('Indexing: ', records)

  records.forEach(function (record) {
    const uri = (typeof record.uri) === 'object' ? record.uri[0] : record.uri

    const indexStatement = { _index: indexName, _id: uri }

    indexStatement._type = 'resource'
    // No longer need the _type (and it's going to throw an error bc it's redundant??):
    delete record._type
    if (record._parent) {
      // No longer need the parent
      indexStatement.parent = record._parent
      delete record._parent
    }

    const updatedAt = Date.now()
    record.updatedAt = updatedAt

    if (update) {
      delete record.uri
      record = { doc: record }
    }

    // Is this an update or an index (index = creates or overwrites entire doc)
    const actionLine = update ? { update: indexStatement } : { index: indexStatement }
    body.push(actionLine)
    body.push(record)
  })
  try {
    const client = await es.client()
    const resp = await client.bulk({ body })
    return resp
  } catch (err) {
    logger.error('_indexGeneric error: ', err)
  }
}

module.exports = { writeRecords, internal: { _indexGeneric } }
