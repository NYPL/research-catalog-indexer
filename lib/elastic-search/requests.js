const es = require('./client')
const logger = require('../logger')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { uriForRecordIdentifier } = require('../utils/uriForRecordIdentifier')

// takes array of JSON-ified EsBib records and indexes them to index specified in env vars
// indexing creates or overwrites existing doc
const writeRecords = async (records, update) => {
  if (update) logger.info('Updating partial documents')
  else logger.debug('Writing batch of ' + records.length + ' resources')

  let resp
  try {
    resp = await _indexGeneric(process.env.ELASTIC_RESOURCES_INDEX_NAME, records, update)
  } catch (e) {
    throw new Error(`Error writing to ES: ${e}`)
  }

  // If anything failed, response will set a boolean `.errors` property:
  if (resp.body.errors) {
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
    const errors = resp.body.items?.map((item) => item.index?.error)
    let message = 'Unknown error'
    if (errors) {
      message = errors
        .map((error, i) => {
          if (error) {
            const record = records[i]
            return `Error updating ${record.uri}: ` + (error.type ? `${error.type}: ${error.reason}` : error)
          }
          return null
        })
        .filter((e) => e)
        .join('; ')
    }
    logger.error(`Indexing error: ${message}`)
    throw new Error(`Error response from ES: ${message}`)
  }
  logger.debug('ES resp: ' + JSON.stringify(resp.body))
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

    const updatedAt = Date.now()
    record.updatedAt = updatedAt

    if (update) {
      // delete record.uri
      logger.info(JSON.stringify(record))
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

const currentDocument = async (bibId, index) => {
  const client = await es.client()
  const response = await client.search({
    index,
    body: {
      query: { term: { uri: bibId } }
    }
  }).catch((e) => {
    if (e.statusCode === 403) {
      logger.error(`403 from ES: ${e.body?.Message}`)
    }
    throw e
  })
  if (!response.body.hits.hits[0]) throw new Error(`Could not find ${bibId} in ${index}`)
  return response.body.hits.hits[0]._source
}

const getBibIdentifiersForItemId = async (nyplSource, itemId) => {
  const itemUri = await uriForRecordIdentifier(nyplSource, itemId, 'item')

  logger.debug(`Getting bibIds for item ${itemUri}`)

  const query = {
    nested: {
      path: 'items',
      query: {
        term: {
          'items.uri': itemUri
        }
      }
    }
  }
  const client = await es.client()
  const response = await client.search({
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME,
    body: {
      query,
      _source: ['uri']
    }
  })

  return response.body.hits.hits.map((hit) => hit._source.uri)
    .map((uri) => NyplSourceMapper.instance().splitIdentifier(uri))
}

/**
 * Issue an arbitrary query on the index:
 */
const query = async (body, extras) => {
  const client = await es.client()
  const options = Object.assign(
    { index: process.env.ELASTIC_RESOURCES_INDEX_NAME },
    { body },
    extras
  )
  return client.search(options)
}

const scroll = async (body) => {
  const client = await es.client()
  return client.scroll(body)
}

/**
 *
 * @param {string[]} ids
 * @param {string} property
 * @returns {string[]}
 */
const fetchPropertyForUris = async (ids = [], property) => {
  logger.debug(`fetching ${property} for ${ids.length} bibs`)

  const client = await es.client()
  const docs = await client.mget({
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME,
    body: {
      docs: ids.map((id) => {
        return {
          _id: id,
          _source: [property]
        }
      })
    }
  })
  return docs.body
}

module.exports = {
  fetchPropertyForUris,
  currentDocument,
  writeRecords,
  getBibIdentifiersForItemId,
  query,
  scroll,
  internal: { _indexGeneric }
}
