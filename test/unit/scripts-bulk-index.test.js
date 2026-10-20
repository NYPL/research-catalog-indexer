const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-as-promised'))

const bulkIndexer = require('../../scripts/bulk-indexer/bulk-index')

describe('scripts/bulk-index', () => {
  describe('validateParams', () => {
    it('requires minimal critiera', () => {
      expect(() => bulkIndexer._testing.validateParams({ }))
        .to.throw('Insufficient params')
      expect(() => bulkIndexer._testing.validateParams({ hasMarc: '123' }))
        .to.throw('Insufficient params')
    })

    it('cancels run if properties not specified with updateOnly', () => {
      process.env.UPDATE_ONLY = false

      expect(() => bulkIndexer._testing.validateParams({ properties: 'dates' }))
        .to.throw('Must provide --properties when UPDATE_ONLY=true or --updateOnly true (and vice versa)')
    })

    it('passes sufficient params', () => {
      expect(bulkIndexer._testing.validateParams({ type: 'bib', hasMarc: '123' }))
      expect(bulkIndexer._testing.validateParams({ csv: 'some-csv.csv', type: 'bib' }))
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
})
