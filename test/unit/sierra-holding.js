const expect = require('chai').expect

const SierraHolding = require('../../lib/sierra-models/holding')

describe('SierraHolding', function () {
  describe ('getSuppressionWithRationale', function () {
    describe('unsuppressed record', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressedWithRationale()).to.deep.equal({
        suppressed: false,
        rationale: null
      })
    })

    describe('partner record with 876 x', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: ['876 $x']
      })
    })

    describe('partner record with 900 a', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: ['900 $a']
      })
    })

    describe('deleted record', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: ['deleted']
      })
    })

    describe('nypl record with item type 50', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: ['catalogItemType']
      })
    })

    describe('nypl record with fixed item code s/w/d/p', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: ['fixed "Item Code 2"']
      })
    })

    describe('record with multiple suppression rationales', function () {
      const holding = new SierraHolding('')
      expect(holding.getSuppressionWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: []
      })
    })
  })
})
