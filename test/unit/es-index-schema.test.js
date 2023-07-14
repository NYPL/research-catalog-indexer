const expect = require('chai').expect
const { schema } = require('../../lib/elastic-search/index-schema')

describe('elastic search schema', () => {
  it('returns the schema', () => {
    const properties = Object.keys(schema())
    expect(properties).to.include('carrierType')
    expect(properties.length).to.equal(84)
  })
})
