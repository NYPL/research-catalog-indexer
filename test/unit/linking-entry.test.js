const { sentenceCase, sortSubfields } = require('../../lib/utils/linking-entries')
const { expect } = require('chai')

describe('linking entry utils', () => {
  describe('sentenceCase', () => {
    it('formats strings into sentence case', () => {
      expect(sentenceCase('HAS SUBSERIES')).to.equal('Has subseries')
    })
  })
  describe('sortSubfields', () => {
    it('sorts subfields based on key', () => {
      const subfieldMap = {
        t: 'Buksz',
        x: '0865-4247',
        w: ['(DLC)   91640083', '(OCoLC)23441218'],
        a: ['xxlast', 'next', 'first']
      }
      expect(sortSubfields(subfieldMap)).to.deep.equal([
        ['a', ['first', 'next', 'xxlast']],
        ['t', ['Buksz']],
        ['w', ['(DLC)   91640083', '(OCoLC)23441218']],
        ['x', ['0865-4247']]
      ])
    })
  })
})
