const logger = require('./lib/logger')
const eventDecoder = require('./lib/event-decoder')
const elastic = require('./lib/elastic-search/requests')
const { suppressBibs } = require('./lib/utils/suppressBibs')
const { buildEsDocument } = require('./lib/build-es-document')
const { truncate } = require('./lib/utils')
const { notifyDocumentProcessed } = require('./lib/streams-client')

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
      // Write records to ES:
      await elastic.writeRecords(recordsToIndex)

      // Write to IndexDocumentProcessed Kinesis stream:
      await notifyDocumentProcessed(recordsToIndex)

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
