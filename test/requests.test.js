const requests = require('../lib/platform-api/requests')
const platformApi = require('../lib/platform-api/client')
const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

describe('platform api methods', () => {
  let getStub
  const genericGetStub = () => sinon.stub().resolves({ data: {} })
  const nullGetStub = sinon.stub().resolves({})

  describe('getSchema', () => {
    afterEach(() => { platformApi.instance.restore() })
    it('makes a get request', async () => {
      getStub = genericGetStub()
      sinon.stub(platformApi, 'instance').resolves({ get: getStub })
      await requests.getSchema('bib')
      expect(getStub.calledOnce).to.equal(true)
      expect(getStub).to.have.been.calledWith('current-schemas/bib', { authenticate: false })
    })
    it('throws an error with bad response', async () => {
      sinon.stub(platformApi, 'instance').callsFake(async () => Promise.resolve({ get: nullGetStub }))
      expect(requests.getSchema('bib')).to.eventually.throw()
    })
  })

  describe('bibById', () => {
    afterEach(() => { platformApi.instance.restore() })
    it('makes a get request', async () => {
      getStub = genericGetStub()
      sinon.stub(platformApi, 'instance').resolves({ get: getStub })
      await requests.bibById('bluestockings-books', '12345678')
      expect(getStub.calledOnce).to.equal(true)
      expect(getStub).to.have.been.calledWith('bibs/bluestockings-books/12345678')
    })
    it('returns null when there is no bib for that id', () => {
      sinon.stub(platformApi, 'instance').resolves({ get: nullGetStub })
      expect(requests.bibById('12345678')).to.eventually.equal(null)
    })
  })

  describe('bibsForHoldingsORItems - items', () => {
    let getStub
    const items = Array.from(Array(10).keys()).map((n) => ({ id: 'i' + n }))
    afterEach(() => {
      if (platformApi.instance.restore) {
        platformApi.instance.restore()
      }
    })
    it('should make get requests per bib identifier', async () => {
      getStub = genericGetStub()
      sinon.stub(platformApi, 'instance').resolves({ get: getStub })
      const bibs = await requests.bibsForHoldingsOrItems('Item', items)
      expect(getStub.callCount).to.equal(10)
      expect(bibs).to.have.length(10)
      expect(getStub).to.have.been.calledWith('bibs/Tatooine/bi0')
    })
    xit('should call _bibidentifiersforitems', async () => {
      const idSpy = sinon.spy(requests, '_bibIdentifiersForItems')
      getStub = genericGetStub()
      sinon.stub(platformApi, 'instance').resolves({ get: getStub })
      await requests.bibsForHoldingsOrItems('Item', items)
      console.log(idSpy.callCount)
      expect(idSpy.calledOnce).to.equal(true)
    })
    it('should filter out bad responses', async () => {
      getStub = genericGetStub().onCall(3).resolves(null)
      sinon.stub(platformApi, 'instance').resolves({ get: getStub })
      const bibs = await requests.bibsForHoldingsOrItems('Items', items)
      expect(getStub.callCount).to.equal(10)
      expect(bibs).to.have.length(9)
    })
  })

  describe('bibsForHoldingsOrItems - holdings', () => {
    let getStub

    xit('should invoke _bibIdentifiersForHoldings', async () => {
      const holdings = Array.from(Array(10).keys()).map((n) => ({ bibIds: ['b' + n + 1, 'b' + n + 2], id: 'h' + n }))
      getStub = genericGetStub()
      sinon.stub(platformApi, 'instance').resolves({ get: getStub })
      const idSpy = sinon.spy(requests, '_bibIdentifiersForHoldings')
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
