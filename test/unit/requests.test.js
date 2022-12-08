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
  afterEach(() => genericGetStub.resetHistory())
  describe('getSchema', () => {
    afterEach(() => { platformApi.instance.restore() })
    it('makes a get request', async () => {
      stubPlatformApiInstance(genericGetStub)
      await requests.getSchema('bib')
      expect(genericGetStub.calledOnce).to.equal(true)
      expect(genericGetStub).to.have.been.calledWith('current-schemas/bib', { authenticate: false })
    })
    it('throws an error with bad response', async () => {
      sinon.stub(platformApi, 'instance').callsFake(async () => Promise.resolve({ get: nullGetStub }))
      expect(requests.getSchema('bib')).to.eventually.throw()
    })
  })

  describe('bibById', () => {
    afterEach(() => { platformApi.instance.restore() })
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
