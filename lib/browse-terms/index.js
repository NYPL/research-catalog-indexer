const EsBib = require('../es-models/bib')
const logger = require('../logger')
const { fetchPropertyForUris } = require('../elastic-search/requests')
const { BibMappings } = require('../mappings/mappings')
const { Varfield } = require('@nypl/browse-term')

const emitCountEvents = async (recordsToIndex, recordsToDelete) => {
  const countEvents = buildBibSubjectCountEvents(recordsToIndex, recordsToDelete)
  logger.debug(`writing ${countEvents.length} terms to SQS stream`)
}

const getPrimaryAndParallelLabels = (subjectVarfieldObject) => {
  const labels = {}
  const preferredTerm = { ...subjectVarfieldObject.marc, fieldTag: 'd' }
  labels.preferredTerm = new Varfield(preferredTerm).label
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
const buildBibSubjectCountEvents = async (sierraRecords) => {
  // use built in esBib logic to parse nyplSource and build uri with prefix
  const esRecords = sierraRecords.map((record) => new EsBib(record))
  const idsToFetch = await Promise.all(esRecords.map(async (record) => {
    const uri = await record.uri()
    return uri
  }))
  // ['spaghetti', 'meatballs']
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

module.exports = {
  getPrimaryAndParallelLabels,
  buildSubjectDiff,
  fetchStaleSubjectLiterals,
  buildBibSubjectCountEvents,
  emitCountEvents
}
