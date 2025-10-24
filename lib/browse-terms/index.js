const logger = require('../logger')
const { fetchPropertyForUris } = require('../elastic-search/requests')
const { BibMappings } = require('../mappings/mappings')
const { Varfield } = require('@nypl/browse-term')
const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs')
const kms = require('../kms')

/**
 * Callback method to map over browse term objects
 * @param {{preferredTerm: string, variant?: string}[]} batch
 * @returns PseudoSQSEvent[]
 */
const convertBatchToEventForLocalBti = (batch) => {
  return batch.map((subject) => ({
    body: JSON.stringify(subject),
    eventSourceARN: 'stream:subject'
  }))
}

/**
 * Callback method to map over browse term objects
 * @param {{preferredTerm: string, variant?: string}[]} batch
 * @param {string} url
 * @returns SQSBatchCommand[]
 */
const convertBatchToSQSEvent = (batch, url) => {
  return new SendMessageBatchCommand({
    QueueUrl: url,
    Entries: batch.map((subject, i) => ({
      MessageBody: JSON.stringify(subject),
      Id: `${i}`
    }))
  })
}

const buildBatchedSubjects = (subjects) => {
  const batchSize = process.env.BROWSE_TERM_BATCH_SIZE || 10
  return subjects.reduce((batchArray, subject, index) => {
    const batchIndex = Math.floor(index / batchSize)
    if (!batchArray[batchIndex]) batchArray[batchIndex] = []
    batchArray[batchIndex].push(subject)
    return batchArray
  }, [])
}

/**
 * Turn a single varfield object into a subject update object
 * @param {VarfieldObject} subjectVarfieldObject
 * @returns @returns {{ preferredTerm?: string, variant?: string, type: string}}
 */

const getPrimaryAndParallelLabels = (subjectVarfieldObject) => {
  const labels = {}
  if (subjectVarfieldObject.marc) {
    const preferredTerm = { ...subjectVarfieldObject.marc, fieldTag: 'd' }
    const preferredTermVarfieldObject = new Varfield(preferredTerm)
    labels.suppress = preferredTermVarfieldObject.suppress
    labels.preferredTerm = preferredTermVarfieldObject.label
  }
  if (subjectVarfieldObject.parallel) {
    labels.variant = new Varfield(subjectVarfieldObject.parallel?.marc).label
  }
  return labels
}

const getSubjectModels = (esRecord) => {
  const marcTags = BibMappings.get('subjectLiteral', esRecord.bib)
  const id = esRecord.uri()
  return esRecord.bib.varFieldsMulti(marcTags, true)
    .map(getPrimaryAndParallelLabels)
    .filter(({ suppress }) => !suppress)
    .map((subject) => {
      delete subject.suppress
      return subject
    })
    .map((subject) => ({ ...subject, sourceId: id }))
}
/**
 *
 * @param {JSONified EsBib[]} recordsToIndex
 * @param {SierraBib[]} sierraRecordsToDelete
 * @returns {{ preferredTerm?: string, variant?: string, type: string}[]}
 *  * This method creates subject update objects for:
 * - current subject literal values from elastic search for all bib ids in sierraBibs
 * - subject literal values generated from the data provided in sierraBibs, including parallel values when relevant
 *
 * Subject update objects have a preferred term string, which represents the primary subject literal value, for a single 6xx field and/or a variant string, which represents the parallel subject literal value for that single 6xx marc field.
 */
const buildBibSubjectEvents = async (esRecords) => {
  // use built in esBib logic to parse nyplSource and build uri with prefix
  const filteredEsRecords = esRecords
    .filter((record) => record.bib.getIsResearchWithRationale().isResearch)
  if (process.env.INGEST_BROWSE_TERMS === 'true') {
    logger.info('Running browse term ingest mode. Skipping fetch to ES for live subject data')
    return filteredEsRecords
      .filter(esBib => !esBib.bib.getSuppressionWithRationale().suppressed)
      .map(getSubjectModels).flat()
  }
  const idsToFetch = filteredEsRecords.map((record) => record.uri())
  if (!idsToFetch?.length) {
    logger.debug('Skipping browse stream write. No records to fetch or build subjects for.')
    return
  }
  return await determineUpdatedTerms('subjectLiteral', idsToFetch, filteredEsRecords)
}

const determineUpdatedTerms = async (esResourcesProperty, idsToFetch, freshBibData) => {
  const liveTerms = await fetchPropertyForUris(idsToFetch, esResourcesProperty)
  const terms = freshBibData.map((esBibDoc, idx) => {
    const freshTerms = getSubjectModels(esBibDoc)
    const liveTermsForBib = liveTerms.docs?.[idx]?._source?.[esResourcesProperty]?.map(term => ({ preferredTerm: term }))
    const preferredTermPresentInBoth = (term) =>
      liveTermsForBib?.find((liveTerm) => liveTerm.preferredTerm === term.preferredTerm)
    const noUpdatedSubjects = freshTerms.every((term) => preferredTermPresentInBoth(term))
    // indexed bib and newly build bib have identical preferred terms, do not push updates to SQS
    if (noUpdatedSubjects) return null

    // only return subjects that have been added or deleted
    return buildSubjectDiff(freshTerms, liveTermsForBib)
  })
  const findUnique = (termObject, index, array) => {
    // is this the first instance of the preferred term in question?
    return array.findIndex((term) => term.preferredTerm === termObject.preferredTerm) === index
  }
  return terms.filter(Boolean).flat().filter(findUnique)
}

const buildSubjectDiff = (fresh = [], live = []) => {
  const subjectsNotPresentInOtherArray = []
  const compareTo = (compareArray) => {
    return (diff, subject) => {
      if (compareArray.findIndex(compareSubject => compareSubject.preferredTerm === subject.preferredTerm) < 0) diff.push(subject)
      return diff
    }
  }
  fresh.reduce(compareTo(live), subjectsNotPresentInOtherArray)
  live.reduce(compareTo(fresh), subjectsNotPresentInOtherArray)
  return subjectsNotPresentInOtherArray
}

/**
 * Fetch the current subject literal data from elastic search for the provided ids.
 *
 * @param {JSONified EsBib | {uri: string}} records
 * @param {elasticsearch client} client
 * @returns {string[]}
 */
const fetchLiveSubjectLiterals = async (ids = []) => {
  const subjectLiteralDocs = await fetchPropertyForUris(ids, 'subjectLiteral')
  return subjectLiteralDocs.docs.map((doc) => {
    return doc?._source?.subjectLiteral
  }).flat().filter(x => x)
}

/**
 *
 * @param {SierraBib[]} sierraBibs an array of all bibs in the processing batch, regardless
 * of suppression
 *
 * Sends extracted and fetched subject literal data for provided sierra bibs
*  in batches of 10 (max value in SQS batch message) to the bib-browse-term SQS
 */
const emitBibSubjectEventsToSqs = async (browseTerms) => {
  if (!process.env.ENCRYPTED_SQS_BROWSE_TERM_URL) {
    throw new Error('Missing SQS stream. Cannot write subjects')
  }
  if (browseTerms?.length === 0) {
    logger.debug('emitBibSubjectEventsToSqs: No bib subject events to emit.')
  }
  const sqsUrl = await kms.decrypt(process.env.ENCRYPTED_SQS_BROWSE_TERM_URL)
  try {
    logger.info('Running browse term update via SQS')
    const sqsClient = new SQSClient({})
    const batchedSubjects = buildBatchedSubjects(browseTerms)
    const batchedCommands = convertBatchToSQSEvent(batchedSubjects, sqsUrl)
    logger.info(`emitBibSubjectEventsToSqs: Writing ${browseTerms.length} terms in ${batchedCommands.length} batches to SQS stream ${sqsUrl}`)
    const responses = await Promise.allSettled(batchedCommands.map(async (command) => await sqsClient.send({ Records: command })))
    parseBatchCommandResponses(responses)
  } catch (e) {
    logger.error(`emitBibSubjectEventsToSqs error:\n ${e.message}`)
  }
}

const parseBatchCommandResponses = (responses) => {
  const success = responses.filter(({ status }) => status === 'fulfilled')
  const error = responses.filter(({ status }) => status === 'rejected')
  logger.info(`emitBibSubjectEvents: ${success.length} batches of subjects successfully sent to SQS`)
  if (error.length) logger.info(`emitBibSubjectEvents: ${error.length} batches of subjects failed to send to SQS.}`)
}

const emitBibSubjectsToLocalBti = async (browseTerms) => {
  if (!process.env.BTI_INDEX_PATH) throw new Error('Attempting to run local BTI with no path')
  try {
    logger.info('Running browse term update using local bti index.js')
    const { handler: emitSubjects } = require(process.env.BTI_INDEX_PATH)
    const batches = buildBatchedSubjects(browseTerms)
    const batchedCommands = batches.map(convertBatchToEventForLocalBti)
    logger.info(`emitBibSubjectsToLocalBti: Writing ${browseTerms.length} terms in ${batchedCommands.length} batches to local BTI instance`)

    const responses = await Promise.allSettled(batchedCommands.map(async (command) => await emitSubjects({ Records: command })))
    parseBatchCommandResponses(responses)
  } catch (e) {
    logger.error(`emitBibSubjectsToLocalBti error: \n ${e.message}`)
  }
}

module.exports = {
  determineUpdatedTerms,
  getPrimaryAndParallelLabels,
  buildSubjectDiff,
  fetchLiveSubjectLiterals,
  buildBibSubjectEvents,
  emitBibSubjectEventsToSqs,
  emitBibSubjectsToLocalBti,
  getSubjectModels
}
