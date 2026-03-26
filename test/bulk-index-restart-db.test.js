const { expect } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

class FakeTimer {
  startTimer () {}

  endTimer () {}

  howMany () {}
}

const makeCursor = () => ({
  read: sinon.stub(),
  close: sinon.stub().callsFake((cb) => cb && cb())
})

const makeClient = (cursor) => ({
  query: sinon.stub().returns(cursor),
  release: sinon.stub()
})

const loadBulkIndex = () => {
  const delay = sinon.stub().resolves()
  const logger = {
    debug: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    setLevel: sinon.stub()
  }
  const indexer = {
    processRecords: sinon.stub().resolves()
  }
  const CursorCtor = sinon.stub().callsFake((query, params) => ({ query, params }))

  const bulkIndex = proxyquire.noCallThru()('../scripts/bulk-index', {
    minimist: sinon.stub().returns({
      batchSize: 100,
      dryrun: false,
      updateOnly: false,
      offset: 0,
      limit: null,
      properties: ''
    }),
    pg: { Pool: class FakePool {} },
    'pg-cursor': CursorCtor,
    '../index': indexer,
    '../lib/logger': logger,
    '../lib/kms.js': { decrypt: sinon.stub().resolves('x') },
    '../lib/prefetch.js': {},
    '../lib/prefilter': {
      filteredSierraItemsForItems: (items) => items,
      filteredSierraHoldingsForHoldings: (holdings) => holdings
    },
    '../lib/elastic-search/index-schema.js': { schema: () => ({ uri: true }) },
    '../lib/load-core-data.js': { loadNyplCoreData: sinon.stub().resolves() },
    '../lib/errors.js': {
      SkipPrefetchError: class SkipPrefetchError extends Error {}
    },
    '../lib/elastic-search/requests.js': {
      setIndexToNoRefresh: sinon.stub().resolves(),
      setIndexRefresh: sinon.stub().resolves()
    },
    '../lib/scsb/requests': {
      populateBarcodeRecapCustomerCodeCache: sinon.stub()
    },
    './utils': {
      batch: (arr, size = 100) => {
        const result = []
        for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
        return result
      },
      groupIdentifierEntitiesByTypeAndNyplSource: () => [],
      delay,
      die: sinon.stub(),
      camelize: (value) => value.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()),
      capitalize: (value) => value.slice(0, 1).toUpperCase() + value.slice(1),
      printProgress: sinon.stub(),
      setAwsProfile: sinon.stub(),
      Timer: FakeTimer
    }
  })

  return {
    bulkIndex,
    delay,
    indexer,
    logger,
    CursorCtor
  }
}

describe('bulk-index restart mode test plan (new suite)', () => {
  afterEach(() => {
    sinon.restore()
  })

  describe('Phase 1: buildSqlQuery', () => {
    it('appends ORDER BY id when dbRestartMode is true and orderBy is not provided', () => {
      const { bulkIndex } = loadBulkIndex()

      const { query } = bulkIndex.buildSqlQuery({ type: 'bib', dbRestartMode: true })

      expect(query).to.match(/ORDER BY id$/)
    })

    it('respects existing ORDER BY when dbRestartMode is true', () => {
      const { bulkIndex } = loadBulkIndex()

      const { query } = bulkIndex.buildSqlQuery({ type: 'bib', dbRestartMode: true, orderBy: 'updated_date' })

      expect(query).to.match(/ORDER BY updated_date$/)
      expect(query).to.not.match(/ORDER BY id$/)
    })

    it('appends restartFromId clause and includes value in params', () => {
      const { bulkIndex } = loadBulkIndex()

      const { query, params } = bulkIndex.buildSqlQuery({ type: 'bib', restartFromId: 1000 })

      expect(query).to.match(/(WHERE|AND) id > \$\d+/)
      expect(params).to.include(1000)
    })
  })

  describe('Phase 2: updateByBibOrItemServiceQuery', () => {
    it('Scenario 1: no dropped connections', async () => {
      const { bulkIndex, indexer, logger } = loadBulkIndex()
      const cursor = makeCursor()
      const client = makeClient(cursor)

      sinon.stub(bulkIndex.db, 'connect').resolves(client)
      sinon.stub(bulkIndex.db, 'initPools').resolves()
      sinon.stub(bulkIndex.db, 'endPools')

      cursor.read.onCall(0).resolves([{ id: 1 }, { id: 100 }])
      cursor.read.onCall(1).resolves([{ id: 101 }, { id: 200 }])
      cursor.read.onCall(2).resolves([])

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true, batchSize: 100 })

      expect(cursor.read.callCount).to.equal(3)
      expect(indexer.processRecords.callCount).to.equal(2)
      expect(bulkIndex.db.initPools.called).to.equal(false)
      expect(logger.warn.called).to.equal(false)
      expect(logger.error.called).to.equal(false)
    })

    it('Scenario 2: one dropped connection resumes from last processed id', async () => {
      const { bulkIndex, delay, logger, CursorCtor } = loadBulkIndex()

      const firstCursor = makeCursor()
      const secondCursor = makeCursor()
      const firstClient = makeClient(firstCursor)
      const secondClient = makeClient(secondCursor)

      sinon.stub(bulkIndex.db, 'connect')
        .onCall(0).resolves(firstClient)
        .onCall(1).resolves(secondClient)
      sinon.stub(bulkIndex.db, 'initPools').resolves()
      sinon.stub(bulkIndex.db, 'endPools')

      firstCursor.read.onCall(0).resolves([{ id: 1 }, { id: 100 }])
      firstCursor.read.onCall(1).rejects(new Error('Connection terminated'))

      secondCursor.read.onCall(0).resolves([{ id: 101 }, { id: 200 }])
      secondCursor.read.onCall(1).resolves([])

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true, batchSize: 100 })

      expect(logger.warn.calledWithMatch(/Attempting to reconnect/i)).to.equal(true)
      expect(delay.called).to.equal(true)
      expect(bulkIndex.db.initPools.calledOnce).to.equal(true)
      expect(CursorCtor.callCount).to.equal(2)

      const secondQuery = CursorCtor.getCall(1).args[0]
      const secondParams = CursorCtor.getCall(1).args[1]
      expect(secondQuery).to.match(/(WHERE|AND) id > \$\d+/)
      expect(secondParams).to.include(100)
      expect(logger.info.calledWithMatch(/Cursor reached the end/i)).to.equal(true)
    })

    it('Scenario 3: three dropped connections logs permanent failure and shuts down pools', async () => {
      const { bulkIndex, logger } = loadBulkIndex()

      const cursors = [makeCursor(), makeCursor(), makeCursor(), makeCursor()]
      const clients = cursors.map((cursor) => makeClient(cursor))

      const connectStub = sinon.stub(bulkIndex.db, 'connect')
      clients.forEach((client, index) => connectStub.onCall(index).resolves(client))

      sinon.stub(bulkIndex.db, 'initPools').resolves()
      sinon.stub(bulkIndex.db, 'endPools')

      cursors[0].read.onCall(0).resolves([{ id: 1 }, { id: 100 }])
      cursors[0].read.onCall(1).rejects(new Error('Connection terminated'))

      cursors.slice(1).forEach((cursor) => {
        cursor.read.rejects(new Error('Connection terminated'))
      })

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true, batchSize: 100 })

      expect(bulkIndex.db.initPools.callCount).to.equal(3)
      expect(logger.error.calledWithMatch('Database reconnection failed permanently. Last successfully processed ID: 100')).to.equal(true)
      expect(bulkIndex.db.endPools.calledOnce).to.equal(true)
    })

    it('Scenario 4: dropped connection before first batch logs null lastProcessedId', async () => {
      const { bulkIndex, logger } = loadBulkIndex()

      const cursors = [makeCursor(), makeCursor(), makeCursor(), makeCursor()]
      const clients = cursors.map((cursor) => makeClient(cursor))

      const connectStub = sinon.stub(bulkIndex.db, 'connect')
      clients.forEach((client, index) => connectStub.onCall(index).resolves(client))

      sinon.stub(bulkIndex.db, 'initPools').resolves()
      sinon.stub(bulkIndex.db, 'endPools')

      cursors.forEach((cursor) => {
        cursor.read.rejects(new Error('Connection terminated'))
      })

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true, batchSize: 100 })

      expect(bulkIndex.db.initPools.callCount).to.equal(3)
      expect(logger.error.calledWithMatch('Database reconnection failed permanently. Last successfully processed ID: null')).to.equal(true)
      expect(bulkIndex.db.endPools.calledOnce).to.equal(true)
    })
  })

  describe('Phase 3: secondary disasters', () => {
    it('Scenario 5: elastic write style failures trigger three process retries in bulk-index', async () => {
      const { bulkIndex, indexer, delay } = loadBulkIndex()
      const cursor = makeCursor()
      const client = makeClient(cursor)

      sinon.stub(bulkIndex.db, 'connect').resolves(client)
      sinon.stub(bulkIndex.db, 'initPools').resolves()
      sinon.stub(bulkIndex.db, 'endPools')

      indexer.processRecords.rejects(new Error('Elastic timeout'))
      cursor.read.onCall(0).resolves([{ id: 1 }, { id: 100 }])
      cursor.read.onCall(1).resolves([])

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true, batchSize: 100 })

      expect(indexer.processRecords.callCount).to.equal(3)
      const retryDelayCalls = delay.getCalls().filter((call) => call.args[0] === 3000)
      expect(retryDelayCalls.length).to.equal(3)
    })

    it('Scenario 6: emitBrowseTerms logs and swallows SQS errors', async () => {
      const logger = { info: sinon.stub(), warn: sinon.stub(), error: sinon.stub() }
      const sendStub = sinon.stub().rejects(new Error('SQS down'))

      const browseTerms = proxyquire.noCallThru()('../lib/browse-terms', {
        '../logger': logger,
        '../kms': { decrypt: sinon.stub().resolves('https://sqs.example') },
        '@aws-sdk/client-sqs': {
          SQSClient: class FakeSQSClient {
            send (...args) {
              return sendStub(...args)
            }
          },
          SendMessageCommand: class SendMessageCommand {
            constructor (payload) {
              this.payload = payload
            }
          }
        }
      })

      process.env.ENCRYPTED_SQS_BROWSE_TERM_URL = 'encrypted://url'
      const esDocuments = [{ browseTermData: { subject: [{ label: 'a', variant: 'b' }], contributor: [] } }]

      await browseTerms.emitBrowseTerms(esDocuments, 'subject')

      expect(logger.error.called).to.equal(true)
    })

    it('Scenario 7: prefetch-like failures get three process retries in bulk-index', async () => {
      const { bulkIndex, indexer, delay } = loadBulkIndex()
      const cursor = makeCursor()
      const client = makeClient(cursor)

      sinon.stub(bulkIndex.db, 'connect').resolves(client)
      sinon.stub(bulkIndex.db, 'initPools').resolves()
      sinon.stub(bulkIndex.db, 'endPools')

      indexer.processRecords.rejects(new Error('itemService connection lost during prefetch'))
      cursor.read.onCall(0).resolves([{ id: 1 }, { id: 100 }])
      cursor.read.onCall(1).resolves([])

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true, batchSize: 100 })

      expect(indexer.processRecords.callCount).to.equal(3)
      const retryDelayCalls = delay.getCalls().filter((call) => call.args[0] === 3000)
      expect(retryDelayCalls.length).to.equal(3)
    })
  })
})
