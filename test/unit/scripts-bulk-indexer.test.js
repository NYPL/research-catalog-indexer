const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-as-promised'))

const sinon = require('sinon')
const fs = require('fs')

const bulkIndexer = require('../../scripts/bulk-indexer/bulk-indexer')
const index = require('../../index')
const prefetchers = require('../../lib/prefetch')
const schema = require('../../lib/elastic-search/index-config/index-schema')
const identifyIdsByMarc = require('../../scripts/identify-ids-by-marc')
// const utils = require('../../scripts/utils')

// Util for stripping dupe whitespace from sql queries:
const removeDupeWhitespace = (sql) => {
  return sql.replace(/\n/g, '')
    .replace(/\s+/g, ' ')
}

// Map anticipated SQL queries to mocked data to return:
const pgFixtures = [
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('1234','5678'\) LIMIT 2/,
    rows: [
      {
        id: 1234,
        nypl_source: 'sierra-nypl',
        var_fields: [{ marcTag: '910', subfields: [{ code: 'a', value: 'RL' }] }]
      },
      {
        id: 5678,
        nypl_source: 'sierra-nypl',
        var_fields: [{ marcTag: '910', subfields: [{ code: 'a', value: 'RL' }] }]
      }
    ]
  },
  {
    match: /^SELECT R.\* FROM \(SELECT \* FROM item WHERE nypl_source = 'sierra-nypl' AND bib_ids \?\| array\['1234', '5678'\]\) _R INNER JOIN bib R ON _R.id=R.id AND _R.nypl_source=R.nypl_source$/,
    rows: [
      {
        id: 456,
        bibIds: [1234, 5678],
        nypl_source: 'sierra-nypl',
        var_fields: []
      }
    ]
  },
  {
    match: /SELECT \* FROM item WHERE nypl_source = 'sierra-nypl' AND bib_ids \?\| array\['1234'\]$/,
    rows: [
      {
        id: 456,
        bibIds: [1234],
        nypl_source: 'sierra-nypl',
        var_fields: []
      }
    ]
  },
  {
    // match: /SELECT \* FROM item WHERE nypl_source = 'sierra-nypl' AND bib_ids \?\| array\['1234'\]/,
    match: /^SELECT \* FROM records WHERE "bibIds" && array\[1234\]$/,
    rows: [
      {
        id: 789,
        bibIds: [1234],
        nypl_source: 'sierra-nypl',
        var_fields: []
      }
    ]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('1234','2345','3456'\) LIMIT 3/,
    rows: [
      { id: 1234 },
      { id: 2345 },
      { id: 3456 }
    ]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('2345','3456','4567'\) LIMIT 3/,
    rows: [
      { id: 2345 },
      { id: 3456 },
      { id: 4567 }
    ]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('1234'\) LIMIT 1/,
    rows: [{ id: 1234 }]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('2345'\) LIMIT 1/,
    rows: [{ id: 2345 }]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('3456'\) LIMIT 1/,
    rows: [{ id: 3456 }]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('5789'\) LIMIT 1/,
    rows: [{ id: 5789 }]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('5678'\) LIMIT 1/,
    rows: [{ id: 5678 }]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('2345','3456'\) LIMIT 2/,
    rows: [{ id: 2345 }, { id: 3456 }]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('4567'\) LIMIT 1/,
    rows: [
      { id: 4567 }
    ]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('5678','5789'\) LIMIT 2/,
    rows: [
      { id: 5678 },
      { id: 5789 }
    ]
  },
  {
    match: /SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('123'\) LIMIT 1/,
    rows: [
      { id: 123 }
    ]
  }
]

/**
* Given a SQL query, returns mocked rows (or throws error if query unmatched).
**/
const mockedRowsForQuery = (sql) => {
  sql = removeDupeWhitespace(sql)
  const matchingFixture = pgFixtures.find((fixture) => fixture.match.test(sql))
  if (!matchingFixture) {
    console.error('Unmocked SQL query:', sql)
    console.info('Add SQL fixture?\n  /' + sql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/')
    throw new Error(`Un-mocked sql query: "${sql}"`)
  }
  return matchingFixture.rows
}

describe('scripts/bulk-indexer', () => {
  // Set up a mock to handle pg query calls:
  const mockedQuery = sinon.spy((q) => {
    const sql = (typeof q === 'string' ? q : q.text)
    const rows = mockedRowsForQuery(sql)

    if (typeof q === 'string') {
      // Querying by string SQL query? Return a promise that resolves the rows:
      return Promise.resolve({ rows })
    } else {
      // Querying with a Cursor? Return a object with a `read` function:
      return {
        read: () => Promise.resolve(rows),
        close: () => null
      }
    }
  })

  beforeEach(() => {
    sinon.stub(bulkIndexer.db, 'initPools').callsFake(() => Promise.resolve())
    sinon.stub(bulkIndexer.db, 'endPools').callsFake(() => Promise.resolve())
    sinon.stub(bulkIndexer.db, 'connect').callsFake(() => {
      return Promise.resolve({
        query: mockedQuery,
        release: () => Promise.resolve()
      })
    })
    mockedQuery.resetHistory()

    sinon.stub(index, 'processRecords').callsFake(() => Promise.resolve())
  })

  afterEach(() => {
    bulkIndexer.db.initPools.restore()
    bulkIndexer.db.endPools.restore()
    bulkIndexer.db.connect.restore()
    index.processRecords.restore()
  })

  describe('updateByCsv', () => {
    const cleanUpStatusFiles = () => {
      const testFiles = [
        './test/fixtures/bulk-index-by-csv-numeric-ids.csv-status.json',
        './test/fixtures/bulk-index-by-csv-ids-with-nypl-source.csv-status.json',
        './test/fixtures/bulk-index-by-csv-prefixed-ids.csv-status.json',
        './nonexistantfile-status.json'
      ]
      testFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
        }
      })
    }

    beforeEach(cleanUpStatusFiles)
    afterEach(cleanUpStatusFiles)

    it('throws error when insufficient config', async () => {
      await expect(bulkIndexer.updateByCsv()).to.be.rejected
      await expect(bulkIndexer.updateByCsv({})).to.be.rejected
    })

    it('throws error when csv invalid', async () => {
      const csv = './nonexistantfile'
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0 })).to.be.rejectedWith('no such file or directory')
    })

    it('given a csv with numeric ids, throws error if type or nyplSource not given', async () => {
      const csv = './test/fixtures/bulk-index-by-csv-numeric-ids.csv'
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0 })).to.be.rejected
      cleanUpStatusFiles()
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0, type: 'bib' })).to.be.rejected
      cleanUpStatusFiles()
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0, nyplSource: 'sierra-nypl' })).to.be.rejected
    })

    it('given a csv with numeric identifieres, processes identified records', async () => {
      const csv = './test/fixtures/bulk-index-by-csv-numeric-ids.csv'
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0, type: 'bib', nyplSource: 'sierra-nypl' })).to.be.fulfilled

      // What records were processed?
      const [type, records] = index.processRecords.getCall(0).args
      expect(type).to.eq('Bib')
      expect(records).to.have.lengthOf(2)
      expect(records[0]).to.deep.include({
        id: 1234,
        nyplSource: 'sierra-nypl'
      })
    })

    it('given a csv w/numeric and nyplSource identifieres, processes identified records', async function () {
      this.timeout(5000)

      const csv = './test/fixtures/bulk-index-by-csv-ids-with-nypl-source.csv'
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0, csvNyplSourceColumn: 1, type: 'bib', batchSize: 3 })).to.be.fulfilled

      // What records were processed?
      const [type, records] = index.processRecords.getCall(0).args
      expect(type).to.eq('Bib')
      expect(records).to.have.lengthOf(3)
      expect(records[0]).to.deep.include({
        id: 1234
      })
    })

    it('given a csv, processes identified records', async () => {
      const csv = './test/fixtures/bulk-index-by-csv-prefixed-ids.csv'
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0 })).to.be.fulfilled

      // What records were processed?
      const [type, records] = index.processRecords.getCall(0).args
      expect(type).to.eq('Bib')
      expect(records).to.have.lengthOf(2)
      expect(records[0]).to.deep.include({
        id: 1234,
        nyplSource: 'sierra-nypl'
      })
    })
  })

  describe('overwriteGeneralPrefetch', () => {
    beforeEach(bulkIndexer._testing.overwriteGeneralPrefetch)
    afterEach(bulkIndexer._testing.restoreGeneralPrefetch)
    it('overwrites general prefetch', () => {
      bulkIndexer._testing.overwriteGeneralPrefetch()
      expect(prefetchers.generalPrefetch(['spaghetti'])).to.eventually.equal(['spaghetti'])
    })
  })
  describe('overWriteSchema', () => {
    afterEach(bulkIndexer._testing.restoreSchema)
    it('overwrites schema with single', () => {
      bulkIndexer._testing.overwriteSchema('dates')
      expect(schema.schema()).to.deep.equal({ uri: true, dates: true })
    })
    it('overwrites schema with multiple properties', () => {
      bulkIndexer._testing.overwriteSchema('dates,subjectLiteral')
      expect(schema.schema()).to.deep.equal({ uri: true, dates: true, subjectLiteral: true })
    })
    it('throws on a property not in original schema', () => {
      try {
        expect(bulkIndexer._testing.overwriteSchema('spaghetti'))
      } catch (e) {
        expect(e.message).to.eq('spaghetti not a valid ES document property')
      }
    })
  })

  describe('modelPrefetch', () => {
    beforeEach(() => {
      bulkIndexer.overwriteModelPrefetch()
    })

    afterEach(() => {
      bulkIndexer.restoreModelPrefetch()
    })

    it('is overwritten by sql connector', async () => {
      await prefetchers.modelPrefetch([
        {
          id: 1234,
          nyplSource: 'sierra-nypl'
        }
      ])

      // Assert that SQL calls made:
      const query1 = mockedQuery.getCall(0).args[0]
      expect(removeDupeWhitespace(query1)).to
        .eq('SELECT * FROM item WHERE nypl_source = \'sierra-nypl\' AND bib_ids ?| array[\'1234\']')
      const query2 = mockedQuery.getCall(1).args[0]
      expect(removeDupeWhitespace(query2)).to
        .eq('SELECT * FROM records WHERE "bibIds" && array[1234]')
    })
  })

  describe('extractAndValidateIdentifiers', () => {
    let sourceMapper
    const mockProgress = {
      addMessage: sinon.stub(),
      updateStatus: sinon.stub()
    }

    before(() => {
      sourceMapper = {
        splitIdentifier: (id) => {
          if (id.startsWith('cb')) return { id: id.slice(2), type: 'bib', nyplSource: 'recap-cul' }
          if (id.startsWith('pb')) return { id: id.slice(2), type: 'bib', nyplSource: 'recap-pul' }
          if (id.startsWith('b')) return { id: id.slice(1), type: 'bib', nyplSource: 'sierra-nypl' }
          return null
        },
        validSource: (source) => {
          return true
        }
      }
    })

    afterEach(() => {
      mockProgress.addMessage.resetHistory()
      mockProgress.updateStatus.resetHistory()
    })

    it('processes a single column CSV with prefixed ids', () => {
      const rows = [['b1234'], ['cb5678'], ['pb9012']]
      const options = { csvIdColumn: 0, offset: 0, csv: 'test.csv' }
      const res = bulkIndexer._testing.extractAndValidateIdentifiers(rows, options, sourceMapper)

      expect(res).to.deep.equal([
        { id: '1234', nyplSource: 'sierra-nypl', type: 'bib' },
        { id: '5678', nyplSource: 'recap-cul', type: 'bib' },
        { id: '9012', nyplSource: 'recap-pul', type: 'bib' }
      ])
    })

    it('processes a two column CSV with non-prefixed ids and nyplSource', () => {
      const rows = [['1234', 'sierra-nypl'], ['5678', 'sierra-nypl']]
      const options = { csvIdColumn: 0, csvNyplSourceColumn: 1, type: 'bib', offset: 0, csv: 'test.csv' }
      const res = bulkIndexer._testing.extractAndValidateIdentifiers(rows, options, sourceMapper)

      expect(res).to.deep.equal([
        { id: '1234', nyplSource: 'sierra-nypl' },
        { id: '5678', nyplSource: 'sierra-nypl' }
      ])
    })

    it('throws error when type is not apparent or specified', () => {
      const rows = [['1234', 'sierra-nypl']]
      const options = { csvIdColumn: 0, csvNyplSourceColumn: 1, offset: 0, csv: 'test.csv' }
      expect(() => bulkIndexer._testing.extractAndValidateIdentifiers(rows, options, sourceMapper))
        .to.throw('Must specify --type if not apparent from CSV')
    })

    it('throws error when nyplSource is not apparent or specified', () => {
      const rows = [['1234']]
      const options = { csvIdColumn: 0, type: 'bib', offset: 0, csv: 'test.csv' }
      expect(() => bulkIndexer._testing.extractAndValidateIdentifiers(rows, options, sourceMapper))
        .to.throw('Must specify --nyplSource if not apparent from CSV (use --csvNyplSourceColumn N if CSV includes nyplSource)')
    })
  })

  describe('barcodeCustomerCodeMapFromCsv', () => {
    it('builds map from CSV', () => {
      const lookup = bulkIndexer._testing.barcodeCustomerCodeMapFromCsv('./test/fixtures/barcode-customer-code-map.csv')
      expect(lookup).to.deep.equal({
        1234: 'NA',
        2345: 'NH',
        3456: 'NA'
      })
    })
  })

  describe('initializeJobState', () => {
    describe('bad restores', () => {
      afterEach(() => {
        fs.readFileSync.restore()
        fs.existsSync.restore()
      })

      const badStatefileContents = [
        // Non-json:
        '',
        // No status:
        JSON.stringify({}),
        JSON.stringify({ params: {} }),
        // No params defined:
        JSON.stringify({ status: 'preparing' })
      ]

      badStatefileContents.forEach((contents) => {
        it(`fails invalid state file (${contents})`, () => {
          sinon.stub(fs, 'existsSync').callsFake(() => true)
          sinon.stub(fs, 'readFileSync').callsFake(() => contents)

          expect(() => bulkIndexer.initializeJobState({}))
            .to.throw('Error restoring state')
        })
      })
    })

    it('builds state from params', () => {
      const params = {
        type: 'bib',
        hasMarc: '123'
      }
      const state = bulkIndexer.initializeJobState(params)
      expect(state).to.be.a('object')
      expect(state.constructor.name).to.eq('BulkIndexJobState')
    })
  })

  describe('resumeJob', () => {
    let state = null

    beforeEach(() => {
      // Build fake state:
      state = {
        basePath: 'fake-job',
        status: () => state._status,
        csvPath: () => null,
        csvCount: () => null,
        addMessage: () => true,
        save: sinon.spy(),
        updateStatus: (s) => {
          state._status = 'completed'
        },
        data: { params: { csvIdColumn: 0, csvNyplSourceColumn: 1, type: 'bib', hasMarc: '123' } }
      }
    })

    it('rejects invalid state', async () => {
      state._status = 'fladeedle'

      bulkIndexer.resumeJob(state)
      await expect(bulkIndexer.resumeJob(state))
        .to.be.rejectedWith('Invalid status: fladeedle')
    })

    it('resumes csv-generation', async () => {
      const buildCsvSpy = sinon.stub(identifyIdsByMarc, '_buildCsv').callsFake(() => true)

      state._status = 'preparing'

      await bulkIndexer.resumeJob(state)
      expect(buildCsvSpy.callCount).to.equal(1)

      identifyIdsByMarc._buildCsv.restore()
    })

    describe('resumes indexing', () => {
      beforeEach(() => {
        sinon.stub(fs, 'readFileSync').callsFake(() => '123,sierra-nypl')
        sinon.stub(bulkIndexer._testing, 'recordsByIds').callsFake(() => [])
      })

      afterEach(() => {
        fs.readFileSync.restore()
        bulkIndexer._testing.recordsByIds.restore()
      })

      it('resumes indexing from 0', async () => {
        state._status = 'indexing'

        await bulkIndexer.resumeJob(state)

        expect(state.save.callCount).to.equal(1)
        expect(state.save.getCall(0).args[0]).to.deep.equal({ offset: 1 })
      })
    })
  })
})
