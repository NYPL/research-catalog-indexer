const logger = require('./lib/logger')
const eventDecoder = require('./lib/event-decoder')
const elastic = require('./lib/elastic-search/requests')
const { buildEsDocument } = require('./lib/build-es-document')

/**
 * Main lambda handler receiving Bib, Item, and Holding events
 */
const handler = async (event, context, callback) => {
  logger.setLevel(process.env.LOGLEVEL || 'info')
  try {
    const decodedEvent = await eventDecoder.decodeRecordsFromEvent(event)

    logger.info(`Handling ${decodedEvent.type} event: ${decodedEvent.records.map((r) => `${r.nyplSource || ''}/${r.id}`).join(', ')}`)

    const recordsToIndex = await buildEsDocument(decodedEvent)

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

module.exports = { handler }
