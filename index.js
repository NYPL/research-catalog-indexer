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
const schema = require('./lib/elastic-search/index-schema')
const SierraBib = require('./lib/sierra-models/bib')
const EsBib = require('./lib/es-models/bib')

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
    updateOnly: false,
    dryrun: false
  }, options)
  // Ensure event has Bib records:
  records = await transformIntoBibRecords(type, records)

  const { filteredBibs, removedBibs } = await filteredSierraBibsForBibs(records)

  // If original event was a Bib event, delete the "removed" records:
  const recordsToDelete = type === 'Bib' ? removedBibs : []

  const esModels = await buildEsDocument(filteredBibs)
  const plainObjectEsDocuments = esModels.map((record) => record.toPlainObject(schema.schema()))
  const messages = []

  // Fetch subjects from all bibs, whether they are updates, creates, or deletes,
  // and transmit to the browse pipeline. This must happen before writes to the
  // resources index to determine any diff between new and old subjects
  let browseTermDiffs
  if (process.env.EMIT_BROWSE_TERMS === 'true') {
    const esModelsForDeletions = removedBibs.map(bib => new EsBib(new SierraBib(bib)))
    const changedRecords = [...esModels, ...esModelsForDeletions]
    if ((changedRecords.length) && type === 'Bib') {
      browseTermDiffs = await browse.buildBibSubjectEvents(changedRecords)
    }
  }
  if (plainObjectEsDocuments.length) {
    let summary
    if (options.dryrun) {
      logger.info(`DRYRUN: Skipping writing ${plainObjectEsDocuments.length} records`)
    } else if (!options.updateOnly) {
      // Write records to ES:
      await elastic.writeRecords(plainObjectEsDocuments)
      summary = `Wrote ${plainObjectEsDocuments.length} records: ${truncate(plainObjectEsDocuments.map((record) => record.uri).join(','), 100)}`
    } else if (options.updateOnly) {
      try {
        const unindexedRecords = await elastic.updateRecords(plainObjectEsDocuments)
        summary = `Updated ${plainObjectEsDocuments.length - unindexedRecords.length} records, wrote ${unindexedRecords.length} unindexed records to file`
      } catch (e) {
        logger.error('Update records error: ', e)
      }
    }
    if (process.env.SKIP_DOC_PROCESSED_STREAM !== 'true') await notifyDocumentProcessed(plainObjectEsDocuments)
    // TO DO: this should reflect errors and successes, not just happily claim writing for all
    messages.push(summary)
  }

  if (recordsToDelete.length) {
    if (options.dryrun) {
      console.log(`DRYRUN: Skipping removing ${recordsToDelete.length} records`)
    } else {
      await suppress.suppressBibs(recordsToDelete)
    }

    messages.push(`Deleted ${recordsToDelete.length} doc(s)`)
  }

  if (process.env.EMIT_BROWSE_TERMS === 'true') {
    const subjectHandler = process.env.BTI_INDEX_PATH ? browse.emitBibSubjectsToLocalBti : browse.emitBibSubjectEventsToSqs
    await subjectHandler(browseTermDiffs)
  }
  const message = messages.length ? messages.join('; ') : 'Nothing to do.'

  logger.info((options.dryrun ? 'DRYRUN: ' : '') + message)

  return {
    message
  }
}

module.exports = { handler, processRecords }
