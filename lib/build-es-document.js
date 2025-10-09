const EsBib = require('./es-models/bib')
const platformApi = require('./platform-api/requests')
const generalPrefetch = require('./general-prefetch')
const modelPrefetcher = require('./model-prefetch')
const {
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('./prefilter')
const { Timer } = require('../timers')

/**
 *  Given an array of SierraBib records to index, returns {EsBib[]}
 * recordsToIndex
 */
const buildEsDocument = async (records) => {
// Prefetch holdings and items and attach to bibs
  records = await modelPrefetcher.modelPrefetch(records)

  // Perform general prefetch to fetch data from other sources:
  records = await generalPrefetch(records)

  const esModelTimer = new Timer('esModel')
  esModelTimer.startTimer()
  // Wrap in ES models:
  records = records
    .map((record) => new EsBib(record))
  esModelTimer.endTimer()
  esModelTimer.howMany()
  // Render records as plainobjects suitable for indexing:
  const jsoning = new Timer('jsoning')
  jsoning.startTimer()
  const recordsToIndex = await Promise.all(
    records.map(async (record) => record.toJson())
  )
  jsoning.endTimer()
  jsoning.howMany()

  return recordsToIndex
}

/**
 *  Given an event type (e.g. Bib, Item, Holding) and an array of plainobject records,
 *  returns an array of plainobjects representing the relevant Sierra bibs.
 */
const transformIntoBibRecords = async (type, records) => {
  // If incoming event is Item/Holding, convert it into a Bib event:
  if (type === 'Item') {
    records = await filteredSierraItemsForItems(records)
    records = await platformApi.bibsForHoldingsOrItems(type, records)
  } else if (type === 'Holding') {
    records = await filteredSierraHoldingsForHoldings(records)
    records = await platformApi.bibsForHoldingsOrItems(type, records)
  }
  return records
}

module.exports = { buildEsDocument, transformIntoBibRecords }
