const expect = require('chai').expect
const shelfmark = require('../../lib/utils/shelfmark')

describe('utils/shelfmark', () => {
  describe('normalizedShelfMarkLookup', () => {
    it('builds a lookup', () => {
      const input = [
        'abc 123',
        'abc 123',
        'abc  123', // Contrive a typo
        'jfe 123',
        'jfe 123',
        '[jfe 123]' // Contrive a style change
      ]

      const output = shelfmark.normalizedShelfMarkLookup(input)
      expect(output).to.deep.equal({
        'jfe 123': 'jfe 123',
        'abc 123': 'abc 123',
        'abc  123': 'abc 123', // Typo corrected
        '[jfe 123]': 'jfe 123' // Style change overcome
      })
    })
  })

  describe('cleanShelfmark', () => {
    it('cleans messy shelfMarks', () => {
      expect(shelfmark.cleanShelfMark(['JFE 123 vol. 1 ']))
        .to.equal('jfe 123')
      expect(shelfmark.cleanShelfMark('|zJFE 123 vol. 1 r. 1 library has 17'))
        .to.equal('jfe 123')
    })
  })

  describe('shelfMarksEquivalent', () => {
    it('identifies equivalent shelfmarks', () => {
      expect(shelfmark._private.shelfMarksEquivalent('jfe 123', 'jfe 123456789')).to.equal(true)
      expect(shelfmark._private.shelfMarksEquivalent('jfe 123456789', 'jfe 123')).to.equal(true)
      expect(shelfmark._private.shelfMarksEquivalent('jfe 123', 'jf 123')).to.equal(true)
      expect(shelfmark._private.shelfMarksEquivalent('jfedd 123', 'jfe 123')).to.equal(true)
      expect(shelfmark._private.shelfMarksEquivalent('[jfe 123]', 'jfe 123;;;')).to.equal(true)

      expect(shelfmark._private.shelfMarksEquivalent('jkl 123', 'jfe 123')).to.equal(false)
      expect(shelfmark._private.shelfMarksEquivalent('abc 123', 'jfe 123')).to.equal(false)
    })
  })
})
