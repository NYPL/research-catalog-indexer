const logger = require('./lib/logger')
const eventDecoder = require('./lib/event-decoder')
const elastic = require('./lib/elastic-search/requests')
const { suppressBibs } = require('./lib/utils/suppressBibs')
const { buildEsDocument } = require('./lib/build-es-document')
const { truncate } = require('./lib/utils')

/**
 * Main lambda handler receiving Bib, Item, and Holding events
 */
const handler = async (event, context, callback) => {
  logger.setLevel(process.env.LOG_LEVEL || 'info')
  try {
    const decodedEvent = await eventDecoder.decodeRecordsFromEvent(event)

    logger.info(`Handling ${decodedEvent.type} event: ${decodedEvent.records.map((r) => `${r.nyplSource || ''}/${r.id}`).join(', ')}`)

    const { recordsToIndex, recordsToDelete } = await buildEsDocument(decodedEvent)

    let message = ''
    if (recordsToIndex.length) {
      await elastic.writeRecords(recordsToIndex)

      // Log out a summary of records updated:
      const summary = truncate(recordsToIndex.map((record) => record.uri).join(','), 100)
      message = `Wrote ${recordsToIndex.length} doc(s): ${summary}`
    }

    if (recordsToDelete.length) {
      await suppressBibs(recordsToDelete)

      message += `Deleted ${recordsToDelete.length} doc(s)`
    }

    if (!message) message = 'Nothing to do.'

    logger.info(message)

    callback(null, message)
  } catch (e) {
    logger.error('Calling back with error: ', e)
    callback(e)
  }
}

module.exports = { handler }
