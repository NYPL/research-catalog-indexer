const { client } = require('../elastic-search/client')
const EsBib = require('../es-models/bib')
const logger = require('../logger')

const emitCountEvents = async (recordsToIndex, recordsToDelete) => {
  const esClient = await client()
  const countEvents = buildBibSubjectCountEvents(recordsToIndex, recordsToDelete, esClient)
  logger.debug(`writing ${countEvents.length} terms to SQS stream`)
}
/**
 *
 * @param {JSONified EsBib[]} recordsToIndex
 * @param {SierraBib[]} sierraRecordsToDelete
 * @param {elasticsearch client} esClient
 * @returns {{ term: string, type: string}[]}
 */
const buildBibSubjectCountEvents = async (recordsToIndex = [], sierraRecordsToDelete = [], esClient) => {
  // use built in esBib logic to parse nyplSource and build uri with prefix
  const idsToDelete = await Promise.all(sierraRecordsToDelete.map(async (record) => {
    const uri = await new EsBib(record).uri()
    return { uri }
  }))
  const staleSubjects = await fetchStaleSubjectLiterals([
    ...recordsToIndex,
    ...idsToDelete], esClient)
  const freshSubjects = [...recordsToIndex, ...sierraRecordsToDelete].map((record) => record.subjectLiteral || null)
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
const fetchStaleSubjectLiterals = async (records = [], client) => {
  const ids = records?.map((record) => record.uri)
  const subjectLiteralDocs = await client.mget({
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME,
    body: {
      docs: ids.map((id) => {
        return {
          _id: id,
          _source: ['subjectLiteral']
        }
      })
    }
  })
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
