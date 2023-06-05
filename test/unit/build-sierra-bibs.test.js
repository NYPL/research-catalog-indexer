const expect = require('chai').expect

const { buildSierraBibs } = require('../../lib/build-es-document')
const SierraBib = require('../../lib/sierra-models/bib')
const SierraItem = require('../../lib/sierra-models/item')
const SierraHolding = require('../../lib/sierra-models/holding')

describe('buildSierraBib', () => {
  let bibs
  before(() => {
    // create 10 bibs with two items and two holdings each
    const records = Array.from(Array(10).keys()).map((n) => {
      return {
        id: `b${n}`,
        _holdings: [{ id: `h1${n}` }, { id: `h2${n}` }],
        _items: [{ id: `i1${n}` }, { id: `i2${n}` }]
      }
    })
    bibs = buildSierraBibs(records)
  })
  it('instantiates bibs with items and holdings', () => {
    expect(bibs.filter((bib) => bib._items.length && bib._holdings.length).length).to.equal(10)
    expect(bibs[0].items()[0]).to.be.instanceOf(SierraItem)
    expect(bibs[0].holdings()[0]).to.be.instanceOf(SierraHolding)
  })
  it('holdings are attached to bibs', () => {
    const bibOnHolding = bibs[0].holdings()[0].bibs()
    expect(bibOnHolding).to.have.length(1)
    expect(bibOnHolding[0]).to.be.instanceOf(SierraBib)
  })
  it('items are attached to bibs', () => {
    const bibOnItem = bibs[0].items()[0].bibs()
    expect(bibOnItem).to.have.length(1)
    expect(bibOnItem[0]).to.be.instanceOf(SierraBib)
  })
})
