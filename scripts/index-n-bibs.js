const { client } = require('../lib/elastic-search/client')

const { searchTerms, query } = require('./index-utils')

const dotenv = require('dotenv')
dotenv.config({ path: './config/qa.env' })

const reindex = async (maxNumUris = 10000) => {
  const esClient = await client()
  const index = process.env.HYBRID_ES_INDEX
  const results = await Promise.all(
    searchTerms.map(async (term) => {
      const searchBody = {
        size: 200,
        query: query(term),
        _source: ['uri']
      }
      return await esClient.search({
        index,
        body: searchBody
      })
    })
  )
  const ids = results.map((result) => result.hits.hits.map((hit) => hit._id)).flat()
  return [...new Set(ids)].slice(0, maxNumUris)
}

reindex()
  .then((uris) => {
    console.log(uris)
  })
