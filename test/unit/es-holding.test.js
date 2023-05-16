const { expect } = require('chai')

const EsHolding = require('../../lib/es-models/holding')
const SierraHolding = require('../../lib/sierra-models/holding')

describe('EsHolding model', () => {
  describe('checkInBoxes', () => {
    it('populates checkInBoxes', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
      expect(holding.checkInBoxes()).to.deep.equal([
        {
          copies: null,
          coverage: '20 (--)',
          position: 1,
          status: 'Bound',
          type: 'nypl:CheckInBox'
        },
        {
          copies: null,
          coverage: '21 (--)',
          position: 2,
          status: 'Expected',
          type: 'nypl:CheckInBox'
        }
      ])
    })
  })

  describe('format', () => {
    it('returns format from field tag i', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1044923.json')))
      expect(holding.format()).to.equal('PRINT   JULY 10,1999-FEB 24 2001.')
    })
    it('returns format from varfield 843$a', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
      expect(holding.format()).to.equal('PRINT     ')
    })
  })

  describe('holdingStatement', () => {
    it('returns holdingStatement', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
      console.log(holding.holdingStatement())
    })
  })
})
