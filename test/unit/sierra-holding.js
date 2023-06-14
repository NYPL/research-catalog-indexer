// const expect = require('chai').expect

// const SierraHolding = require('../../lib/sierra-models/holding')

describe('SierraHolding', function () {
  describe('getSuppressionWithRationale', function () {
    describe('unsuppressed record', function () {
      // const holding = new SierraHolding('')
      // expect(holding.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: false,
      //   rationale: null
      // })
    })

    describe('suppressed record', function () {
      // const holding = new SierraHolding('')
      // expect(holding.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: true,
      //   rationale: ['suppressed']
      // })
    })

    describe('deleted record', function () {
      // const holding = new SierraHolding('')
      // expect(holding.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: true,
      //   rationale: ['deleted']
      // })
    })

    describe('deleted and suppressed', function () {
      // const holding = new SierraHolding('')
      // expect(holding.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: true,
      //   rationale: ['deleted', 'suppressed']
      // })
    })
  })
})
