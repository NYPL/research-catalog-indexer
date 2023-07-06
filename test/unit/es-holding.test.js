const { expect } = require('chai')

const EsHolding = require('../../lib/es-models/holding')
const SierraHolding = require('../../lib/sierra-models/holding')

describe('EsHolding model', () => {
  describe('checkInBoxes', () => {
    it('populates checkInBoxes', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
      expect(holding.checkInBoxes()).to.deep.equal([
        {
          coverage: '20 (--)',
          position: 1,
          status: 'Bound',
          type: 'nypl:CheckInBox',
          shelfMark: [
            '*R-SIBL NK9509 .T722 Latest ed.',
            'JBM 07-158 Bound vols.'
          ]
        },
        {
          coverage: '21 (--)',
          position: 2,
          status: 'Expected',
          type: 'nypl:CheckInBox',
          shelfMark: [
            '*R-SIBL NK9509 .T722 Latest ed.',
            'JBM 07-158 Bound vols.'
          ]
        }
      ])
    })
  })

  describe('format', () => {
    it('returns format from field tag i', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1044923.json')))
      expect(holding.format()).to.deep.equal(['PRINT   JULY 10,1999-FEB 24 2001.'])
    })
    it('returns format from varfield 843$a', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
      expect(holding.format()).to.deep.equal(['PRINT     '])
    })
  })

  describe('holdingStatement', () => {
    it('returns holdingStatement', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1032862.json')))
      expect(holding.holdingStatement()).to.deep.equal([
        'Jan 1997-2011. INCOMPLETE',
        '2012-01/02'
      ])
    })
  })

  describe('identifier', () => {
    const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1032862.json')))
    it('returns shelfMark object', () => {
      expect(holding.identifier()).to.deep.equal([{ value: 'Sc Ser.-M .N489', type: 'bf:shelfMark' }])
    })
  })

  describe('location', () => {
    const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
    it('returns location for valid sierra code', () => {
      expect(holding.location()).to.deep.equal([{ code: 'loc:slrb1', label: 'Science, Industry and Business Library (SIBL) - Reference' }])
    })
    it('returns null for unrecognized location', () => {
      const holding = new EsHolding(new SierraHolding({ location: { code: 'not a sierra code' } }))
      expect(holding.location()).to.equal(null)
    })
  })

  describe('physicalLocation', () => {
    it('returns shelfMark', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1089484.json')))
      expect(holding.physicalLocation()).to.deep.equal(holding.shelfMark())
    })
  })

  describe('note', () => {
    it('returns notes array', () => {
      const holding = new EsHolding(new SierraHolding({
        varFields: [{
          ind1: null,
          ind2: null,
          content: 'Checkin **EDITION SPECIALE** here.',
          marcTag: null,
          fieldTag: 'n',
          subfields: null
        },
        {
          ind1: null,
          ind2: null,
          content: 'IRREGULAR',
          marcTag: null,
          fieldTag: 'n',
          subfields: null
        }]
      }))
      expect(holding.note()).to.deep.equal(['Checkin **EDITION SPECIALE** here.', 'IRREGULAR'])
    })
  })

  describe('shelfMark', () => {
    it('returns shelfMark', () => {
      const holding = new EsHolding(new SierraHolding(require('../fixtures/holding-1032862.json')))
      expect(holding.shelfMark()).to.deep.equal(['Sc Ser.-M .N489'])
    })
  })

  describe('uri', () => {
    it('returns prefixed uri', () => {
      const holding = new EsHolding(new SierraHolding({ id: '12345678' }))
      expect(holding.uri()).to.equal('h12345678')
    })
  })
})
