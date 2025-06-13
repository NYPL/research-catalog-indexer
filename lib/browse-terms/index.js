const { client } = require('../elastic-search/client')

exports.emitCountsForSubjects = async () => {
  // this method will send subjects to kinesis stream
}

exports.buildBibSubjectCountEvents = async (recordsToIndex = [], sierraRecordsToDelete = []) => {
  const esClient = await client()
  const staleRecords = await fetchStaleSubjectLiterals([
    ...recordsToIndex,
    ...sierraRecordsToDelete], esClient)
  const freshRecords = [...recordsToIndex, ...sierraRecordsToDelete]
  const unionOfSubjects = buildUnionOfSubjects(freshRecords, staleRecords)
  // filter records to index because some of those are deleted
  const updateTerms = unionOfSubjects.map((record) => {
    return { term: record.subjectLiteral }
  }).flat()
  return [...updateTerms]
}

const buildUnionOfSubjects = (freshEsDocs, staleEsDocs) => {
  return [...new Set(freshEsDocs.map((doc, i) => {
    const freshSubjects = doc.subjectLiteral || []
    const staleSubjects = staleEsDocs?.[i]?.subjectLiteral || []
    return [...freshSubjects, ...staleSubjects]
  })
    .flat()
    .filter(x => x))]
}

const fetchStaleSubjectLiterals = async (records = [], client) => {
  const ids = records?.map((record) => record.id)
  // be sure to test what a partial result looks like
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
  return subjectLiteralDocs.body.docs.map((doc) => {
    return doc?._source
  }).flat()
}

// client().then(client => {
//   fetchStaleSubjectLiterals([{
//     id: "b15037771",
//     deleted: true,
//     deletedDate: '2025-01-01'
//   }, {
//     id: "b14555303",
//     deleted: true,
//     deletedDate: '2025-01-01'
//   }, {
//     id: "b17969355",
//     deleted: true,
//     deletedDate: '2025-01-01'
//   },
//   ], client)
// })

module.exports = {
  buildUnionOfSubjects
}