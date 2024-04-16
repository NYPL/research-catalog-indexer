const expect = require('chai').expect
const { schema } = require('../../lib/elastic-search/index-schema')

describe('elastic search schema', () => {
  it('returns the schema', () => {
    const properties = Object.keys(schema())
    expect(properties).to.include('carrierType')
    // At last count, we have 89 bib-level field mappings:
    expect(properties).to.have.lengthOf.above(88)
  })
})
