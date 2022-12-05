const { stub, spy } = require('sinon')
const { handler, internal: { buildSierraBibs } } = require('../index')
const eventDecoder = require('../lib/event-decoder')
const stubz = require('../lib/stubzzz')
const { expect } = require('chai')

describe('index handler function', () => {
  before(() => {
    stub(eventDecoder, 'decodeRecordsFromEvent').resolvesArg(0)
  })
  xdescribe('prefilters', () => {
    it('prefilters a bib', () => {
      const prefilterSpy = spy(stubz, 'prefilterBibs')
      handler({ type: 'Bib' })
      expect(prefilterSpy.calledOnce).to.equal(true)
      prefilterSpy.restore()
    })
    it('prefilters an item and fetches bibs', () => {
      const prefilterSpy = spy(stubz, 'prefilterItems')
      handler({ type: 'Bib' })
      expect(prefilterSpy.calledOnce).to.equal(true)
    })
    it('prefilters a holding and fetches bibs', () => {

    })
  })

  describe('buildSierraBib', () => {
    let bibs
    before(() => {
      const records = Array.from(Array(10).keys()).map((n) => ({ id: `b${n}`, _holdings: [{ id: `h1${n}` }, { id: `h2${n}` }], _items: [{ id: `i1${n}` }, { id: `i2${n}` }] }))
      bibs = buildSierraBibs(records)
    })
    it('instantiates bibs with items and holdings', () => {
      expect(bibs.filter((bib) => bib._items.length && bib._holdings.length).length).to.equal(10)
    })
    it('holdings and items are attached to bibs', () => {

    })
  })

  it('prefetches recap customer codes', () => {

  })
  it('creates ESBib for each record', () => {

  })
  it('creates JSON for each record', () => {

  })
  it('calls lambda callback on error', () => {

  })
  it('calls lambda callback on no record', () => {

  })
  it('calls lambda callback on successful indexing', () => {

  })
})
