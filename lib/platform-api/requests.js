const logger = require('../logger')
const platformApi = require('./client')
const { isValidResponse } = require('../utils')
const { chunk } = require('lodash')

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
    logger.error('PlatformApi#getSchema error: ', e)
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
    logger.error('PlatformApi#bibById error:\n', e)
  }
}

/**
 * Given a single bib, returns all items associated with that bib.
 * Recurses unless less items than specified in the limit are included.
 * Offset and limit are configurable, but mostly for testing.
 */
const _itemsForOneBib = async (bib, offset = 0, limit = 500) => {
  try {
    const path = `bibs/${bib.nyplSource}/${bib.id}/items?limit=${limit}&offset=${offset}`
    logger.debug('PlatformApi#_itemsForOneBib: Fetch: ' + path)
    const client = await platformApi.instance()
    const resp = await client.get(path)
    if (isValidResponse(resp)) {
      logger.debug(`PlatformApi#_itemsForOneBib: Got ${resp.data.length ? resp.data.length : 'no'} items`)
      const items = resp.data
      if (!items.length) return []
      if (items.length < limit) {
        return items
      } else {
        logger.debug(`PlatformApi#_itemsForOneBib: paginate because received ${resp.data.length}`)
        const otherItems = await _itemsForOneBib(bib, offset + limit, limit)
        return items.concat(otherItems)
      }
    } else {
      logger.warn(`Warning: items not found: ${path}`)
      return null
    }
  } catch (e) {
    logger.error('PlatformApi#_itemsForOneBib error: ', e.message)
  }
}

/**
 * Given an array of bibs, resolves the same array with items and
 * holdings attached.
 */
const modelPrefetch = async (bibs) => {
  bibs = bibs.map((bib) => {
    bib._holdings = []
    bib._items = []
    return bib
  })
  try {
    const [holdingsArray, itemsArray] = await Promise.all([_holdingsForBibs(bibs), _itemsForArrayOfBibs(bibs)])
    bibs.forEach((bib) => {
      const holdings = holdingsArray.filter((h) => {
        return h.bibIds.some((bibId) => bibId === bib.id)
      }
      )
      bib._holdings = bib._holdings.concat(holdings)
    })
    itemsArray.forEach((_items, i) => {
      const bib = bibs[i]
      bib._items.push(_items)
    })
  } catch (e) {
    logger.error('PlatformApi#modelPrefetch error: ', e)
  }
}

/**
 * Given an array of bibs, resolves a nested array of items relevant to the bibs
 */
const _itemsForArrayOfBibs = async (bibs) => {
  try {
    const nyplBibs = bibs.filter((bib) => bib.nyplSource === 'sierra-nypl')
    return Promise.all(nyplBibs.map(async (bib) => {
      const items = await platformApi._itemsForOneBib(bib)
      return items
    }))
  } catch (e) {
    logger.error('PlatformApi#_itemsForArrayOfBibs error: ', e.message)
  }
}

/**
 * Given an array of bibs, resolves a flat array of holdings relevant to the bibs
 */
const _holdingsForBibs = async (bibs) => {
  try {
    const nyplBibs = bibs.filter((bib) => bib.nyplSource === 'sierra-nypl')
    const bibGroups = chunk(nyplBibs, 25)
    logger.debug('_holdingsForBibs: Fetching holdings for bibs in groups: ', bibGroups)
    const client = await platformApi.instance()
    const holdings = await Promise.all(bibGroups.map(async (bibs) => {
      const path = `holdings?bib_ids=${bibs.map((bib) => bib.id).join(',')}`
      const resp = await client.get(path)
      if (isValidResponse(resp)) {
        logger.debug(`Got ${(resp.data.length ? resp.data.length : 'no')} holdings for bibs: ${bibs.map((b) => b.id).join(',')}`)
        return resp.data
      } else {
        logger.warn(`Warning: holdings not found: ${path}`)
        return null
      }
    }))
    return holdings.flat()
  } catch (e) {
    logger.error('PlatformApi#_holdingsforBibs error: ', e)
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
  modelPrefetch,
  _itemsForOneBib,
  _holdingsForBibs,
  _bibIdentifiersForHoldings,
  _bibIdentifiersForItems,
  bibsForHoldingsOrItems
}
