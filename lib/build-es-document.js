const platformApi = require('./platform-api/requests')
const generalPrefetch = require('./general-prefetch')
const modelPrefetcher = require('./model-prefetch')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('./prefilter')
const EsBib = require('./es-models/bib')

/**
 *  Given an array of SierraBib records to index, returns {EsBib[]}
 * recordsToIndex
 */
const buildEsDocument = async (records) => {
  // Prefetch holdings and items and attach to bibs
  if (process.env.USER_SCHEMA) {
    const userSchema = process.env.USER_SCHEMA.split(',')
    if (userSchema.includes('items') || userSchema.includes('holdings')) {
      records = await modelPrefetcher.modelPrefetch(records)
    }
  } else {    
    records = await modelPrefetcher.modelPrefetch(records)
  }

  // Perform general prefetch to fetch data from other sources:
  records = await generalPrefetch(records)

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
