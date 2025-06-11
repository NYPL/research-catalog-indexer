const { client } = require('../elastic-search/client')

exports.buildBibSubjectCountEvents = async (recordsToIndex, sierraRecordsToDelete) => {
  const esClient = await client()
  const esRecordsToDelete = fetchStaleEsDocuments(record, client)
  const updateTerms = [...recordsToIndex, ...esRecordsToDelete].map((record) => {
    return { term: record.subjectLiteral }
  }).flat()
  return [...updateTerms]
}

const fetchStaleEsDocuments = async (sierraRecordsToDelete) => {
  const ids = sierraRecordsToDelete.map((record) => record.id)
  client.get(id)

}
