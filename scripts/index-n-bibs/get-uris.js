const { client } = require('../../lib/elastic-search/client')

const { searchTerms, query } = require('./index-n-bibs-utils')

const dotenv = require('dotenv')
const fs = require('fs')
dotenv.config({ path: './config/qa.env' })

const NUM_URIS = 10000

const index = async () => {
  const esClient = await client()
  const index = process.env.HYBRID_ES_INDEX
  const results = await Promise.all(
    searchTerms.map(async (term) => {
      const searchBody = {
        size: 2000,
        query: query(term),
        _source: ['uri']
      }
      return await esClient.search({
        index,
        body: searchBody
      })
    })
  )
  const ids = results.map((result) => result.body.hits.hits.map((hit) => hit._id)).flat()
  const dedupedIds = [...new Set(ids)].slice(0, NUM_URIS).join('\n')
  fs.writeFile('scripts/index-n-bibs/uris.csv', dedupedIds, (e) => { if (e) throw e })
}

index().then(() => console.log(`wrote ${NUM_URIS} uris`))
