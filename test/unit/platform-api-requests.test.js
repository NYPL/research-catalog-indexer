let requests = require('../../lib/platform-api/requests')
const platformApi = require('../../lib/platform-api/client')
const { genericGetStub, nullGetStub, stubPlatformApiInstance } = require('./utils')
const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect
const rewire = require('rewire')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

describe('platform api methods', () => {
  afterEach(() => {
    if (platformApi.instance.restore) platformApi.instance.restore()
    genericGetStub.resetHistory()
    nullGetStub.resetHistory()
  })
  describe('getSchema', () => {
    it('makes a get request', async () => {
      stubPlatformApiInstance(genericGetStub)
      await requests.getSchema('bib')
      expect(genericGetStub.calledOnce).to.equal(true)
      expect(genericGetStub).to.have.been.calledWith('current-schemas/bib', { authenticate: false })
    })
    it('throws an error with bad response', async () => {
      stubPlatformApiInstance(nullGetStub)
      expect(requests.getSchema('bib')).to.eventually.throw()
    })
  })

  describe('bibById', () => {
    it('makes a get request', async () => {
      stubPlatformApiInstance(genericGetStub)
      await requests.bibById('bluestockings-books', '12345678')
      expect(genericGetStub.calledOnce).to.equal(true)
      expect(genericGetStub).to.have.been.calledWith('bibs/bluestockings-books/12345678')
    })
    it('returns null when there is no bib for that id', () => {
      stubPlatformApiInstance(nullGetStub)
      expect(requests.bibById('12345678')).to.eventually.equal(null)
    })
  })

  describe('_holdingsForBibs', () => {
    const bibs = [{ nyplSource: 'sierra-nypl', id: '123' }, { nyplSource: 'sierra-nypl', id: '456' }, { nyplSource: 'sierra-nypl', id: '789' }, { nyplSource: 'your-moms-house', id: '666' }]
    const holdings = { data: [{ bibIds: ['123', '456'] }, { bibIds: ['456'] }, { bibIds: ['789'] }] }
    const getStub = sinon.stub().resolves(holdings)
    it('only fetches for nypl bibs', async () => {
      stubPlatformApiInstance(getStub)
      await requests._holdingsForBibs(bibs)
      expect(getStub.getCall(0).args[0]).to.equal('holdings?bib_ids=123,456,789')
      expect(getStub.callCount).to.equal(1)
    })
    it('returns an array', async () => {
      stubPlatformApiInstance(getStub)
      const holdings = await requests._holdingsForBibs(bibs)
      expect(holdings).to.be.an('Array')
    })
    it('returns null when no holdings are found', async () => {
      stubPlatformApiInstance(nullGetStub)
      const holdings = await requests._holdingsForBibs(bibs)
      expect(holdings.some(h => h === null)).to.equal(true)
    })
  })

  describe('_itemsForOneBib', () => {
    const bib = { nyplSource: 'bluestockings-books', id: '123456' }
    const limit = 3
    const limitItemResponse = { data: Array.from(Array(limit).keys()) }
    it('makes a get request', async () => {
      stubPlatformApiInstance(genericGetStub)
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
      stubPlatformApiInstance(getToRecurse)
      const items = await requests._itemsForOneBib(bib, 0, limit)
      expect(getToRecurse.callCount).to.equal(3)
      expect(items).to.have.length(limit * 2 + 1)
    })
    it('recurses and returns items after no item response', async () => {
      const noItemResponse = { data: [] }
      const getToRecurse = sinon.stub()
      getToRecurse.onFirstCall().resolves(limitItemResponse)
      getToRecurse.onSecondCall().resolves(noItemResponse)
      stubPlatformApiInstance(getToRecurse)
      const items = await requests._itemsForOneBib(bib, 0, limit)
      expect(getToRecurse.callCount).to.equal(2)
      expect(items).to.have.length(limit)
    })
    it('returns null when there is invalid resposne', async () => {
      stubPlatformApiInstance(nullGetStub)
      const items = await requests._itemsForOneBib(bib)
      expect(nullGetStub.callCount).to.equal(1)
      expect(items).to.equal(null)
    })
  })

  describe('bibsForHoldingsORItems - items', () => {
    const items = Array.from(Array(10).keys()).map((n) => ({ id: 'i' + n }))
    afterEach(() => {
      if (platformApi.instance.restore) {
        platformApi.instance.restore()
      }
    })
    it('should make get requests per bib identifier', async () => {
      stubPlatformApiInstance(genericGetStub)

      const bibs = await requests.bibsForHoldingsOrItems('Item', items)

      expect(genericGetStub.callCount).to.equal(10)
      expect(bibs).to.have.length(10)
      expect(genericGetStub).to.have.been.calledWith('bibs/Tatooine/bi0')
    })

    it('should call _bibidentifiersforitems', async () => {
      const idSpy = sinon.stub().resolves([])
      requests = rewire('../../lib/platform-api/requests')
      requests.__set__('_bibIdentifiersForItems', idSpy)
      stubPlatformApiInstance(genericGetStub)

      await requests.bibsForHoldingsOrItems('Item', items)

      expect(idSpy.calledOnce).to.equal(true)
    })
    it('should filter out bad responses', async () => {
      requests = require('../../lib/platform-api/requests')
      genericGetStub.onCall(3).resolves(null)
      stubPlatformApiInstance(genericGetStub)

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
      stubPlatformApiInstance(genericGetStub)
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
