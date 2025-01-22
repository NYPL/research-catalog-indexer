const expect = require('chai').expect

const SierraBib = require('../../lib/sierra-models/bib')

describe('SierraBib', function () {
  describe('getSuppressionWithRationale', function () {
    it('should return false/null for unsuppressed record', function () {
      const bib = new SierraBib(require('../fixtures/bib-10001936.json'))
      expect(bib.getSuppressionWithRationale()).to.deep.equal({
        suppressed: false,
        rationale: null
      })
    })

    it('should return true/suppressed for suppressed record', function () {
      const bib = new SierraBib(require('../fixtures/bib-10001936-suppressed.json'))
      expect(bib.getSuppressionWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: 'Suppressed'
      })
    })

    it('should return true/deleted for deleted record', function () {
      const bib = new SierraBib(require('../fixtures/bib-10001936-deleted.json'))
      expect(bib.getSuppressionWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: 'Deleted'
      })
    })

    describe('otfRecord', function () {
      it('should return true/otf for record with os location', function () {
        const bib = new SierraBib(require('../fixtures/bib-10001936-os.json'))
        expect(bib.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: 'Is OTF'
        })
      })

      it('should return true/otf for record with varfield 910a RLOTF', function () {
        const bib = new SierraBib(require('../fixtures/bib-10001936-910a.json'))
        expect(bib.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: 'Is OTF'
        })
      })

      it('should return true/otf for record with varfield 910a RLOTF alonside varfield BL', function () {
        const bib = new SierraBib(require('../fixtures/bib-10001936-rlotf.json'))
        expect(bib.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: 'Is OTF'
        })
      })
    })

    describe('rlAndBlRecord', function () {
      it('should return true for record with BL and RL in 910a', function () {
        const bib = new SierraBib(require('../fixtures/bib-11606020.json'))
        expect(bib.getIsResearchWithRationale()).to.deep.equal({
          isResearch: true,
          rationale: '910 $a is BL,RL'
        })
      })
    })
  })
})
