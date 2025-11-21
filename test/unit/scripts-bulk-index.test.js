const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-as-promised'))

const sinon = require('sinon')

const logger = require('../../lib/logger')
const bulkIndexer = require('../../scripts/bulk-index')
const index = require('../../index')
const prefetchers = require('../../lib/prefetch')
const schema = require('../../lib/elastic-search/index-schema')

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

describe('scripts/bulk-index', () => {
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
  describe('validateParams', () => {
    it('cancels run if properties not specified with updateOnly', () => {
      process.env.UPDATE_ONLY = false
      const errorLogSpy = sinon.spy(logger, 'error')
      bulkIndexer._testing.validateParams({ properties: 'dates' })
      expect(errorLogSpy.calledWith('Error: Must provide --properties when UPDATE_ONLY=true or --updateOnly true (and vice versa)')).to.eq(true)
    })
  })
  describe('updateByCsv', () => {
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
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0, type: 'bib' })).to.be.rejected
      await expect(bulkIndexer.updateByCsv({ csv, csvIdColumn: 0, nyplSource: 'sierra-nypl' })).to.be.rejected
    })

    it('given a csv, processes identified records', async () => {
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

  describe('buildSqlQuery', () => {
    it('builds sql for single bib', () => {
      expect(bulkIndexer.buildSqlQuery({ bibId: '1234', nyplSource: 'sierra-nypl' }))
        .to.deep.eq({
          query: [
            'SELECT * FROM bib',
            '      WHERE nypl_source = $1',
            '      AND id = $2 LIMIT 1'
          ].join('\n'),
          params: ['sierra-nypl', '1234'],
          type: 'bib'
        })
    })

    it('builds sql for array of ids', () => {
      expect(bulkIndexer.buildSqlQuery({ ids: ['1234'], nyplSource: 'some-source', type: 'table_name' }))
        .to.deep.eq({
          query: [
            'SELECT * FROM table_name',
            '      WHERE nypl_source = $1',
            "      AND id IN ('1234') LIMIT 1"
          ].join('\n'),
          params: ['some-source'],
          type: 'table_name'
        })
    })

    it('builds sql for has-marc query', () => {
      expect(bulkIndexer.buildSqlQuery({ hasMarc: '123', nyplSource: 'some-source', type: 'table_name' }))
        .to.deep.eq({
          query: [
            'SELECT R.* FROM (',
            'SELECT DISTINCT id, nypl_source FROM table_name,',
            'json_array_elements(var_fields::json) jV',
            'WHERE nypl_source = $1',
            "AND jV->>'marcTag' = $2",
            ') _R INNER JOIN table_name R ON _R.id=R.id AND _R.nypl_source=R.nypl_source'
          ].join('\n'),
          params: ['some-source', '123'],
          type: 'table_name'
        })
    })

    it('builds sql for type query', () => {
      expect(bulkIndexer.buildSqlQuery({ type: 'table_name' }))
        .to.deep.eq({
          query: [
            'SELECT * FROM table_name'
          ].join('\n'),
          params: [],
          type: 'table_name'
        })
    })
  })
})
