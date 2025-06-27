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

const getSubjectModels = (sierraRecord) => {
  const marcTags = BibMappings.get('subjectLiteral', sierraRecord)
  return sierraRecord.varFieldsMulti(marcTags, true).map(getPrimaryAndParallelLabels)
}
/**
 *
 * @param {JSONified EsBib[]} recordsToIndex
 * @param {SierraBib[]} sierraRecordsToDelete
 * @returns {{ term: string, type: string}[]}
 */
const buildBibSubjectEvents = async (sierraRecords) => {
  // use built in esBib logic to parse nyplSource and build uri with prefix
  const esRecords = sierraRecords.map((record) => new EsBib(record))
  const idsToFetch = await Promise.all(esRecords.map(async (record) => {
    const uri = await record.uri()
    return uri
  }))
  const staleSubjectLiterals = await fetchStaleSubjectLiterals(idsToFetch)
  const staleSubjectObjects = staleSubjectLiterals.map(subject => ({ preferredTerm: subject }))
  const freshSubjectObjects = sierraRecords.map(getSubjectModels).flat()
  const updateTerms = [...staleSubjectObjects, ...freshSubjectObjects].map((subject) => ({
    ...subject,
    type: 'subjectLiteral'
  }))
  logger.debug(`buildBibSubjectEvents: ${buildSubjectDiff(freshSubjectObjects, staleSubjectObjects).length} subjects actually need updated counts out of ${updateTerms.length} subject update objects generated`)
  return updateTerms
}

const buildSubjectDiff = (fresh, stale) => {
  const subjectsNotPresentInOtherArray = []
  const compareTo = (compareArray) => {
    return (diff, subject) => {
      if (compareArray.findIndex(compareSubject => compareSubject.preferredTerm === subject.preferredTerm) < 0) diff.push(subject)
      return diff
    }
  }
  fresh.reduce(compareTo(stale), subjectsNotPresentInOtherArray)
  stale.reduce(compareTo(fresh), subjectsNotPresentInOtherArray)
  return subjectsNotPresentInOtherArray
}

/**
 *
 * @param {JSONified EsBib | {uri: string}} records
 * @param {elasticsearch client} client
 * @returns {string[]}
 */
const fetchStaleSubjectLiterals = async (ids = []) => {
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
 * This method creates subject update objects for:
 * - current subject literal values from elastic search for all bib ids in sierraBibs
 * - subject literal values generated from the data provided in sierraBibs, including parallel values when relevant
 *
 * It then sends those subject update objects in batches of 10 (max value in SQS batch message) to the bib-browse-term SQS
 */
const emitBibSubjectEvents = async (sierraBibs) => {
  const countEvents = await buildBibSubjectEvents(sierraBibs)
  if (countEvents.length === 0) {
    logger.debug('emitBibSubjectEvents: No bib subject events to emit.')
  }
  const sqsUrl = await kms.decrypt(process.env.ENCRYPTED_SQS_BROWSE_TERM_URL)
  try {
    const sqsClient = new SQSClient({})
    const batchedCommands = buildBatchedCommands(countEvents, sqsUrl)
    logger.debug(`emitBibSubjectEvents: Writing ${countEvents.length} terms in ${batchedCommands.length} batches to SQS stream`)
    const responses = await Promise.allSettled(batchedCommands.map(async (command) => await sqsClient.send(command)))
    const success = responses.filter(({ status }) => status === 'fulfilled')
    const error = responses.filter(({ status }) => status === 'rejected')
    logger.debug(`emitBibSubjectEvents: ${success.length} batches of subjects successfully sent to SQS`)
    if (error.length) logger.debug(`emitBibSubjectEvents: ${error.length} batches of subjects failed to send to SQS`)
  } catch (e) {
    logger.error(`emitBibSubjectEvents error:\n ${e.message}`)
  }
}

module.exports = {
  buildBatchedCommands,
  getPrimaryAndParallelLabels,
  buildSubjectDiff,
  fetchStaleSubjectLiterals,
  buildBibSubjectEvents,
  emitBibSubjectEvents,
  getSubjectModels
}
