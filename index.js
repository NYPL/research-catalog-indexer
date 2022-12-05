const logger = require('./lib/logger')
const { decodeRecordsFromEvent } = require('./lib/event-decoder')
const { prefilterItems, prefilterBibs, prefilterHoldings, prefetch, writeRecords, EsBib } = require('./lib/stubzzz')
const SierraBib = require('./lib/sierra-models/bib')
const { bibsForItems, bibsForHoldings } = require('./lib/platform-api/requests')

/**
 * Main lambda handler receiving Bib, Item, and Holding events
 */
const handler = async (event, context, callback) => {
  logger.setLevel(process.env.LOGLEVEL || 'info')
  try {
    const decodedEvent = await decodeRecordsFromEvent(event)
    let records = null

    logger.info(`Handling ${decodedEvent.type} event: ${decodedEvent.records.map((r) => `${r.nyplSource || ''}/${r.id}`).join(', ')}`)
    // Dispatch based on what kind of event (Bib, Item, or Holding)
    switch (decodedEvent.type) {
      case 'Bib':
        records = await prefilterBibs(decodedEvent.records)
        break
      case 'Item':
        records = await prefilterItems(decodedEvent.records)
        records = await bibsForItems(records)
        break
      case 'Holding':
        records = await prefilterHoldings(decodedEvent.records)
        records = await bibsForHoldings(records)
        break
    }

    // prefetch holdings and items, and recap codes for itemss
    records = await prefetch(records)

    records = buildSierraBibs(records)

    records = records
      .map((record) => new EsBib(record))
      .map((esBib) => JSON.stringify(EsBib))

    if (records) {
      // Ensure lambda `callback` is fired after update:
      const { totalProcessed } = await writeRecords(records)
      const message = `Wrote ${totalProcessed} doc(s)`
      logger.debug(`Firing callback with ${message}`)
      callback(null, message)
    } else {
      logger.warn('Nothing to do for event', event)
      callback(null, 'Nothing to do.')
    }
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
    bib.items().forEach((i) => i.addBib(bib))
    bib.holdings().forEach((h) => h.addBib(bib))
  })
  return bibs
}

module.exports = { handler, internal: { buildSierraBibs } }
