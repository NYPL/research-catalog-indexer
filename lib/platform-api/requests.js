const logger = require('../logger')
const platformApi = require('./client')
const { isValidResponse, unique, uniqueObjectsByHash } = require('../utils')
const { chunk } = require('lodash')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('../prefilter')
const { getBibIdentifiersForItemId } = require('../elastic-search/requests')

/**
 *
 *  Given an array of barcodes, resolves a map relating barcoes to M2 customer
 *  codes (if found).
 */
const m2CustomerCodesForBarcodes = async (barcodes, offset = 0, map = {}, batchSize = 200) => {
  if (!barcodes || barcodes.length === 0) return {}
  // Batch calls to the m2-customer-code-store in groups of 200 barcodes:

  const barcodesBatch = barcodes.slice(offset, offset + batchSize)
  const client = await platformApi.client()
  const response = await client.get(`m2-customer-codes?barcodes=${barcodesBatch.join(',')}`)

  // Convert response to a map relating barcode to CC:
  const responseAsMap = response.status === 400
    ? {}
    : response.data.reduce((h, result) => {
      return Object.assign(h, { [result.barcode]: result.m2CustomerCode })
    }, {})
  // Merge this map with the map built from previous batched calls:
  map = Object.assign(map, responseAsMap)

  // If there are no more batches to fetch, return map
  if (barcodes.length <= offset + batchSize) {
    return map
  } else {
    // There are more batches to fetch; recurse:
    return m2CustomerCodesForBarcodes(barcodes, offset + batchSize, map, batchSize)
  }
}

const getSchema = async (schemaName) => {
  try {
    const client = await platformApi.client()
    const path = `current-schemas/${schemaName}`
    logger.info('path', typeof path, path)
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

const holdingById = async (id) => {
  try {
    const client = await platformApi.client()
    const resp = await client.get(`holdings/${id}`)
    if (resp) {
      return resp
    } else {
      logger.warn(`Warning: holding not found: ${id}`)
      return null
    }
  } catch (e) {
    logger.error('PlatformApi#holdingById error:\n', e)
  }
}

const itemById = async (nyplSource, id) => {
  try {
    const client = await platformApi.client()
    const resp = await client.get(`items/${nyplSource}/${id}`)
    if (isValidResponse(resp)) {
      return resp.data
    } else {
      logger.warn(`Warning: item not found: ${nyplSource}/${id}`)
      return null
    }
  } catch (e) {
    logger.error('PlatformApi#itemById error:\n', e)
  }
}

const bibById = async (nyplSource, id) => {
  try {
    const client = await platformApi.client()
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
    const client = await platformApi.client()
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
    if (e.name === 'TokenRefreshError') {
      throw e
    }
    logger.error('PlatformApi#_itemsForOneBib error: ', e.message, e)
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
    bibs.forEach((bib, i) => {
      // The holdings for the bib are the ones with a matching bibId:
      const holdings = holdingsArray.filter((h) => {
        // The holding.bibIds array appears to be integers, whereas bib.id is
        // a string, so coerce as strings for comparison:
        return h.bibIds.some((bibId) => String(bibId) === String(bib.id))
      })
      bib._holdings = holdings
        // Ensure each holding has reverse reference to bib:
        .map((holding) => {
          holding._bibs = [bib]
          return holding
        })

      // The items for bibs[i] is the set of items at itemsArray[i]:
      bib._items = (itemsArray[i] || [])
        // Ensure each item has reverse reference to bib:
        .map((item) => {
          item._bibs = [bib]
          return item
        })
    })

    return bibs
  } catch (e) {
    logger.error('PlatformApi#modelPrefetch error: ', e)
  }
}

/**
 * Given an array of bibs, resolves a nested array of items relevant to the bibs
 */
const _itemsForArrayOfBibs = async (bibs) => {
  try {
    return Promise.all(bibs.map(async (bib) => {
      const items = await _itemsForOneBib(bib)
      logger.debug(`Fetched ${(items || []).length} item(s) for ${bib.nyplSource}/${bib.id}`)
      return filteredSierraItemsForItems(items)
    }))
  } catch (e) {
    logger.error('PlatformApi#_itemsForArrayOfBibs error: ', e.message)
  }
}

/**
 * Given an array of bibs, resolves a flat array of holdings relevant to the bibs
 */
const _holdingsForBibs = async (bibs) => {
  if (!bibs || bibs.length === 0) return []

  try {
    const nyplBibIds = bibs
      .filter((bib) => bib.nyplSource === 'sierra-nypl')
      .map((bib) => bib.id)
    const bibIdGroups = chunk(nyplBibIds, 25)
    logger.debug(`_holdingsForBibs: Fetching holdings for bibs in ${bibIdGroups.length} group(s): ` +
      bibIdGroups.map((group) => group.join(',')).join('; ')
    )
    const client = await platformApi.client()
    const holdings = await Promise.all(bibIdGroups.map(async (bibIds) => {
      const path = `holdings?bib_ids=${bibIds.join(',')}`
      const resp = await client.get(path)
      if (resp && Array.isArray(resp)) {
        logger.debug(`Got ${(resp.length ? resp.length : 'no')} holdings for bibs: ${bibIds.join(',')}`)
        return resp
      } else {
        logger.warn(`Warning: holdings not found: ${path}`)
        return null
      }
    }))

    const flattenedHoldings = holdings
      .flat()
      .filter(holding => holding)
    return filteredSierraHoldingsForHoldings(flattenedHoldings)
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

/**
 *  Given a {SierraHolding[]}, returns an array bib identifiers in the form of
 *  plainobjects that define:
 *   - {string} nyplSource
 *   - {string} id
 *
 *  Identifiers are de-duped
 */
const _bibIdentifiersForHoldings = (holdings) => {
  return unique(
    holdings
      .map((holding) => holding.bibIds)
      .flat()
  )
    .map((id) => ({ nyplSource: 'sierra-nypl', id }))
}

/**
 *  Given a {SierraItem[]}, returns an array bib identifiers in the form of
 *  plainobjects that define:
 *   - {string} nyplSource
 *   - {string} id
 *
 *  Identifiers are de-duped
 */
const _bibIdentifiersForItems = async (items) => {
  let identifiers = await Promise.all(
    items.map(async (item) => {
      if (item.bibIds && Array.isArray(item.bibIds) && item.bibIds.length > 0) {
        return item.bibIds
          .map((id) => ({ nyplSource: item.nyplSource, id }))
      } else {
        // No bibIds? Probably a deleted item. Look up bibIds via DiscoveryAPI
        return await getBibIdentifiersForItemId(item.nyplSource, item.id)
      }
    })
  )
  // Turn this array of arrays of identifiers into an array of identifiers
  identifiers = identifiers.flat()
    // And remove any for which we couldn't resolve a bibId
    .filter((identifier) => identifier)

  // De-dupe:
  return uniqueObjectsByHash(identifiers, (ident) => [ident.nyplSource, ident.id].join('🎸'))
}

module.exports = {
  getSchema,
  bibById,
  holdingById,
  itemById,
  modelPrefetch,
  _itemsForOneBib,
  _holdingsForBibs,
  _bibIdentifiersForHoldings,
  _bibIdentifiersForItems,
  bibsForHoldingsOrItems,
  m2CustomerCodesForBarcodes
}
