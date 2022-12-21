const logger = require('../logger')
const platformApi = require('./client')
const { isValidResponse } = require('../utils')

const getSchema = async (schemaName) => {
  try {
    const client = await platformApi.instance()
    const path = `current-schemas/${schemaName}`
    const resp = await client.get(path, { authenticate: false })
    if (isValidResponse(resp)) {
      return resp.data
    } else {
      throw new Error('Invalid response for GET ' + path)
    }
  } catch (e) {
    logger.error('PlatformApi#getSchema error: ' + e.message)
  }
}

const bibById = async (nyplSource, id) => {
  try {
    const client = await platformApi.instance()
    const resp = await client.get(`bibs/${nyplSource}/${id}`)
    if (isValidResponse(resp)) {
      return resp.data
    } else {
      logger.warn(`Warning: bib not found: ${nyplSource}/${id}`)
      return null
    }
  } catch (e) {
    logger.error('PlatformApi#bibById error:\n' + e.message)
  }
}

const itemsForBib = async (bib, offset = 0) => {
  try {
    const limit = 500
    const path = `bibs/${bib.nyplSource}/${bib.id}/items?limit=${limit}&offset=${offset}`
    logger.debug('PlatformApi#itemsForBib: Fetch: ' + path)
    const client = await platformApi.instance()
    const resp = await client.get(path)
    if (isValidResponse(resp)) {
      logger.debug(`PlatformApi#itemsForBib: Got ${resp.data.length} items`)
      const items = resp.data
      if (items.length < limit) {
        return items
      } else {
        logger.debug(`PlatformApi#itemsForBib: paginate because received ${resp.data.length}`)
        const otherItems = await itemsForBib(bib, offset + limit)
        return items.concat(otherItems)
      }
    } else {
      logger.debug('PlatformApi#itemsForBib: Got no items')
      return []
    }
  } catch (e) {
    logger.error('PlatformApi#itemsForBib error: ', e.message)
  }
}

const bibsForHoldingsOrItems = async (type, records) => {
  const getBibIdentifiers = type === 'Holding' ? _bibIdentifiersForHoldings : _bibIdentifiersForItems
  const bibIdentifiers = await getBibIdentifiers(records)
  let bibs = await Promise.all(
    bibIdentifiers.map((identifier) => {
      return bibById(identifier.nyplSource, identifier.id)
    })
  )
  bibs = bibs.filter((b) => b)

  return bibs
}


const _bibIdentifiersForHoldings = (holdings) => {
  return holdings.map((holding) => {
    return holding.bibIds
      .map((id) => ({ nyplSource: 'sierra-nypl', id }))
  }).flat()
}

const _bibIdentifiersForItems = async (items) => {
  const ids = await Promise.all(items.map((i) => Promise.resolve([{ id: 'b' + i.id, nyplSource: 'Tatooine' }])))
  return ids.flat()
}

module.exports = {
  getSchema,
  bibById,
  itemsForBib,
  _bibIdentifiersForHoldings,
  _bibIdentifiersForItems,
  bibsForHoldingsOrItems
}
