const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-as-promised'))

const sinon = require('sinon')

const bulkIndexer = require('../../scripts/bulk-index')
const index = require('../../index')
const modelPrefetcher = require('../../lib/model-prefetch')

// Util for stripping dupe whitespace from sql queries:
const removeDupeWhitespace = (sql) => {
  return sql.replace(/\n/g, '')
    .replace(/\s+/g, ' ')
}

// Map anticipated SQL queries to mocked data to return:
const pgFixtures = [
  {
    match: /^SELECT \* FROM bib WHERE nypl_source = \$1 AND id IN \('1234'\) LIMIT 1$/,
    rows: [
      {
        id: 1234,
        nypl_source: 'sierra-nypl',
        var_fields: [{ marcTag: '910', subfields: [{ code: 'a', value: 'RL' }] }]
      }
    ]
  },
  {
    match: /^SELECT \* FROM item WHERE nypl_source = 'sierra-nypl' AND bib_ids \?\| array\['1234'\]$/,
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

  describe('updateByCsv', () => {
    it('throws error when insufficient config', async () => {
      await expect(bulkIndexer.updateByCsv()).to.be.rejected
      await expect(bulkIndexer.updateByCsv({})).to.be.rejected
    })

    it('throws error when csv invalid', async () => {
      const csv = './nonexistantfile'
      await expect(bulkIndexer.updateByCsv({ csv, csvPrefixedIdColumn: 0 })).to.be.rejectedWith('no such file or directory')
    })

    it('given a csv, processes identified records', async () => {
      const csv = './test/fixtures/bulk-index-by-csv.csv'
      await expect(bulkIndexer.updateByCsv({ csv, csvPrefixedIdColumn: 0 })).to.be.fulfilled

      // What records were processed?
      const [type, records] = index.processRecords.getCall(0).args
      expect(type).to.eq('Bib')
      expect(records).to.have.lengthOf(1)
      expect(records[0]).to.deep.include({
        id: 1234,
        nyplSource: 'sierra-nypl'
      })
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
      await modelPrefetcher.modelPrefetch([
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
          query: 'SELECT * FROM bib\n      WHERE nypl_source = $1\n      AND id = $2 LIMIT 1',
          params: ['sierra-nypl', '1234'],
          type: 'bib'
        })
    })

    it('builds sql for array of ids', () => {
      expect(bulkIndexer.buildSqlQuery({ ids: ['1234'], nyplSource: 'some-source', type: 'table_name' }))
        .to.deep.eq({
          query: 'SELECT * FROM table_name\n      WHERE nypl_source = $1\n      AND id IN (\'1234\') LIMIT 1',
          params: ['some-source'],
          type: 'table_name'
        })
    })

    it('builds sql for has-marc query', () => {
      expect(bulkIndexer.buildSqlQuery({ hasMarc: '123', nyplSource: 'some-source', type: 'table_name' }))
        .to.deep.eq({
          query: [
            'SELECT * FROM table_name,',
            '      json_array_elements(var_fields::json) jV',
            '      WHERE nypl_source = $1',
            '      AND jV->>\'marcTag\' = $2'
          ].join('\n'),
          params: ['some-source', '123'],
          type: 'table_name'
        })
    })
  })
})
