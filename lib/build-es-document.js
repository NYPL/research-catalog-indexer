const EsBib = require('./es-models/bib')
const SierraBib = require('./sierra-models/bib')
const platformApi = require('./platform-api/requests')
const generalPrefetch = require('./general-prefetch')
const {
  filteredSierraBibsForBibs,
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('./prefilter')

/**
 *  Given an object defining a Kinesis type and an array of records,
 *  returns an object defining {EsBib[]} recordsToIndex and {SierraBib[]} recordsToDelete
 */
const buildEsDocument = async ({ type, records }) => {
  // Ensure event has Bib records:
  records = await transformIntoBibRecords(type, records)

  // Apply filtering and build up Sierra models:
  const { filteredBibs, removedBibs } = await filteredSierraBibsForBibs(records)
  records = filteredBibs

  // If original event was a Bib event, delete the "removed" records:
  const recordsToDelete = type === 'Bib' ? removedBibs : []

  // Prefetch holdings and items and attach to bibs
  records = await platformApi.modelPrefetch(records)

  // Perform general prefetch to fetch data from other sources:
  records = await generalPrefetch(records)

  // Wrap in ES models:
  records = records
    .map((record) => new EsBib(record))

  // Render records as plainobjects suitable for indexing:
  const recordsToIndex = await Promise.all(
    records.map(async (record) => record.toJson())
  )

  return { recordsToIndex, recordsToDelete }
}

const buildSierraBibs = (records) => {
  // instantiate sierra bib per bib record
  return records
    .map((record) => new SierraBib(record))
    .map((bib) => {
      // Ensure each holding has reverse reference to bib:
      bib._holdings = bib._holdings.map((holding) => {
        holding._bibs = [bib]
        return holding
      })
      // Ensure each item has reverse reference to bib:
      bib._items = bib._items.map((item) => {
        item._bibs = [bib]
        return item
      })
      return bib
    })
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

module.exports = { buildEsDocument, buildSierraBibs }
