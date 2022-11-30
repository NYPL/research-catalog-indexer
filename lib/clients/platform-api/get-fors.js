const logger = require('../logger')
const { init } = require('./client')
const { bibIdentifiersForItems } = require('../../stubzzz')

const getSchema = async (schemaName) => {
  try {
    const client = await init()
    const resp = await client.get(`current-schemas/${schemaName}`, { authenticate: false })
    return resp
  } catch (e) {
    logger.error('error fetching schema:\n' + e)
  }
}

const bibById = async (nyplSource, id) => {
  try {
    const client = await init()
    const resp = await client.get(`bibs/${nyplSource}/${id}`)
    if (!resp || !resp.data) {
      logger.warning(`Warning: bib not found: ${nyplSource}/${id}`)
      return null
    }
    return resp.data
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
  return bibIdentifiersForHoldings(holdings)
    .map((ids) => bibById(ids.nyplSource, ids.id))
}

const bibIdentifiersForHoldings = (holdings) => {
  holdings.map((item) => {
    return item.bibIds
      .map((id) => ({ nyplSource: 'sierra-nypl', id }))
  }).flat()
}

module.exports = {
  getSchema,
  bibsForItems,
  bibIdentifiersForHoldings,
  bibsForHoldings
}
