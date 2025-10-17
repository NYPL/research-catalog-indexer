const platformApi = require('./platform-api/requests')
const prefetch = require('./prefetch')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('./prefilter')
const EsBib = require('./es-models/bib')
const logger = require('../lib/logger')

/**
 *  Given an array of SierraBib records to index, returns {EsBib[]}
 * recordsToIndex
 */
const buildEsDocument = async (records) => {
  // Prefetch holdings and items and attach to bibs
  records = await prefetch.modelPrefetch(records)
  logger.info(records)
  // Perform general prefetch to fetch data from other sources:
  records = await prefetch.generalPrefetch(records)
  logger.info(records)
  return records.map(record => new EsBib(record))
}

/**
 *  Given an event type (e.g. Bib, Item, Holding) and an array of plainobject records,
 *  returns an array of plainobjects representing the relevant Sierra bibs.
 */
const transformIntoBibRecords = (type, records) => {
  // If incoming event is Item/Holding, convert it into a Bib event:
  if (type === 'Item') {
    records = filteredSierraItemsForItems(records)
    records = platformApi.bibsForHoldingsOrItems(type, records)
  } else if (type === 'Holding') {
    records = filteredSierraHoldingsForHoldings(records)
    records = platformApi.bibsForHoldingsOrItems(type, records)
  }
  return records
}

module.exports = { buildEsDocument, transformIntoBibRecords }
