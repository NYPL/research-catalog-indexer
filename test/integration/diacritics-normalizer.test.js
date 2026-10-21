const { expect } = require('chai')
const { client } = require('../../lib/elastic-search/client.js')
const dotenv = require('dotenv')

const { indexSettings } = require('../../lib/elastic-search/index-config/index-settings.js')
const { schema } = require('../../lib/elastic-search/index-config/index-schema.js')

const {
  waldenNameVariants,
  dimopulosNameVariants
} = require('./diacritics-normalizer-test-cases.js')

// This index name is enforced throughout the suite; it must never point at
// a real/production index.
const INDEX_NAME = 'resources-diacritics-test'

const nameVariantsByCaseName = {
  waldenNameVariants,
  dimopulosNameVariants
}

describe('Diacritics normalization (_analyze integration)', () => {
  let esClient

  before(async () => {
    dotenv.config({ path: './config/qa.env' })
    process.env.INDEX_NAME = INDEX_NAME
    esClient = await client()

    if (
      await esClient.indices
        .exists({ index: INDEX_NAME })
        .then((resp) => resp.body)
    ) {
      console.log(
        `diacritics integration test setup: \n\tdeleting stale index at ${INDEX_NAME}`
      )
      await esClient.indices.delete({ index: INDEX_NAME })
    }
    console.log(
      `diacritics integration test setup: \n\tcreating new index at ${INDEX_NAME}`
    )
    // Reuse the actual production mapping for contributorLiteral (and its
    // `.folded`/`.keywordLowercasedStripped` subfields) so this test stays
    // in sync with the real schema:
    const { contributorLiteral } = schema()
    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: indexSettings,
        mappings: { properties: { contributorLiteral } }
      }
    })
  })

  after(async () => {
    if (esClient) {
      console.log(
        `diacritics integration test teardown: \n\tdeleting index at ${INDEX_NAME}`
      )

      await esClient.indices.delete({ index: INDEX_NAME })
    }
  })

  const analyze = async (field, text) => {
    const { body } = await esClient.indices.analyze({
      index: INDEX_NAME,
      body: { field, text }
    })
    return body.tokens.map((t) => t.token)
  }

  Object.entries(nameVariantsByCaseName).forEach(([caseName, variants]) => {
    describe(caseName, () => {
      // `contributorLiteral.keywordLowercasedStripped` is what
      // `filters[contributorLiteral]` matches against via an exact `term`
      // query. It is a `keyword` field (no tokenizer), so analyzing it
      // always yields exactly one token representing the whole value.
      describe('contributorLiteral.keywordLowercasedStripped normalizer (filter query path)', () => {
        let normalizedTokensByVariant

        before(async () => {
          normalizedTokensByVariant = {}
          for (const [variantName, text] of Object.entries(variants)) {
            const tokens = await analyze(
              'contributorLiteral.keywordLowercasedStripped',
              text
            )
            normalizedTokensByVariant[variantName] = tokens
          }
        })

        Object.keys(variants).forEach((variantName) => {
          it(`normalizes the "${variantName}" spelling to a single token`, () => {
            expect(normalizedTokensByVariant[variantName]).to.have.lengthOf(1)
          })
        })

        it('normalizes all spellings (NFC, NFD, ...) to the identical token', () => {
          const tokenValues = Object.values(normalizedTokensByVariant).map(
            (tokens) => tokens[0]
          )
          const [firstToken, ...rest] = tokenValues
          rest.forEach((token) => expect(token).to.equal(firstToken))
        })
      })

      // `contributorLiteral.folded` is what a fully-quoted
      // `search_scope=contributor` query phrase-matches against (see
      // discovery-api's `requirePhraseMatch`). It's an analyzed `text`
      // field (icu_tokenizer + icu_folding), so analyzing it yields one
      // token per word.
      describe('contributorLiteral.folded analyzer (quoted search_scope query path)', () => {
        let foldedTokensByVariant

        before(async () => {
          foldedTokensByVariant = {}
          for (const [variantName, text] of Object.entries(variants)) {
            foldedTokensByVariant[variantName] = await analyze(
              'contributorLiteral.folded',
              text
            )
          }
        })

        it('tokenizes all spellings (NFC, NFD, ...) identically', () => {
          const tokenLists = Object.values(foldedTokensByVariant)
          const [firstTokens, ...rest] = tokenLists
          rest.forEach((tokens) => expect(tokens).to.deep.equal(firstTokens))
        })
      })

      // This confirms the two query paths (filter's exact `term` match and
      // search_scope's quoted phrase match) converge on an equivalent
      // normalized representation of the query value - i.e. a document
      // that would phrase-match on `.folded` will also exact-match on
      // `.keywordLowercasedStripped`, regardless of which diacritic
      // encoding form was used to spell the name.
      it('normalizes the filter-query value and the quoted search_scope-query value to the same string', async () => {
        for (const text of Object.values(variants)) {
          const [keywordToken] = await analyze(
            'contributorLiteral.keywordLowercasedStripped',
            text
          )
          const foldedTokens = await analyze('contributorLiteral.folded', text)

          expect(keywordToken).to.equal(foldedTokens.join(' '))
        }
      })
    })
  })
})
