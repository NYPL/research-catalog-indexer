const logger = require('./lib/logger')
const eventDecoder = require('./lib/event-decoder')
const elastic = require('./lib/elastic-search/requests')
const suppress = require('./lib/utils/suppressBibs')
const { buildEsDocument, transformIntoBibRecords } = require('./lib/build-es-document')
const { truncate } = require('./lib/utils')
const { notifyDocumentProcessed } = require('./lib/streams-client')
const browse = require('./lib/browse-terms')
const { filteredSierraBibsForBibs } = require('./lib/prefilter')
const { loadNyplCoreData } = require('./lib/load-core-data')
const SierraBib = require('./lib/sierra-models/bib')
const EsBib = require('./lib/es-models/bib')
const { Timer } = require('./timers')

/**
 * Main lambda handler receiving Bib, Item, and Holding events
 */
const handler = async (event, context, callback) => {
  await loadNyplCoreData()
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

  // Ensure event has Bib records:
  records = await transformIntoBibRecords(type, records)

  const { filteredBibs, removedBibs } = await filteredSierraBibsForBibs(records)

  // If original event was a Bib event, delete the "removed" records:
  const recordsToDelete = type === 'Bib' ? removedBibs : []

  const esDocTimer = Timer.startNew('esDocBuilder')
  const recordsToIndex = await buildEsDocument(filteredBibs)
  esDocTimer.endTimer()
  esDocTimer.howMany('seconds')
  const messages = []

  // Fetch subjects from all bibs, whether they are updates, creates, or deletes,
  // and transmit to the browse pipeline. This must happen before writes to the
  // resources index to determine any diff between new and old subjects
  const changedRecords = [...filteredBibs, ...removedBibs]
  let browseTermDiffs
  if ((changedRecords.length) && type === 'Bib') {
    const bibSubjectTimer = Timer.startNew('buildBibSubjectEvents')
    removedBibs.map(bib => new EsBib(new SierraBib(bib)))
    browseTermDiffs = await browse.buildBibSubjectEvents(changedRecords)
    bibSubjectTimer.endTimer()
    bibSubjectTimer.howMany('seconds')
  }

  if (recordsToIndex.length) {
    if (options.dryrun) {
      logger.info(`DRYRUN: Skipping writing ${recordsToIndex.length} records`)
    } else {
      // Write records to ES:
      await elastic.writeRecords(recordsToIndex)

      // Write to IndexDocumentProcessed Kinesis stream:
      await notifyDocumentProcessed(recordsToIndex)
    }

    // Log out a summary of records updated:
    const summary = truncate(recordsToIndex.map((record) => record.uri).join(','), 100)
    messages.push(`Wrote ${recordsToIndex.length} doc(s): ${summary}`)
  }

  if (recordsToDelete.length) {
    if (options.dryrun) {
      console.log(`DRYRUN: Skipping removing ${recordsToDelete.length} records`)
    } else {
      await suppress.suppressBibs(recordsToDelete)
    }

    messages.push(`Deleted ${recordsToDelete.length} doc(s)`)
  }
  if (!options.dryrun) await browse.emitBibSubjectEvents(browseTermDiffs)
  const message = messages.length ? messages.join('; ') : 'Nothing to do.'

  logger.info((options.dryrun ? 'DRYRUN: ' : '') + message)

  return {
    message
  }
}

module.exports = { handler, processRecords }
