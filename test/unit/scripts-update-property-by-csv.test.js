const expect = require('chai').expect
const script = require('../../scripts/update-property-by-csv')

describe('scripts/update-property-by-csv', () => {
  describe('parseErroredDocuments', () => {
    it('finds no errors where there are no errors', () => {
      const resp = {
        items: [
          {
            update: {
              status: 200,
              error: false
            }
          }
        ]
      }
      const operations = [
        { op1: {} },
        { op2: {} }
      ]

      expect(script.parseErroredDocuments(resp, operations)).to.deep.equal({
        errored: [],
        missing: []
      })
    })

    it('identifies errors', () => {
      const resp = {
        items: [
          {
            update: {
              status: 404,
              error: true
            }
          },
          {
            update: {
              status: 500,
              error: true
            }
          }
        ]
      }
      const operations = [
        { op1: {} },
        { op2: {} },
        { op3: {} },
        { op4: {} }
      ]

      expect(script.parseErroredDocuments(resp, operations)).to.deep.equal({
        errored: [{
          status: 500,
          error: true,
          operation: { op3: {} },
          document: { op4: {} }
        }],
        missing: [{
          status: 404,
          error: true,
          operation: { op1: {} },
          document: { op2: {} }
        }]
      })
    })
  })

  describe('buildEsBulkOperations', () => {
    it('builds flat array of ES _bulk operations for CSV rows', async () => {
      const inp = [
        [123, 'sierra-nypl', 'a'],
        [456, 'recap-pul', 'z']
      ]

      await expect(script.buildEsBulkOperations(inp, 'prop')).to.eventually.deep.equal([
        { update: { _id: 'b123', _index: 'index-name' } },
        { doc: { prop: 'a' } },
        { update: { _id: 'pb456', _index: 'index-name' } },
        { doc: { prop: 'z' } }
      ])
    })
  })
})
