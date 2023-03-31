let requests = require('../../lib/platform-api/requests')
const platformApi = require('../../lib/platform-api/client')
const { genericGetStub, nullGetStub, stubPlatformApiGetRequest } = require('./utils')
const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect
const rewire = require('rewire')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

describe('platform api methods', () => {
  afterEach(() => {
    if (platformApi.client.restore) platformApi.client.restore()
    genericGetStub.resetHistory()
    nullGetStub.resetHistory()
  })
  describe('m2CustomerCodesForBarcodes', () => {
    it('returns empty object with no barcodes', async () => {
      const codes = await requests.m2CustomerCodesForBarcodes()
      expect(codes).to.deep.equal({})
    })
    it('returns populated map when there are barcodes', async () => {
      const barcodeGetStub = () => ({ status: 200, data: [{ barcode: 123, m2CustomerCode: 'XX' }, { barcode: 456, m2CustomerCode: 'YY' }] })
      stubPlatformApiGetRequest(barcodeGetStub)

      const barcodesMap = await requests.m2CustomerCodesForBarcodes([123, 456])

      expect(barcodesMap).to.deep.equal({ 123: 'XX', 456: 'YY' })
    })

    it('recurses and returns the map - all barcodes have customercodes', async () => {
      const numBarcodes = 5
      const lotsOfBarcodes = Array.from(Array(numBarcodes)).map((x, i) => `${i}`)
      const get = sinon.stub().resolves({ status: 200, data: lotsOfBarcodes.map(barcode => ({ barcode, m2CustomerCode: 'm2' + barcode })) })
      stubPlatformApiGetRequest(get)
      const barcodesMap = await requests.m2CustomerCodesForBarcodes(lotsOfBarcodes, 0, {}, 2)
      expect(get.callCount).to.equal(3)
      expect(barcodesMap).to.deep.equal({ 0: 'm20', 1: 'm21', 2: 'm22', 3: 'm23', 4: 'm24' })
    })

    it('recurses and returns the map - not all barcodes have customercodes', async () => {
      const numBarcodes = 5
      const lotsOfBarcodes = Array.from(Array(numBarcodes)).map((x, i) => `${i}`)
      const get = sinon.stub()
      get.onFirstCall().resolves({
        status: 200,
        data: [{ barcode: 1, m2CustomerCode: 'm1' }]
      })
      get.onSecondCall().resolves({
        status: 200,
        data: [{ barcode: 3, m2CustomerCode: 'm3' }]
      })
      get.onThirdCall().resolves({ status: 400 })
      stubPlatformApiGetRequest(get)
      const barcodesMap = await requests.m2CustomerCodesForBarcodes(lotsOfBarcodes, 0, {}, 2)
      expect(get.callCount).to.equal(3)
      expect(barcodesMap).to.deep.equal({ 1: 'm1', 3: 'm3' })
    })

    it('recurses and returns the map - no barcodes have customercodes', async () => {
      const numBarcodes = 5
      const lotsOfBarcodes = Array.from(Array(numBarcodes)).map((x, i) => `${i}`)
      stubPlatformApiGetRequest(() => ({ status: 400 }))
      const barcodesMap = await requests.m2CustomerCodesForBarcodes(lotsOfBarcodes, 0, {}, 2)
      expect(barcodesMap).to.deep.equal({})
    })
  })

  describe('getSchema', () => {
    it('makes a get request', async () => {
      stubPlatformApiGetRequest(genericGetStub)
      await requests.getSchema('bib')
      expect(genericGetStub.calledOnce).to.equal(true)
      expect(genericGetStub).to.have.been.calledWith('current-schemas/bib', { authenticate: false })
    })
    it('throws an error with bad response', async () => {
      stubPlatformApiGetRequest(nullGetStub)
      expect(requests.getSchema('bib')).to.eventually.throw()
    })
  })

  describe('bibById', () => {
    it('makes a get request', async () => {
      stubPlatformApiGetRequest(genericGetStub)
      await requests.bibById('bluestockings-books', '12345678')
      expect(genericGetStub.calledOnce).to.equal(true)
      expect(genericGetStub).to.have.been.calledWith('bibs/bluestockings-books/12345678')
    })
    it('returns null when there is no bib for that id', () => {
      stubPlatformApiGetRequest(nullGetStub)
      expect(requests.bibById('12345678')).to.eventually.equal(null)
    })
  })

  describe('modelPrefetch', () => {
    let bibs
    const setUpTests = (h, i) => {
      bibs = [{ nyplSource: 'sierra-nypl', id: '123' }, { nyplSource: 'sierra-nypl', id: '456' }, { nyplSource: 'sierra-nypl', id: '789' }]
      requests = rewire('../../lib/platform-api/requests')
      requests.__set__('_holdingsForBibs', () => Promise.resolve(h))
      requests.__set__('_itemsForArrayOfBibs', () => Promise.resolve(i))
    }
    it('adds holdings to bibs - 1:1', async () => {
      const holdings = [{ id: '1', bibIds: ['123'] }, { id: '2', bibIds: ['456'] }, { id: '3', bibIds: ['789'] }]
      setUpTests(holdings, [])
      await requests.modelPrefetch(bibs)
      expect(bibs.every((bib) => bib._holdings.length === 1))
    })
    it('adds holdings to bibs - 1:N', async () => {
      const holdings = [{ id: '1', bibIds: ['123', '456', '789'] }, { id: '2', bibIds: ['456'] }, { id: '3', bibIds: ['789'] }]
      setUpTests(holdings, [])
      await requests.modelPrefetch(bibs)
      expect(bibs).to.deep.equal([{
        nyplSource: 'sierra-nypl',
        id: '123',
        _holdings: [holdings[0]],
        _items: []
      }, {
        nyplSource: 'sierra-nypl',
        id: '456',
        _holdings: [holdings[0], holdings[1]],
        _items: []
      }, {
        nyplSource: 'sierra-nypl',
        id: '789',
        _holdings: [holdings[0], holdings[2]],
        _items: []
      }])
    })
    it('adds items to bibs', async () => {
      const items = [{ bibIds: ['123'] }, { bibIds: ['456'] }, { bibIds: ['789'] }]
      setUpTests([], items)
      await requests.modelPrefetch(bibs)
      expect(bibs).to.deep.equal([{
        nyplSource: 'sierra-nypl',
        id: '123',
        _holdings: [],
        _items: [items[0]]
      }, {
        nyplSource: 'sierra-nypl',
        id: '456',
        _holdings: [],
        _items: [items[1]]
      }, {
        nyplSource: 'sierra-nypl',
        id: '789',
        _holdings: [],
        _items: [items[2]]
      }])
    })
  })

  describe('_holdingsForBibs', () => {
    const bibs = [{ nyplSource: 'sierra-nypl', id: '123' }, { nyplSource: 'sierra-nypl', id: '456' }, { nyplSource: 'sierra-nypl', id: '789' }, { nyplSource: 'your-moms-house', id: '666' }]
    const holdings = { data: [{ bibIds: ['123', '456'] }, { bibIds: ['456'] }, { bibIds: ['789'] }] }
    const getStub = sinon.stub().resolves(holdings)
    it('only fetches for nypl bibs', async () => {
      stubPlatformApiGetRequest(getStub)
      await requests._holdingsForBibs(bibs)
      expect(getStub.getCall(0).args[0]).to.equal('holdings?bib_ids=123,456,789')
      expect(getStub.callCount).to.equal(1)
    })
    it('returns an array', async () => {
      stubPlatformApiGetRequest(getStub)
      const holdings = await requests._holdingsForBibs(bibs)
      expect(holdings).to.be.an('Array')
    })
    it('returns null when no holdings are found', async () => {
      stubPlatformApiGetRequest(nullGetStub)
      const holdings = await requests._holdingsForBibs(bibs)
      expect(holdings.some(h => h === null)).to.equal(true)
    })
  })

  describe('_itemsForOneBib', () => {
    const bib = { nyplSource: 'bluestockings-books', id: '123456' }
    const limit = 3
    const limitItemResponse = { data: Array.from(Array(limit).keys()) }
    it('makes a get request', async () => {
      stubPlatformApiGetRequest(genericGetStub)
      await requests._itemsForOneBib(bib)
      expect(genericGetStub.calledOnce).to.equal(true)
      expect(genericGetStub).to.have.been.calledWith(`bibs/${bib.nyplSource}/${bib.id}/items?limit=500&offset=0`)
    })
    it('recurses and then returns items', async () => {
      const underLimitItemResponse = { data: Array.from(Array(1).keys()) }
      const getToRecurse = sinon.stub()
      getToRecurse.onFirstCall().resolves(limitItemResponse)
      getToRecurse.onSecondCall().resolves(limitItemResponse)
      getToRecurse.onThirdCall().resolves(underLimitItemResponse)
      stubPlatformApiGetRequest(getToRecurse)
      const items = await requests._itemsForOneBib(bib, 0, limit)
      expect(getToRecurse.callCount).to.equal(3)
      expect(items).to.have.length(limit * 2 + 1)
    })
    it('recurses and returns items after no item response', async () => {
      const noItemResponse = { data: [] }
      const getToRecurse = sinon.stub()
      getToRecurse.onFirstCall().resolves(limitItemResponse)
      getToRecurse.onSecondCall().resolves(noItemResponse)
      stubPlatformApiGetRequest(getToRecurse)
      const items = await requests._itemsForOneBib(bib, 0, limit)
      expect(getToRecurse.callCount).to.equal(2)
      expect(items).to.have.length(limit)
    })
    it('returns null when there is invalid resposne', async () => {
      stubPlatformApiGetRequest(nullGetStub)
      const items = await requests._itemsForOneBib(bib)
      expect(nullGetStub.callCount).to.equal(1)
      expect(items).to.equal(null)
    })
  })

  describe('bibsForHoldingsORItems - items', () => {
    const items = Array.from(Array(10).keys()).map((n) => ({ id: 'i' + n }))
    afterEach(() => {
      if (platformApi.client.restore) {
        platformApi.client.restore()
      }
    })
    it('should make get requests per bib identifier', async () => {
      stubPlatformApiGetRequest(genericGetStub)

      const bibs = await requests.bibsForHoldingsOrItems('Item', items)

      expect(genericGetStub.callCount).to.equal(10)
      expect(bibs).to.have.length(10)
      expect(genericGetStub).to.have.been.calledWith('bibs/Tatooine/bi0')
    })

    it('should call _bibidentifiersforitems', async () => {
      const idSpy = sinon.stub().resolves([])
      requests = rewire('../../lib/platform-api/requests')
      requests.__set__('_bibIdentifiersForItems', idSpy)
      stubPlatformApiGetRequest(genericGetStub)

      await requests.bibsForHoldingsOrItems('Item', items)

      expect(idSpy.calledOnce).to.equal(true)
    })
    it('should filter out bad responses', async () => {
      requests = require('../../lib/platform-api/requests')
      genericGetStub.onCall(3).resolves(null)
      stubPlatformApiGetRequest(genericGetStub)

      const bibs = await requests.bibsForHoldingsOrItems('Items', items)

      expect(genericGetStub.callCount).to.equal(10)
      expect(bibs).to.have.length(9)
    })
  })

  describe('bibsForHoldingsOrItems - holdings', () => {
    let genericGetStub

    it('should invoke _bibIdentifiersForHoldings', async () => {
      const idSpy = sinon.stub().resolves([])
      requests = rewire('../../lib/platform-api/requests')
      requests.__set__('_bibIdentifiersForHoldings', idSpy)
      const holdings = Array.from(Array(10).keys()).map((n) => ({ bibIds: ['b' + n + 1, 'b' + n + 2], id: 'h' + n }))
      stubPlatformApiGetRequest(genericGetStub)
      await requests.bibsForHoldingsOrItems('Holding', holdings)
      expect(idSpy.callCount).to.equal(1)
    })
  })

  describe('_bibIdentifiersForHoldings', () => {
    const holdings = Array.from(Array(10).keys()).map((n) => ({ bibIds: ['b' + n + 1, 'b' + n + 2], id: 'h' + n }))
    it('returns a 1-D array', () => {
      const bibIds = requests._bibIdentifiersForHoldings(holdings)
      expect(bibIds).to.deep.equal(bibIds.flat())
    })
  })
})
