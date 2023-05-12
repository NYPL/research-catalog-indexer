const es = require('./client')
const logger = require('../logger')

// takes array of JSON-ified EsBib records and indexes them to index specified in env vars
// indexing creates or overwrites existing doc
const writeRecords = async (records) => {
  logger.debug('Writing batch of ' + records.length + ' resources')

  let resp
  try {
    resp = await _indexGeneric(process.env.ELASTIC_RESOURCES_INDEX_NAME, records, false)
  } catch (e) {
    throw new Error(`Error writing to ES: ${e}`)
  }

  // If anything failed, response will set a boolean `.errors` property:
  if (resp.errors) {
    /**
     *  The response from an ES bulk write is an object that defines an `items`
     *  array of objects, where each object represents the result of an action
     *  (e.g. index, update, delete, create).
     *
     *  See https://www.elastic.co/guide/en/elasticsearch/reference/5.3/docs-bulk.html
     *
     *  The structure is basically:
     *   items:
     *    - index:
     *        error:
     *         - type: some-es-error
     *           reason: Failure to do the thing
     *    - delete:
     *        error: ...
     *
     *  We're interested in the `items` object that defines an "index" key
     *  (indicating it represents the result of index operation). That object
     *  will have a `error` array of objects having a `type` and `reason`
     *  properties.
     */
    const errors = resp.items?.map((item) => item.index?.error)
    let message = 'Unknown error'
    if (errors) {
      message = errors.map((error) => `${error.type}: ${error.reason}`)
        .join('; ')
    }
    logger.error(`Indexing error: ${message}`)
    throw new Error(`Error response from ES: ${message}`)
  }
  logger.debug('ES resp: ' + JSON.stringify(resp))
  return resp
}

// Takes index name, array of esBib records, and a boolean indicating whether
// we want to update or index
const _indexGeneric = async (indexName, records, update) => {
  const body = []
  logger.debug('Index: Indexed ' + records.length + ' doc to ' + indexName)

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
