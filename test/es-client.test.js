const chai = require('chai')
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
chai.use(require('sinon-chai'))
const esClient = require('../lib/elastic-search/client')

describe('elastic search', () => {
  process.env.ELASTICSEARCH_CONNECTION_URI = 'thebomb.com'
  describe('client', () => {
    let client
    it('creates a client', async () => {
      client = await esClient.internal._client()
      expect(client)
    })
    it('returns previously created client', async () => {
      const clientAgain = await esClient.internal._client()
      expect(clientAgain).to.equal(client)
    })
  })
  describe('_indexGeneric', () => {
    const records = [12345, 23456, 34567].map((uri) => ({ uri, _type: 'resource', _parent: 'mom' }))
    const clientStub = sinon.stub(esClient.internal, '_client').resolves({ bulk: (body) => Promise.resolve(body) })
    it('builds index statement', async () => {
      await esClient.internal._indexGeneric('indexName', records, true)
      expect(clientStub).to.have.been.calledWith()
    })
    it('adds updatedAt property', () => {

    })
    it('updates or indexes as expected')
  })
})
