const { expect } = require('chai')
const { client } = require('../../lib/elastic-search/client.js')
const dotenv = require('dotenv')

const indexSettings = require('../../lib/elastic-search/index-config/identifiers.json')
const {
  bnumberCases,
  lccnCases,
  isbnCases,
  issnCases,
  oclcCases
} = require('./id2nyql-test-cases.js')

// This index name is enforced throughout the suite; it must never point at
// a real/production index.
const INDEX_NAME = 'resources-identifiers-test'

// Each case map from ID2NYQL/testcases.js exercises the identically-named
// field (and its normalizer) defined in ID2NYQL/settings.json.
const FIELD_BY_CASE_MAP = {
  bnumberCases: 'bnumber',
  lccnCases: 'lccn',
  isbnCases: 'isbn',
  issnCases: 'issn',
  oclcCases: 'oclc'
}

const caseMapsByName = { bnumberCases, lccnCases, isbnCases, issnCases, oclcCases }

describe('ID2NYQL identifier normalizers (_analyze integration)', () => {
  let esClient

  before(async () => {
    dotenv.config({ path: './config/qa.env' })
    process.env.INDEX_NAME = INDEX_NAME
    esClient = await client()

    if (await esClient.indices.exists({ index: INDEX_NAME }).then((resp) => resp.body)) {
      console.log(`identifiers integration test setup: \n\tdeleting stale index at ${INDEX_NAME}`)
      await esClient.indices.delete({ index: INDEX_NAME })
    }
    console.log(`identifiers integration test setup: \n\tcreating new index at ${INDEX_NAME}`)

    await esClient.indices.create({ index: INDEX_NAME, body: indexSettings })
  })

  after(async () => {
    if (esClient) {
      console.log(`identifiers integration test teardown: \n\tdeleting index at ${INDEX_NAME}`)

      await esClient.indices.delete({ index: INDEX_NAME })
    }
  })

  Object.entries(caseMapsByName).forEach(([caseMapName, cases]) => {
    const field = FIELD_BY_CASE_MAP[caseMapName]

    describe(`${field} normalizer (${caseMapName})`, () => {
      Object.entries(cases).forEach(([input, expected]) => {
        it(`normalizes "${input}" to "${expected}"`, async () => {
          const { body } = await esClient.indices.analyze({
            index: INDEX_NAME,
            body: {
              field,
              text: String(input)
            }
          })
          expect(body.tokens).to.have.lengthOf(1)
          expect(body.tokens[0].token).to.equal(expected)
        })
      })
    })
  })
})
