const EsBib = require('../es-models/bib')
const logger = require('../logger')
const { fetchPropertyForUris } = require('../elastic-search/requests')
const { BibMappings } = require('../mappings/mappings')
const { Varfield } = require('@nypl/browse-term')
const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs')
const kms = require('../kms')

const buildBatchedCommands = (subjects, url) => {
  const batchSize = 10
  const batchedSubjects = subjects.reduce((batchArray, subject, index) => {
    const batchIndex = Math.floor(index / batchSize)
    if (!batchArray[batchIndex]) batchArray[batchIndex] = []
    batchArray[batchIndex].push(subject)
    return batchArray
  }, [])
  return batchedSubjects.map(batch => {
    return new SendMessageBatchCommand({
      QueueUrl: url,
      Entries: batch.map((subject, i) => ({
        MessageBody: JSON.stringify(subject),
        Id: `${i}`
      }))
    })
  })
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
    labels.preferredTerm = new Varfield(preferredTerm).label
  }
  if (subjectVarfieldObject.parallel) {
    labels.variant = new Varfield(subjectVarfieldObject.parallel?.marc).label
  }
  return labels
}

const getSubjectModels = async (esRecord) => {
  const marcTags = BibMappings.get('subjectLiteral', esRecord.bib)
  const id = await esRecord.uri()
  return esRecord.bib.varFieldsMulti(marcTags, true).map(getPrimaryAndParallelLabels).map((subject) => ({ ...subject, sourceId: id }))
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
const buildBibSubjectEvents = async (sierraRecords) => {
  // use built in esBib logic to parse nyplSource and build uri with prefix
  const esRecords = sierraRecords
    .filter((record) => record.getIsResearchWithRationale().isResearch)
    .map((record) => new EsBib(record))

  const idsToFetch = await Promise.all(esRecords.map(async (record) => {
    const uri = await record.uri()
    return uri
  }))
  if (!idsToFetch?.length) {
    logger.debug('Skipping browse stream write. No records to fetch or build subjects for.')
    return
  }
  const liveSubjectLiterals = await fetchLiveSubjectLiterals(idsToFetch)
  const liveSubjectObjects = liveSubjectLiterals.map(subject => ({ preferredTerm: subject }))

  const freshSubjectObjects = (await Promise.all(esRecords.map(getSubjectModels))).flat()
  let updateTerms
  if (process.env.INGEST_BROWSE_TERMS === 'true') {
    updateTerms = freshSubjectObjects
  } else updateTerms = await determineUpdatedTerms('subjectLiteral', idsToFetch, esRecords)
  logger.debug(`buildBibSubjectEvents: ${buildSubjectDiff(freshSubjectObjects, liveSubjectObjects).length} subjects actually need updated counts out of ${updateTerms.length} subject update objects generated`)
  return updateTerms
}

const determineUpdatedTerms = async (esResourcesProperty, ids, freshBibData) => {
  const liveSubjectLiterals = await fetchPropertyForUris(ids, esResourcesProperty)
  const terms = await Promise.all(freshBibData.map(async (esBibDoc) => {
    const updatedUri = await esBibDoc.uri()
    const freshSubjects = await getSubjectModels(esBibDoc)
    const liveSubjectsForUri = liveSubjectLiterals.docs?.find(doc => doc?._id === updatedUri)?._source.subjectLiteral.map(subject => ({ preferredTerm: subject }))
    const preferredTermPresentInBoth = (subject) => {
      return liveSubjectsForUri?.find((liveSubject) => { return liveSubject.preferredTerm === subject.preferredTerm })
    }
    const noUpdatedSubjects = freshSubjects
      .every(preferredTermPresentInBoth)

    if (noUpdatedSubjects) return null
    return buildSubjectDiff(freshSubjects, liveSubjectsForUri)
  }))
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
const emitBibSubjectEvents = async (sierraBibs) => {
  if (!process.env.ENCRYPTED_SQS_BROWSE_TERM_URL) return
  const countEvents = await buildBibSubjectEvents(sierraBibs)
  if (countEvents?.length === 0) {
    logger.debug('emitBibSubjectEvents: No bib subject events to emit.')
  }
  const sqsUrl = await kms.decrypt(process.env.ENCRYPTED_SQS_BROWSE_TERM_URL)
  try {
    const sqsClient = new SQSClient({})
    const batchedCommands = buildBatchedCommands(countEvents, sqsUrl)
    logger.info(`emitBibSubjectEvents: Writing ${countEvents.length} terms in ${batchedCommands.length} batches to SQS stream ${sqsUrl}`)
    const responses = await Promise.allSettled(batchedCommands.map(async (command) => await sqsClient.send(command)))
    const success = responses.filter(({ status }) => status === 'fulfilled')
    const error = responses.filter(({ status }) => status === 'rejected')
    logger.info(`emitBibSubjectEvents: ${success.length} batches of subjects successfully sent to SQS`)
    if (error.length) logger.info(`emitBibSubjectEvents: ${error.length} batches of subjects failed to send to SQS.}`)
  } catch (e) {
    logger.error(`emitBibSubjectEvents error:\n ${e.message}`)
  }
}

module.exports = {
  determineUpdatedTerms,
  buildBatchedCommands,
  getPrimaryAndParallelLabels,
  buildSubjectDiff,
  fetchLiveSubjectLiterals,
  buildBibSubjectEvents,
  emitBibSubjectEvents,
  getSubjectModels
}
