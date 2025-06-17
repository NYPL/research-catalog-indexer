const EsBib = require('../es-models/bib')

const buildBibSubjectCountEvents = async (recordsToIndex = [], sierraRecordsToDelete = [], esClient) => {
  const idsToDelete = await Promise.all(sierraRecordsToDelete.map(async (record) => {
    const uri = await new EsBib(record).uri()
    return { uri }
  }))
  const staleSubjects = await fetchStaleSubjectLiterals([
    ...recordsToIndex,
    ...idsToDelete], esClient)
  const freshSubjects = [...recordsToIndex, ...sierraRecordsToDelete]
  const unionOfSubjects = buildUnionOfSubjects([...freshSubjects, ...staleSubjects])

  const updateTerms = unionOfSubjects.map((subjectLiteral) => {
    return { term: subjectLiteral }
  }).flat()
  return [...updateTerms]
}

const buildUnionOfSubjects = (subjects) => {
  return [...new Set(subjects
    .flat()
    .filter(x => x))]
}

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
  }).flat()
}

module.exports = {
  buildUnionOfSubjects,
  fetchStaleSubjectLiterals,
  buildBibSubjectCountEvents
}
