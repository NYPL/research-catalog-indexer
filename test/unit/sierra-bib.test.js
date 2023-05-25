const expect = require('chai').expect

const SierraBib = require('../../lib/sierra-models/bib')

describe('SierraBib', function () {
  describe ('getSuppressionWithRationale', function () {
    describe('unsuppressed record', function () {
      const bib = new SierraBib('')
      expect(bib.getSuppressedWithRationale()).to.deep.equal({
        suppressed: false,
        rationale: null
      })
    })

    describe('suppressed record', function () {
      const bib = new SierraBib('')
      expect(bib.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: 'suppressed'
      })
    })

    describe('deleted record', function () {
      const bib = new SierraBib('')
      expect(bib.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: 'deleted'
      })
    })

    describe('otfRecord', function () {
      const bib = new SierraBib('')
      expect(bib.getSuppressedWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: 'is-otf'
      })
    })
  })
})
