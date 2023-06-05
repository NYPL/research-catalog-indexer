// const expect = require('chai').expect

// const SierraItem = require('../../lib/sierra-models/item')

describe('SierraItem', function () {
  describe('getSuppressionWithRationale', function () {
    describe('unsuppressed record', function () {
      // const item = new SierraItem('')
      // expect(item.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: false,
      //   rationale: null
      // })
    })

    describe('suppressed record', function () {
      // const item = new SierraItem('')
      // expect(item.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: true,
      //   rationale: ['suppressed']
      // })
    })

    describe('deleted record', function () {
      // const item = new SierraItem('')
      // expect(item.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: true,
      //   rationale: ['deleted']
      // })
    })

    describe('deleted and suppressed', function () {
      // const item = new SierraItem('')
      // expect(item.getSuppressedWithRationale()).to.deep.equal({
      //   suppressed: true,
      //   rationale: ['deleted', 'suppressed']
      // })
    })
  })
})
