const EsBib = require('../es-models/bib')
const logger = require('../logger')
const { fetchPropertyForUris } = require('../elastic-search/requests')

const emitCountEvents = async (recordsToIndex, recordsToDelete) => {
  const countEvents = buildBibSubjectCountEvents(recordsToIndex, recordsToDelete)
  logger.debug(`writing ${countEvents.length} terms to SQS stream`)
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
  const staleSubjects = await fetchStaleSubjectLiterals(idsToFetch)
  const freshSubjects = esRecords.map((record) => record.subjectLiteral() || null)
  const unionOfSubjects = buildUnionOfSubjects([...freshSubjects, ...staleSubjects])
  logger.debug(`Generated ${buildSubjectDiff(freshSubjects, staleSubjects).length} subjects that need updated count`)
  const updateTerms = unionOfSubjects.map((subjectLiteral) => {
    return { term: subjectLiteral, type: 'subjectLiteral' }
  }).flat()
  return updateTerms
}

const buildSubjectDiff = (fresh, stale) => {
  const subjectsNotPresentInOtherArray = []
  const compareTo = (compareArray) => {
    return (diff, subject) => {
      if (compareArray.indexOf(subject) < 0) diff.push(subject)
      return diff
    }
  }
  fresh.reduce(compareTo(stale), subjectsNotPresentInOtherArray)
  stale.reduce(compareTo(fresh), subjectsNotPresentInOtherArray)
  return subjectsNotPresentInOtherArray
}

const buildUnionOfSubjects = (subjects) => {
  return [...new Set(subjects
    .flat()
    .filter(x => x))]
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
    return doc?._source?.subjectLiteral || null
  }).flat().filter(x => x)
}

module.exports = {
  buildSubjectDiff,
  buildUnionOfSubjects,
  fetchStaleSubjectLiterals,
  buildBibSubjectCountEvents,
  emitCountEvents
}
