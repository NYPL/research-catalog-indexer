const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
chai.use(require('sinon-chai'))
const esClient = require('../../lib/elastic-search/client')

describe('elastic search', () => {
  process.env.ELASTICSEARCH_CONNECTION_URI = 'thebomb.com'
  describe('client', () => {
    let _client
    it('creates a client', async () => {
      _client = await esClient.client()
      expect(_client)
    })
    it('returns previously created client', async () => {
      const clientAgain = await esClient.client()
      expect(clientAgain).to.equal(_client)
    })
  })
})
