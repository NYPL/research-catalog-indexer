const { stub, spy } = require('sinon')
const rewire = require('rewire')
const { expect } = require('chai')

const eventDecoder = require('../../lib/event-decoder')
const index = require('../../index')
const platformApi = require('../../lib/platform-api/requests')
const elastic = require('../../lib/elastic-search/requests')
const SierraItem = require('../../lib/sierra-models/item')
const SierraHolding = require('../../lib/sierra-models/holding')
const NyplStreamsClient = require('@nypl/nypl-streams-client')
const suppressedBib = require('../fixtures/bib-fake-suppressed.json')
const suppress = require('../../lib/utils/suppressBibs')
const browse = require('../../lib/browse-terms')

describe('index handler function', () => {
  const eventDecoderStub = (type) => stub(eventDecoder, 'decodeRecordsFromEvent').callsFake(async () => {
    return Promise.resolve({ type, records: [{ nyplSource: 'washington-heights', id: '12345678' }] })
  })
  let stubsyB
  let generalPrefetch
  let modelPrefetchStub
  before(() => {
    stubsyB = stub().callsFake(async (bibs) => {
      return Promise.resolve(bibs)
    })
    generalPrefetch = rewire('../../lib/general-prefetch')
    generalPrefetch.__set__('attachRecapCustomerCodes', stubsyB)

    modelPrefetchStub = stub(platformApi, 'modelPrefetch').callsFake(async (bibs) => {
      return await Promise.all(bibs.map((bib) => {
        bib._holdings = [new SierraHolding({ id: 1 })]
        bib._items = [new SierraItem({ id: 1 })]
        return bib
      }))
    })

    // Stub ES writes:
    stub(elastic, 'writeRecords').resolves({ totalProcessed: 1 })
  })

  after(() => {
    modelPrefetchStub.restore()
    if (platformApi.bibsForHoldingsOrItems.restore) {
      platformApi.bibsForHoldingsOrItems.restore()
    }
  })

  afterEach(() => {
    if (eventDecoderStub.resetHistory) {
      eventDecoderStub.resetHistory()
    }
    modelPrefetchStub.resetHistory()
  })
  describe('processRecords', () => {
    it('calls deletions after subject processing has happened', async () => {
      const suppressBibsStub = stub(suppress, 'suppressBibs')
      const emitBibSubjectEventsStub = stub(browse, 'emitBibSubjectEvents')
      await index.processRecords('Bib', [suppressedBib])
      expect(emitBibSubjectEventsStub.calledBefore(suppressBibsStub)).to.equal(true)
    })
  })

  describe('lambda callback', () => {
    const callback = spy()

    afterEach(() => {
      callback.resetHistory()
      platformApi.bibsForHoldingsOrItems.restore()
      eventDecoder.decodeRecordsFromEvent.restore()
    })

    it('calls lambda callback on error', async () => {
      try {
        const error = new Error('meep morp')
        eventDecoderStub('Item')
        stub(platformApi, 'bibsForHoldingsOrItems').throws(error)
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
      stub(platformApi, 'bibsForHoldingsOrItems').resolves([])
      await index.handler([], null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(null, 'Nothing to do.')
    })

    it('calls lambda callback on successful indexing', async () => {
      eventDecoderStub('Item')
      stub(platformApi, 'bibsForHoldingsOrItems').resolves([{ id: '1', nyplSource: 'sierra-nypl', locations: [{ code: 'mal92' }] }])
      // This one will succeed, so will attempt to write to the
      // IndexDocumentProcessed stream:
      const streamStub = stub(NyplStreamsClient.prototype, 'write')
        .callsFake((streamName, records) => {
          return Promise.resolve({ Records: records })
        })

      // Note we can send in an invalid event because of above eventDecoder
      // stub, which always returns a fake item:
      await index.handler('some fake event data', null, callback)
      expect(callback.calledOnce).to.equal(true)
      expect(callback).to.have.been.calledWith(null, 'Wrote 1 doc(s): b1')
      expect(streamStub.calledOnceWith(
        'IndexDocumentProcessed-test',
        [{ id: '1', nyplSource: 'sierra-nypl', nyplType: 'bib' }]
      )).to.equal(true)

      streamStub.restore()
    })
  })

  describe('modelPrefetch', () => {
    it('calls platformApi#modelPrefetch', async () => {
      eventDecoderStub('Item')
      stub(platformApi, 'bibsForHoldingsOrItems').resolves([{ id: '1' }])
      await index.handler([], null, () => { })
      expect(modelPrefetchStub.calledOnce).to.equal(true)
    })
  })
})
