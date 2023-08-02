const expect = require('chai').expect

const utils = require('../../lib/utils')

describe('utils', () => {
  describe('leftPad', function () {
    it('left pads to specified length', function () {
      expect(utils.leftPad('', 8)).to.equal('00000000')
      expect(utils.leftPad('', 2)).to.equal('00')
      expect(utils.leftPad('what', 8)).to.equal('0000what')
    })

    it('left pads with specified char', function () {
      expect(utils.leftPad('', 8, ' ')).to.equal('        ')
      expect(utils.leftPad('what', 8, ' ')).to.equal('    what')
      expect(utils.leftPad('what', 8, '*')).to.equal('****what')
    })

    it('stringifies non-string inputs', function () {
      expect(utils.leftPad(undefined, 3, ' ')).to.equal('   ')
      expect(utils.leftPad(null, 3, ' ')).to.equal('   ')
      expect(utils.leftPad(10, 3, ' ')).to.equal(' 10')
      expect(utils.leftPad(true, 5, ' ')).to.equal(' true')
    })
  })

  describe('unique', () => {
    it('unique-ifies a simple array', () => {
      expect(utils.unique(['1', '2', '1'])).to.deep.equal(['1', '2'])
      expect(utils.unique(['1', '2', '1', '2', '3'])).to.deep.equal(['1', '2', '3'])
    })
  })

  describe('object de-deuping', () => {
    const input = [
      { key1: 'key1 value 1', key2: 'key2 value 1' },
      { key2: 'key2 value 2' },
      // This one is a dupe and should be removed:
      { key1: 'key1 value 1', key2: 'key2 value 1', key3: 'key3 is ignored in comparison' },
      // This is also a dupe, with reordered keys:
      { key2: 'key2 value 1', key1: 'key1 value 1' },
      { key1: 'key1 value 2' },
      { key1: 'key1 value 1', key2: 'key2 value 2' }
    ]
    const hasher = (entry) => [entry.key1, entry.key2].join('||')

    describe('uniqueObjectsByHash', () => {
      it('uniques objects by hasher function', () => {
        expect(utils.uniqueObjectsByHash(input, hasher)).to.deep.equal([
          { key1: 'key1 value 1', key2: 'key2 value 1' },
          { key2: 'key2 value 2' },
          { key1: 'key1 value 2' },
          { key1: 'key1 value 1', key2: 'key2 value 2' }
        ])
      })
    })

    describe('dupeObjectsByHash', () => {
      it('identifies sets of duplicate objects by hasher function', () => {
        expect(utils.dupeObjectsByHash(input, hasher)).to.deep.equal([
          [
            { key1: 'key1 value 1', key2: 'key2 value 1' },
            { key1: 'key1 value 1', key2: 'key2 value 1', key3: 'key3 is ignored in comparison' },
            { key2: 'key2 value 1', key1: 'key1 value 1' }
          ]
        ])
      })
    })
  })
})
