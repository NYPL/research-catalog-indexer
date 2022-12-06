const { stub, spy } = require('sinon')
const eventDecoder = require('../lib/event-decoder')
const index = require('../index')
const requests = require('../lib/platform-api/requests')
const { expect } = require('chai')

describe('index handler function', () => {
  let eventDecoderStub

  afterEach(() => {
    if (eventDecoderStub.resetHistory) {
      eventDecoderStub.resetHistory()
    }
  })
  xdescribe('prefilters', () => {
    it('prefilters a bib', () => {

    })
    it('prefilters an item and fetches bibs', () => {

    })
    it('prefilters a holding and fetches bibs', () => {

    })
  })

  describe('buildSierraBib', () => {
    let bibs
    before(() => {
      const records = Array.from(Array(10).keys()).map((n) => ({ id: `b${n}`, _holdings: [{ id: `h1${n}` }, { id: `h2${n}` }], _items: [{ id: `i1${n}` }, { id: `i2${n}` }] }))
      bibs = index.internal.buildSierraBibs(records)
    })
    it('instantiates bibs with items and holdings', () => {
      expect(bibs.filter((bib) => bib._items.length && bib._holdings.length).length).to.equal(10)
    })
    it('holdings and items are attached to bibs', () => {

    })
  })

  describe('stubbed functions', () => {
    it('prefetches recap customer codes', () => {

    })
    it('creates ESBib for each record', () => {

    })
    it('creates JSON for each record', () => {

    })
  })

  describe('lambda callback', () => {
    eventDecoderStub = stub(eventDecoder, 'decodeRecordsFromEvent').callsFake(async () => {
      return Promise.resolve({ type: 'Holding', records: [{ nyplSource: 'washington-heights', id: '12345678' }] })
    })

    const callback = spy()
    afterEach(() => {
      callback.resetHistory()
      requests.bibsForHoldingsOrItems.restore()
    })
    it('calls lambda callback on error', async () => {
      const error = new Error('meep morp')
      stub(requests, 'bibsForHoldingsOrItems').throws(error)
      await index.handler([], null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(error)
    })
    it('calls lambda callback on no record', async () => {
      stub(requests, 'bibsForHoldingsOrItems').resolves([])
      await index.handler([], null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(null, 'Nothing to do.')
    })
    it('calls lambda callback on successful indexing', async () => {
      stub(requests, 'bibsForHoldingsOrItems').resolves([{ id: '1' }])
      await index.handler([], null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(null, 'Wrote 1 doc(s)')
    })
  })
})
