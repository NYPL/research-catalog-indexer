const expect = require('chai').expect

const esClient = require('../../lib/elastic-search/client')

describe('elastic search', () => {
  describe('client', () => {
    beforeEach(() => {
      esClient._resetClient()
    })

    it('creates a client', async () => {
      const client = await esClient.client()
      expect(client)
    })

    it('returns previously created client', async () => {
      const client = await esClient.client()
      const clientAgain = await esClient.client()
      expect(clientAgain).to.equal(client)
    })

    it('calls kms-decrypt only as much as necessary', async () => {
      // Create two clients simultaneously:
      const [client, clientAgain] = await Promise.all([
        esClient.client(),
        esClient.client()
      ])
      expect(clientAgain).to.equal(client)

      // Expect kms-decrypt only called once for each encrypted env var,
      // even though we requested two clients simultaneously
      expect(global.kmsDecryptStub.args).to.have.lengthOf(2)
      expect(global.kmsDecryptStub.args).to.deep.equal([
        ['http://encrypted-uri-1.tld,http://encrypted-uri-2.tld'],
        ['encrypted-api-key']
      ])
    })
  })
})
