const expect = require('chai').expect

const sinon = require('sinon')
const rewire = require('rewire')

const esClient = require('../../lib/elastic-search/client')
let esRequests = require('../../lib/elastic-search/requests')
const logger = require('../../lib/logger')

describe('elastic search requests', () => {
  let bulkSpy
  let dateStub
  let records

  before(() => {
    dateStub = sinon.stub(Date, 'now').returns('11:11pm')
  })

  after(() => {
    dateStub.restore()
  })

  beforeEach(() => {
    records = [12345, 23456, 34567].map((uri) => ({ uri, _type: 'resource', _parent: 'mom', otherMetadata: 'meep morp' }))
  })

  describe('_indexGeneric', () => {
    before(() => {
      bulkSpy = sinon.stub().callsFake((body) => Promise.resolve(body))
      sinon.stub(esClient, 'client').resolves({ bulk: bulkSpy })
    })
    afterEach(() => { bulkSpy.resetHistory() })
    after(() => {
      esClient.client.restore()
    })

    it('builds index statements - update', async () => {
      await esRequests.internal._indexGeneric('indexName', records, true)

      const statements = bulkSpy.args[0][0].body
      const updateStatements = statements.filter((s) => s.update)
      // all statements are update statements
      expect(updateStatements).to.have.lengthOf(records.length)
      const docStatements = statements.filter((s) => s.doc && s.doc.updatedAt)
      // all statments had updatedAt added
      expect(docStatements).to.have.lengthOf(records.length)
    })

    it('builds index statements - index', async () => {
      await esRequests.internal._indexGeneric('indexName', records, false)

      const statements = bulkSpy.args[0][0].body
      const indexStatements = statements.filter((s) => s.index)
      // all statements are index statements
      expect(indexStatements).to.have.lengthOf(records.length)
      const docStatements = statements.filter((s) => s.updatedAt)
      // all statements had updatedAt added
      expect(docStatements).to.have.lengthOf(records.length)
    })
  })
  describe('writeRecords', () => {
    it('logs errors', async () => {
      esRequests = rewire('../../lib/elastic-search/requests')

      esRequests.__set__(
        '_indexGeneric',
        () => Promise.resolve({
          body: {
            errors: true,
            items: [
              {
                index: {
                  error: { type: 'ya', reason: 'messed up' }
                }
              }
            ]
          }
        })
      )
      const loggerSpy = sinon.spy(logger, 'error')

      try {
        await esRequests.writeRecords(records)
      } catch (e) {}

      expect(loggerSpy.calledWith('Indexing error: Error updating 12345: ya: messed up')).to.eq(true)
    })
  })
})
