const expect = require('chai').expect

const SierraHolding = require('../../lib/sierra-models/holding')

describe('SierraHolding', function () {
  describe('getSuppressionWithRationale', function () {
    describe('unsuppressed record', function () {
      it('should not suppress record', () => {
        const holding = new SierraHolding({})
        expect(holding.getSuppressionWithRationale()).to.deep.equal({
          suppressed: false,
          rationale: []
        })
      })
    })

    describe('suppressed record', function () {
      it('should show that the record is suppressed', () => {
        const holding = new SierraHolding({ suppressed: true })
        expect(holding.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['suppressed']
        })
      })
    })

    describe('deleted record', function () {
      it('should show that the record is deleted', () => {
        const holding = new SierraHolding({ deleted: true })
        expect(holding.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['deleted']
        })
      })
    })

    describe('deleted and suppressed', function () {
      it('should show both suppressed and deleted', () => {
        const holding = new SierraHolding({ deleted: true, suppressed: true })
        expect(holding.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['deleted', 'suppressed']
        })
      })
    })
  })
})
