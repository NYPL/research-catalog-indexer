const requests = require('../lib/platform-api/requests')
const platformApi = require('../lib/platform-api/client')
const sinon = require('sinon')

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
      expect(getStub.calledOnce).to.eq(true)
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
      await requests.bibById('12345678')
      expect(getStub.calledOnce).to.equal(true)
    })
    it('returns null when there is no bib for that id', () => {
      sinon.stub(platformApi, 'instance').resolves({ get: nullGetStub })
      expect(requests.bibById('12345678')).to.eventually.equal(null)
    })
  })

  describe('bibsForItems', () => {
  })
})
