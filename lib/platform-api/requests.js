const logger = require('../logger')
const { init } = require('./client')
const { bibIdentifiersForItems } = require('../stubzzz')
const { isValidResponse } = require('../utils')

const getSchema = async (schemaName) => {
  try {
    const client = await init()
    const path = `current-schemas/${schemaName}`
    const resp = await client.get(path, { authenticate: false })
    if (isValidResponse(resp)) {
      return resp
    } else {
      throw new Error({ message: 'Invalid response for GET' + path })
    }
  } catch (e) {
    logger.error('error fetching schema:\n' + e)
  }
}

const bibById = async (nyplSource, id) => {
  try {
    const client = await init()
    const resp = await client.get(`bibs/${nyplSource}/${id}`)
    if (isValidResponse(resp)) {
      return resp.data
    } else {
      logger.warning(`Warning: bib not found: ${nyplSource}/${id}`)
      return null
    }
  } catch (e) {
    logger.error('error getting bibById:\n' + e)
  }
}

const bibsForItems = async (items) => {
  const bibIdentifiers = await bibIdentifiersForItems(items)
  let bibs = await Promise.all(
    bibIdentifiers.map(async (identifier) => {
      return await bibById(identifier.nyplSource, identifier.id)
    })
  )
  bibs = bibs.filter((b) => b)

  return bibs
}

const bibsForHoldings = (holdings) => {
  return _bibIdentifiersForHoldings(holdings)
    .map((ids) => bibById(ids.nyplSource, ids.id))
}

const _bibIdentifiersForHoldings = (holdings) => {
  holdings.map((item) => {
    return item.bibIds
      .map((id) => ({ nyplSource: 'sierra-nypl', id }))
  }).flat()
}

module.exports = {
  getSchema,
  bibsForItems,
  _bibIdentifiersForHoldings,
  bibsForHoldings
}
