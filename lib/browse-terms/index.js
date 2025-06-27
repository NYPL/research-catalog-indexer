const EsBib = require('../es-models/bib')
const logger = require('../logger')
const { fetchPropertyForUris } = require('../elastic-search/requests')
const { BibMappings } = require('../mappings/mappings')
const { Varfield } = require('@nypl/browse-term')
const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs')
const kms = require('../kms')
const { toIndex, toDelete } = require('../../test/fixtures/browse-term-fixtures')
const SierraBib = require('../sierra-models/bib')


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
  logger.debug(`Generated ${buildSubjectDiff(freshSubjectObjects, staleSubjectObjects).length} subjects that need updated count`)
  const updateTerms = [...staleSubjectObjects, ...freshSubjectObjects].map((subject) => ({
    ...subject,
    type: 'subjectLiteral'
  }))
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

const emitBibSubjectEvents = async (recordsToIndex, recordsToDelete) => {
  const countEvents = await buildBibSubjectEvents(recordsToIndex, recordsToDelete)
  if (countEvents.length === 0) {
    logger.debug('emitBibSubjectEvents: No bib subject events to emit.')
  }
  const sqsUrl = await kms.decrypt('AQECAHh7ea2tyZ6phZgT4B9BDKwguhlFtRC6hgt+7HbmeFsrsgAAAKUwgaIGCSqGSIb3DQEHBqCBlDCBkQIBADCBiwYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAy9kBWBQja6U+2PbBMCARCAXhH5e6odgL6XcrsiMULU1pKtf1Zb2aY0inL/J9jWk2d0yw15sWKZK03jIt+32QJ6p45lVW/XJh+8+UGGZFCxuP6p3Pl1cWCWUkIvvaDExfYA8q5H+xR6sLxa7rPhxU0=\\')
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
