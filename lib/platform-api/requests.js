const logger = require('../logger')
const platformApi = require('./client')
const { isValidResponse } = require('../utils')
const { _chunk } = require('lodash')

const HOLDINGS_CACHE = {}

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

const itemsForBib = async (bib, offset = 0, limit = 500) => {
  try {
    const path = `bibs/${bib.nyplSource}/${bib.id}/items?limit=${limit}&offset=${offset}`
    logger.debug('PlatformApi#itemsForBib: Fetch: ' + path)
    const client = await platformApi.instance()
    const resp = await client.get(path)
    if (isValidResponse(resp)) {
      logger.debug(`PlatformApi#itemsForBib: Got ${resp.data.length ? resp.data.length : 'no'} items`)
      const items = resp.data
      if (!items.length) return []
      if (items.length < limit) {
        return items
      } else {
        logger.debug(`PlatformApi#itemsForBib: paginate because received ${resp.data.length}`)
        const otherItems = await itemsForBib(bib, offset + limit, limit)
        return items.concat(otherItems)
      }
    } else {
      logger.warn(`Warning: items not found: ${path}`)
      return null
    }
  } catch (e) {
    logger.error('PlatformApi#itemsForBib error: ', e.message)
  }
}

/**
 * Given an array of bibs, resolves an array of holdings relevant to the bibs
 */
const holdingsForBibs = async (bibs) => {
  // Only fetch NYPL bibs
  try {
    const nyplBibs = bibs.filter((bib) => bib.nyplSource === 'sierra-nypl')
    const bibGroups = _chunk(nyplBibs, 25)
    logger.debug('holdingsForBibs: Fetching holdings for bibs in groups: ', bibGroups)
    const path = `holdings?bib_ids=${bibs.map((bib) => bib.id).join(',')}`
    const client = await platformApi.instance()
    return Promise.all(bibGroups.map(async (bibs) => {
      const resp = await client.get(path)
      if (isValidResponse(resp)) {
        logger.debug(`Got ${(resp.data.length ? resp.data.length : 'no')} holdings for bibs: ${bibs.map((b) => b.id).join(',')}`)
        return resp.data
      } else {
        logger.warn(`Warning: holdings not found: ${path}`)
        return null
      }
    })).flat()
  } catch (e) {
    logger.error('PlatformApi#holdingsforBibs error: ', e.message)
  }
}

const holdingsForBib = (bib) => {
  const bibIdentifier = `${bib.nyplSource}/${bib.id}`
  if (HOLDINGS_CACHE[bibIdentifier]) {
    logger.debug(`holdingsForBib: Using holdings_cache for ${bibIdentifier}`)
    return HOLDINGS_CACHE[bibIdentifier]
  } else {
    logger.debug(`holdingsForBib: Fetching holdings for bib ${bibIdentifier} via API`)
    return holdingsForBibs([bib])
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
  holdingsForBib,
  _bibIdentifiersForHoldings,
  _bibIdentifiersForItems,
  bibsForHoldingsOrItems
}
