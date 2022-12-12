const { stub, spy } = require('sinon')
const eventDecoder = require('../../lib/event-decoder')
const index = require('../../index')
const requests = require('../../lib/platform-api/requests')
const { expect } = require('chai')
const SierraBib = require('../../lib/sierra-models/bib')
const SierraItem = require('../../lib/sierra-models/item')
const SierraHolding = require('../../lib/sierra-models/holding')

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
      // create 10 bibs with two items and two holdings each
      const records = Array.from(Array(10).keys()).map((n) => {
        return {
          id: `b${n}`,
          _holdings: [{ id: `h1${n}` }, { id: `h2${n}` }],
          _items: [{ id: `i1${n}` }, { id: `i2${n}` }]
        }
      })
      bibs = index.internal.buildSierraBibs(records)
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

  xdescribe('stubbed functions', () => {
    it('prefetches recap customer codes', () => {

    })
    it('creates ESBib for each record', () => {

    })
    it('creates JSON for each record', () => {

    })
  })

  describe('lambda callback', () => {
    eventDecoderStub = (type) => stub(eventDecoder, 'decodeRecordsFromEvent').callsFake(async () => {
      return Promise.resolve({ type, records: [{ nyplSource: 'washington-heights', id: '12345678' }] })
    })
    const callback = spy()
    afterEach(() => {
      callback.resetHistory()
      requests.bibsForHoldingsOrItems.restore()
      eventDecoder.decodeRecordsFromEvent.restore()
    })
    it('calls lambda callback on error', async () => {
      try {
        const error = new Error('meep morp')
        eventDecoderStub('Item')
        stub(requests, 'bibsForHoldingsOrItems').throws(error)
        await index.handler([], null, callback)
        expect(callback.calledOnce).to.equal(true)
        expect(callback).to.have.been.calledWith(error)
      } catch (e) {
        // swallow error we want to declutter console
        if (!e.message.includes('Calling back with error: meep morp')) {
          throw e
        }
      }
    })
    it('calls lambda callback on no record', async () => {
      eventDecoderStub('Holding')
      stub(requests, 'bibsForHoldingsOrItems').resolves([])
      await index.handler([], null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(null, 'Nothing to do.')
    })
    it('calls lambda callback on successful indexing', async () => {
      eventDecoderStub('Item')
      stub(requests, 'bibsForHoldingsOrItems').resolves([{ id: '1' }])
      await index.handler([], null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(null, 'Wrote 1 doc(s)')
    })
  })
})