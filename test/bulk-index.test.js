const { expect } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

describe('bulk-index: dbRestartMode and restartFromId', () => {
  let bulkIndex
  let dbMock
  let indexerMock
  let loggerMock
  let delayMock
  let cursorMock
  let mockClient

  beforeEach(() => {
    cursorMock = {
      read: sinon.stub(),
      close: sinon.stub().callsArgWith(0, null) // standard pg-cursor callback
    }

    mockClient = {
      query: sinon.stub().returns(cursorMock),
      release: sinon.stub()
    }

    dbMock = {
      initPools: sinon.stub().resolves(),
      endPools: sinon.stub().resolves(),
      connect: sinon.stub().resolves(mockClient)
    }

    indexerMock = {
      processRecords: sinon.stub().resolves()
    }

    loggerMock = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    }

    // Stub delay to immediately resolve so tests run instantly
    delayMock = sinon.stub().resolves()

    // Dynamically inject the dependencies into bulk-index using proxyquire
    bulkIndex = proxyquire('../scripts/bulk-index', {
      '../lib/db': dbMock,
      '../lib/indexer': indexerMock,
      '../lib/logger': loggerMock,
      '../lib/utils/delay': delayMock, // Adjust to your actual delay utility path
      'pg-cursor': sinon.stub().returns(cursorMock)
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('Phase 1: Unit Tests for buildSqlQuery', () => {
    it('Appends ORDER BY id when dbRestartMode is true and orderBy is not provided', () => {
      const { query } = bulkIndex.buildSqlQuery({ type: 'bib', dbRestartMode: true })
      expect(query).to.match(/ORDER BY id$/)
    })

    it('Respects existing ORDER BY when dbRestartMode is true', () => {
      const { query } = bulkIndex.buildSqlQuery({ type: 'bib', dbRestartMode: true, orderBy: 'updated_date' })
      expect(query).to.match(/ORDER BY updated_date$/)
      expect(query).to.not.match(/ORDER BY id$/)
    })

    it('Appends restartFromId clause and adds to params array', () => {
      const { query, params } = bulkIndex.buildSqlQuery({ type: 'bib', restartFromId: 1000 })
      expect(query).to.match(/(WHERE|AND) id > \$\d+/)
      expect(params).to.include(1000)
    })
  })

  describe('Phase 2: Mocked Functional Tests for updateByBibOrItemServiceQuery', () => {
    it('Scenario 1: No connections dropped', async () => {
      // Return 2 batches, then empty to signify end
      cursorMock.read
        .onCall(0).callsArgWith(1, null, [{ id: 1 }, { id: 100 }])
        .onCall(1).callsArgWith(1, null, [{ id: 101 }, { id: 200 }])
        .onCall(2).callsArgWith(1, null, [])

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true })

      expect(cursorMock.read.callCount).to.equal(3)
      expect(indexerMock.processRecords.callCount).to.equal(2)
      expect(dbMock.initPools.called).to.equal(false)
      expect(loggerMock.warn.called).to.equal(false)
      expect(loggerMock.error.called).to.equal(false)
    })

    it('Scenario 2: Single connection dropped', async () => {
      cursorMock.read.onCall(0).callsArgWith(1, null, [{ id: 1 }, { id: 100 }])
      cursorMock.read.onCall(1).callsArgWith(1, new Error('Connection terminated'))
      cursorMock.read.onCall(2).callsArgWith(1, null, [{ id: 101 }, { id: 200 }])
      cursorMock.read.onCall(3).callsArgWith(1, null, [])

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true })

      expect(loggerMock.warn.calledWithMatch(/reconnect/i)).to.equal(true)
      expect(delayMock.calledWith(180000)).to.equal(true)
      expect(dbMock.initPools.called).to.equal(true)
      expect(loggerMock.info.calledWithMatch(/Cursor reached the end/i)).to.equal(true)
    })

    it('Scenario 3: Three connections dropped (Permanent Failure)', async () => {
      cursorMock.read.onCall(0).callsArgWith(1, null, [{ id: 1 }, { id: 100 }])
      cursorMock.read.callsArgWith(1, new Error('Connection terminated')) // All subsequent fail

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true })

      expect(delayMock.callCount).to.equal(3)
      expect(dbMock.initPools.callCount).to.equal(3)
      expect(loggerMock.error.calledWithMatch(/Database reconnection failed permanently. Last successfully processed ID: 100/)).to.equal(true)
      expect(dbMock.endPools.called).to.equal(true)
    })

    it('Scenario 4: Connection drops before any records are processed', async () => {
      cursorMock.read.callsArgWith(1, new Error('Connection terminated')) // Fails immediately

      await bulkIndex.updateByBibOrItemServiceQuery({ type: 'bib', dbRestartMode: true })

      expect(delayMock.callCount).to.equal(3)
      expect(loggerMock.error.calledWithMatch(/Database reconnection failed permanently. Last successfully processed ID: (null|undefined)/)).to.equal(true)
      expect(dbMock.endPools.called).to.equal(true)
    })
  })
})
