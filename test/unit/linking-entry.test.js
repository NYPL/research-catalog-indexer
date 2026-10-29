const { sentenceCase } = require('../../lib/utils/linking-entries')
const { expect } = require('chai')

describe('linking entry utils', () => {
  describe('sentenceCase', () => {
    it('formats strings into sentence case', () => {
      expect(sentenceCase('HAS SUBSERIES')).to.equal('Has subseries')
    })
  })
})
