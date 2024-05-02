const expect = require('chai').expect

const esClient = require('../../lib/elastic-search/client')

describe('elastic search', () => {
  process.env.ELASTICSEARCH_CONNECTION_URI = 'http://example.com'

  describe('client', () => {
    it('creates a client', async () => {
      const client = await esClient.client()
      expect(client)
    })

    it('returns previously created client', async () => {
      const client = await esClient.client()
      const clientAgain = await esClient.client()
      expect(clientAgain).to.equal(client)
    })
  })
})
