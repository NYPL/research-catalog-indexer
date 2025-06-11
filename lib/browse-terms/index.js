const { client } = require('../elastic-search/client')

exports.buildBibSubjectCountEvents = async (recordsToIndex, sierraRecordsToDelete) => {
  const esClient = await client()
  const esRecordsToDelete = fetchStaleSubjectLiterals(sierraRecordsToDelete, esClient)
  const updateTerms = [...recordsToIndex, ...esRecordsToDelete].map((record) => {
    return { term: record.subjectLiteral }
  }).flat()
  return [...updateTerms]
}

const fetchStaleSubjectLiterals = async (sierraRecordsToDelete, client) => {
  const ids = sierraRecordsToDelete.map((record) => record.id)
  const subjectLiteralDocs = await client.mget({
    ids,
    _source: ['subjectLiteral']
  })
  return subjectLiteralDocs.hits.hits.map((hit) => {
    return hit._source.subjectLiteral
  }).flat()
}
