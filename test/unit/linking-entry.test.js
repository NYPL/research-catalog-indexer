const { sentenceCase, sortSubfields, hashObject } = require('../../lib/utils/linking-entries')
const { expect } = require('chai')

describe('linking entry utils', () => {
  describe('hashObject', () => {
    it('outputs the same hash', () => {
      const versionA = {
        a: 'University of Aberdeen. Anatomical and Anthropological Society.',
        t: 'Proceedings of the Aberdeen University Anatomical and Anthropological Society',
        w: ['(DLC)   05041796', '(OCoLC)1642603'],
        x: ['issn', 'another issn'],
        e: 'language code',
        z: 'isbn'
      }
      const versionB = {
        t: 'Proceedings of the Aberdeen University Anatomical and Anthropological Society',
        a: 'University of Aberdeen. Anatomical and Anthropological Society.',
        x: ['issn', 'another issn'],
        e: 'language code',
        w: ['(OCoLC)1642603', '(DLC)   05041796'],
        z: 'isbn'
      }
      expect(hashObject(versionA)).to.equal(hashObject(versionB))
      // DO NOT CHANGE THIS VALUE TO TRY AND FIX TESTS
      expect(hashObject(versionA)).to.equal(8084620108)
    })
    it('outputs a different hash', () => {
      const versionA = {
        a: 'University of Aberdeen. Anatomical and Anthropological Society.',
        t: 'Proceedings of the Aberdeen University Anatomical and Anthropological Society',
        w: ['(DLC)   05041796', '(OCoLC)1642603'],
        x: ['issn', 'another issn'],
        e: 'language code',
        z: 'isbn'
      }
      const versionB = { ...versionA, z: 'isbx' }
      expect(hashObject(versionA)).not.to.deep.equal(hashObject(versionB))
    })
  })
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
