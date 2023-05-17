const logger = require('./lib/logger')
const eventDecoder = require('./lib/event-decoder')
const { prefilterItems, prefilterBibs, prefilterHoldings } = require('./lib/stubzzz')
const elastic = require('./lib/elastic-search/requests')
const SierraBib = require('./lib/sierra-models/bib')
const EsBib = require('./lib/es-models/bib')
const platformApi = require('./lib/platform-api/requests')
const generalPrefetch = require('./lib/general-prefetch')

/**
 * Main lambda handler receiving Bib, Item, and Holding events
 */
const handler = async (event, context, callback) => {
  logger.setLevel(process.env.LOGLEVEL || 'info')
  try {
    const decodedEvent = await eventDecoder.decodeRecordsFromEvent(event)
    let records = null

    logger.info(`Handling ${decodedEvent.type} event: ${decodedEvent.records.map((r) => `${r.nyplSource || ''}/${r.id}`).join(', ')}`)
    // Dispatch based on what kind of event (Bib, Item, or Holding)
    switch (decodedEvent.type) {
      case 'Bib':
        records = await prefilterBibs(decodedEvent.records)
        break
      case 'Item':
        records = await prefilterItems(decodedEvent.records)
        records = await platformApi.bibsForHoldingsOrItems(decodedEvent.type, records)
        break
      case 'Holding':
        records = await prefilterHoldings(decodedEvent.records)
        records = await platformApi.bibsForHoldingsOrItems(decodedEvent.type, records)
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
    const recordsToIndex = await Promise.all(
      records.map(async (record) => record.toJson())
    )

    let message = 'Nothing to do.'
    if (recordsToIndex.length) {
      await elastic.writeRecords(recordsToIndex)

      message = `Wrote ${recordsToIndex.length} doc(s)`
      logger.info(message)
    }

    callback(null, message)
  } catch (e) {
    logger.error('Calling back with error: ', e)
    callback(e)
  }
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

module.exports = { handler, internal: { buildSierraBibs } }
