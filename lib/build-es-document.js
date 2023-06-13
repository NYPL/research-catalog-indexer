const SierraBib = require('./sierra-models/bib')
const EsBib = require('./es-models/bib')
const platformApi = require('./platform-api/requests')
const generalPrefetch = require('./general-prefetch')
const {
  filteredSierraBibsForBibs,
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
} = require('./prefilter')

const buildEsDocument = async ({ type, records }) => {
  // Dispatch based on what kind of event (Bib, Item, or Holding)
  switch (type) {
    case 'Bib':
      records = await filteredSierraBibsForBibs(records)
      break
    case 'Item':
      records = await filteredSierraItemsForItems(records)
      records = await platformApi.bibsForHoldingsOrItems(type, records)
      break
    case 'Holding':
      records = await filteredSierraHoldingsForHoldings(records)
      records = await platformApi.bibsForHoldingsOrItems(type, records)
      break
  }
  // prefetch holdings and items and attach to bibs
  records = await platformApi.modelPrefetch(records)
  // instantiate sierra bibs with holdings and items attached.
  // also include bibs on holding and item records
  records = buildSierraBibs(records)
  // generalPrefetch includes:
  //    - attachRecapCustomerCodes
  records = await generalPrefetch(records)

  records = records
    .map((record) => new EsBib(record))

  // Render records as plainobjects suitable for indexing:
  return await Promise.all(
    records.map(async (record) => record.toJson())
  )
}

const buildSierraBibs = (records) => {
  // instantiate sierra bib per bib record
  const bibs = records.map((record) => new SierraBib(record))
  // add bibs to holding and item records on bibs
  bibs.forEach((bib) => {
    if (bib.items()) {
      bib.items().forEach((i) => i.addBib(bib))
    }
    if (bib.holdings()) {
      bib.holdings().forEach((h) => h.addBib(bib))
    }
  })
  return bibs
}

module.exports = { buildEsDocument, buildSierraBibs }
