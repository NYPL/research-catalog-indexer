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

    const { message } = await processRecords(decodedEvent.type, decodedEvent.records)

    callback(null, message)
  } catch (e) {
    logger.error('Calling back with error: ', e)
    callback(e)
  }
}

const processRecords = async (type, records, options = {}) => {
  options = Object.assign({
    dryrun: false
  }, options)

  const { recordsToIndex, recordsToDelete } = await buildEsDocument({ type, records })

  const messages = []

  if (recordsToIndex.length) {
    if (options.dryrun) {
      console.log(`DRYRUN: Skipping writing ${recordsToIndex.length} records`)
    } else {
      await elastic.writeRecords(recordsToIndex)
    }

    // Log out a summary of records updated:
    const summary = truncate(recordsToIndex.map((record) => record.uri).join(','), 100)
    messages.push(`Wrote ${recordsToIndex.length} doc(s): ${summary}`)
  }

  if (recordsToDelete.length) {
    if (options.dryrun) {
      console.log(`DRYRUN: Skipping removing ${recordsToDelete.length} records`)
    } else {
      await suppressBibs(recordsToDelete)
    }

    messages.push(`Deleted ${recordsToDelete.length} doc(s)`)
  }

  const message = messages.length ? messages.join('; ') : 'Nothing to do.'

  logger.info(message)

  return {
    message
  }
}

module.exports = { handler, processRecords }
