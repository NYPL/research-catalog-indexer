const logger = require('../logger')
const { fetchPropertyForUris } = require('../elastic-search/requests')
const { BibMappings } = require('../mappings/mappings')
const { SubjectVarfield, ContributorVarfield } = require('@nypl/browse-term')
const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs')
const kms = require('../kms')

/**
 * Callback method to map over browse term objects
 * @param {{preferredTerm: string, variant?: string}[]} batch
 * @returns PseudoSQSEvent[]
 */
const convertBatchToEventForLocalBti = (batch) => {
  return batch.map((term) => ({
    body: JSON.stringify(term),
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
    Entries: batch.map((event, i) => ({
      MessageBody: JSON.stringify(event),
      Id: `${i}`
    }))
  })
}

const buildBatchedEvents = (terms) => {
  const batchSize = process.env.BROWSE_TERM_BATCH_SIZE || 10
  return terms.reduce((batchArray, term, index) => {
    const batchIndex = Math.floor(index / batchSize)
    if (!batchArray[batchIndex]) batchArray[batchIndex] = []
    batchArray[batchIndex].push(term)
    return batchArray
  }, [])
}

/**
 * Turn a single varfield object into a browsableTermVarfieldObject update object
 * @param {VarfieldObject} browsableTermVarfieldObject
 * @returns @returns {{ preferredTerm?: string, variant?: string, type: string}}
 */

const getPrimaryAndParallelLabels = (browsableTermVarfieldObject, property = 'subjectLiteral') => {
  const models = { subjectLiteral: SubjectVarfield, nameTitleRole: ContributorVarfield }
  const labels = {}
  const Model = models[property]
  if (browsableTermVarfieldObject.marc) {
    const preferredTerm = { ...browsableTermVarfieldObject.marc }
    const preferredTermVarfieldObject = new Model(preferredTerm)
    labels.suppress = preferredTermVarfieldObject.suppress
    labels.preferredTerm = preferredTermVarfieldObject.browseTermValue
  }
  if (browsableTermVarfieldObject.parallel) {
    labels.variant = new Model(browsableTermVarfieldObject.parallel?.marc).browseTermValue
  }
  return labels
}

const getBrowseDataModels = (esRecord, property = 'subjectLiteral') => {
  const marcTags = BibMappings.get(property, esRecord.bib)
  const id = esRecord.uri()
  return esRecord.bib.varFieldsMulti(marcTags, true)
    .map((varfieldObject) => getPrimaryAndParallelLabels(varfieldObject, property))
    .filter(({ suppress }) => !suppress)
    .map((term) => {
      delete term.suppress
      return term
    })
    .map((term) => ({ ...term, sourceId: id }))
}
/**
 *
 * @param {JSONified EsBib[]} recordsToIndex
 * @param {SierraBib[]} sierraRecordsToDelete
 * @returns {{ preferredTerm?: string, variant?: string, type: string}[]}
 *  * This method creates browseable data update objects for:
 * - current browseable data literal values from elastic search for all bib ids in sierraBibs
 * - browse term literal values generated from the data provided in sierraBibs, including parallel values when relevant
 *
 *
 * Browse Term update objects have a preferred term string, which represents the primary term literal value, for a single marc field field and/or a variant string, which represents the parallel literal value for that single marc field.
 */
const buildBrowseDataEvents = async (esRecords, property = 'subjectLiteral') => {
  // use built in esBib logic to parse nyplSource and build uri with prefix
  const filteredEsRecords = esRecords
    .filter((record) => record.bib.getIsResearchWithRationale().isResearch)
  if (process.env.INGEST_BROWSE_TERMS === 'true') {
    logger.info('Running browse term ingest mode. Skipping fetch to ES for live browseable data')
    return filteredEsRecords
      .filter(esBib => !esBib.bib.getSuppressionWithRationale().suppressed)
      .map((record) => getBrowseDataModels(record, property)).flat()
  }
  const idsToFetch = filteredEsRecords.map((record) => record.uri())
  if (!idsToFetch?.length) {
    logger.debug('Skipping browse stream write. No records to fetch or build browsable data for.')
    return []
  }
  return await determineUpdatedTerms(property, idsToFetch, filteredEsRecords)
}

const determineUpdatedTerms = async (esResourcesProperty, idsToFetch, freshBibData) => {
  let liveTerms = await fetchPropertyForUris(idsToFetch, esResourcesProperty)
  liveTerms = liveTerms.docs?.map((liveDoc) => liveDoc?._source?.[esResourcesProperty]?.map(term => ({ preferredTerm: term }))).flat()
  const freshTerms = freshBibData.map((esBibDoc) => getBrowseDataModels(esBibDoc, esResourcesProperty))

  const findUnique = (termObject, index, array) => {
    // is this the first instance of the preferred term in question?x
    return array.findIndex((term) => term.preferredTerm === termObject.preferredTerm) === index
  }
  return [...freshTerms, ...liveTerms].filter(Boolean).flat().filter(findUnique)
}

const buildBrowseDataDiff = (fresh = [], live = []) => {
  const browseTermNotPresentInOtherArray = []
  const compareTo = (compareArray) => {
    return (diff, term) => {
      if (compareArray.findIndex(compareTerm => compareTerm.preferredTerm === term.preferredTerm) < 0) diff.push(term)
      return diff
    }
  }
  fresh.reduce(compareTo(live), browseTermNotPresentInOtherArray)
  live.reduce(compareTo(fresh), browseTermNotPresentInOtherArray)
  return browseTermNotPresentInOtherArray
}

/**
 * Fetch the current browseable term literal data from elastic search for the provided ids.
 *
 * @param {JSONified EsBib | {uri: string}} records
 * @param {elasticsearch client} client
 * @returns {string[]}
 */
const fetchLiveBibData = async (ids = [], property = 'subjectLiteral') => {
  const liveDocs = await fetchPropertyForUris(ids, property)
  return liveDocs.docs.map((doc) => {
    return doc?._source?.[property]
  }).flat().filter(x => x)
}

/**
 *
 * @param {SierraBib[]} sierraBibs an array of all bibs in the processing batch, regardless
 * of suppression
 *
 * Sends extracted and fetched browseable term literal data for provided sierra bibs
*  in batches of 10 (max value in SQS batch message) to the bib-browse-term SQS
 */
const emitBrowseDataToSqs = async (browseTerms, encryptedUrl) => {
  if (!encryptedUrl) {
    throw new Error('Missing SQS stream. Cannot write browse data events')
  }
  if (browseTerms?.length === 0) {
    logger.info('emitBrowseDataToSqs: No bib browse dataevents to emit.')
    return
  }
  const sqsUrl = await kms.decrypt(encryptedUrl)
  try {
    logger.info('Running browse term update via SQS')
    const sqsClient = new SQSClient({})
    const batchedCommands = buildBatchedEvents(browseTerms).map(batch => convertBatchToSQSEvent(batch, sqsUrl))
    logger.info(`emitBrowseDataToSqs: Writing ${browseTerms.length} terms to SQS stream ${sqsUrl}`)
    const responses = await Promise.allSettled(batchedCommands.map(async (command) => await sqsClient.send(command)))
    parseBatchCommandResponses(responses)
  } catch (e) {
    logger.error(`emitBrowseDataToSqs error:\n ${e.message}`)
  }
}

const parseBatchCommandResponses = (responses) => {
  const success = responses.filter(({ status }) => status === 'fulfilled')
  const error = responses.filter(({ status }) => status === 'rejected')
  const destination = process.env.BTI_INDEX_PATH ? 'local bti' : 'SQS'
  logger.info(`${success.length} batches of Browse term data successfully sent to ${destination}`)
  if (error.length) logger.info(`${error.length} batches of browse term data failed to send to ${destination}}`)
}

const emitBrowseDataToLocalBti = async (browseTerms) => {
  if (!process.env.BTI_INDEX_PATH) throw new Error('Attempting to run local BTI with no path')
  try {
    logger.info('Running browse term update using local bti index.js')
    const { handler: emitTerms } = require(process.env.BTI_INDEX_PATH)
    const batches = buildBatchedEvents(browseTerms)
    const batchedCommands = batches.map(convertBatchToEventForLocalBti)
    logger.info(`emitBrowseDataToLocalBti: Writing ${browseTerms.length} terms in ${batchedCommands.length} batches to local BTI instance`)

    const responses = await Promise.allSettled(batchedCommands.map(async (command) => await emitTerms({ Records: command })))
    parseBatchCommandResponses(responses)
  } catch (e) {
    logger.error(`emitBrowseDataToLocalBti error: \n ${e.message}`)
  }
}

module.exports = {
  determineUpdatedTerms,
  getPrimaryAndParallelLabels,
  buildBrowseDataDiff,
  fetchLiveBibData,
  buildBrowseDataEvents,
  emitBrowseDataToSqs,
  emitBrowseDataToLocalBti,
  getBrowseDataModels
}
