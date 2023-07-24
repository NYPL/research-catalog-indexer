const expect = require('chai').expect

const {
  enumerationChronologySortFromEsRanges,
  arrayToEsRangeObject
} = require('../../lib/utils/es-ranges')

describe('utils/es-ranges', () => {
  describe('enumerationChronologySortFromEsRanges', () => {
    it('enumerationChronologySortFromEsRanges returns null for bad ranges', () => {
      expect(enumerationChronologySortFromEsRanges(null, null)).to.equal(null)
      expect(enumerationChronologySortFromEsRanges([], null)).to.equal(null)
      expect(enumerationChronologySortFromEsRanges([1, 2], null)).to.equal(null)
      expect(enumerationChronologySortFromEsRanges([1, 2], 2999)).to.equal(null)
      expect(enumerationChronologySortFromEsRanges({ gte: 1, lte: 2 }, { gte: 1, lte: 2 })).to.equal(null)
    })

    it('enumerationChronologySortFromEsRanges builds sort string', () => {
      // Expect something covering vols 1-100 and dates 1900-2000 to use lowest numbers in those ranges:
      expect(enumerationChronologySortFromEsRanges(
        [{ gte: 1, lte: 100 }],
        [{ gte: 1900, lte: 2000 }]
      )).to.eq('         1-1900')

      // When there are multiple ranges, lowest is chosen:
      expect(enumerationChronologySortFromEsRanges(
        [{ gte: 1, lte: 50 }, { gte: 60, lte: 100 }],
        [{ gte: 1970, lte: 2000 }, { gte: 1900, lte: 1950 }]
      )).to.eq('         1-1900')

      // Only one range needs to have a gte prop:
      expect(enumerationChronologySortFromEsRanges(
        [{ lte: 2 }],
        [{ gte: 1900, lte: 2000 }]
      )).to.eq('          -1900')
    })
  })

  describe('arrayToEsRangeObject', () => {
    it('renders ranges as gte/lte object', () => {
      expect(arrayToEsRangeObject([1, 100])).to.deep.equal({ gte: 1, lte: 100 })
    })
  })
})
