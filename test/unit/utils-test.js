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

  describe('addSierraCheckDigit', () => {
    it('handles invalid inputs', () => {
      expect(utils.addSierraCheckDigit(new Date())).to.equal(null)
      expect(utils.addSierraCheckDigit('foo')).to.equal(null)
    })

    it('handles integers', () => {
      expect(utils.addSierraCheckDigit(1234)).to.equal('12348')
      expect(utils.addSierraCheckDigit(987654321)).to.equal('9876543210')
    })

    it('handles prefixed ids', () => {
      expect(utils.addSierraCheckDigit('b1234')).to.equal('b12348')
      expect(utils.addSierraCheckDigit('b987654321')).to.equal('b9876543210')
      expect(utils.addSierraCheckDigit('cb987654321')).to.equal('cb9876543210')
      expect(utils.addSierraCheckDigit('i15897007')).to.equal('i15897007x')
    })
  })

  describe('sortByAsyncSortKey', () => {
    it('sorts array of values by an async getter', async () => {
      const input = ['element 2', 'element 1', 'element 4', 'element 3']
      const sorted = await utils.sortByAsyncSortKey(input, (element) => Promise.resolve(element))
      expect(sorted).to.deep.equal([
        'element 1', 'element 2', 'element 3', 'element 4'
      ])
    })

    it('sorts array of values by an async member function', async () => {
      const input = [
        { id: 'element 2', sortKey: () => Promise.resolve(2) },
        { id: 'element 1', sortKey: () => Promise.resolve(1) },
        { id: 'element 4', sortKey: () => Promise.resolve(4) },
        { id: 'element 3', sortKey: () => Promise.resolve(3) }
      ]
      const sorted = await utils.sortByAsyncSortKey(input, (element) => element.sortKey())
      expect(sorted.map((el) => el.id)).to.deep.equal([
        'element 1', 'element 2', 'element 3', 'element 4'
      ])
    })

    it('supports reverse sorting', async () => {
      const input = ['element 2', 'element 1', 'element 4', 'element 3']
      const sorted = await utils.sortByAsyncSortKey(input, (element) => Promise.resolve(element), 'desc')
      expect(sorted).to.deep.equal([
        'element 4', 'element 3', 'element 2', 'element 1'
      ])
    })
  })
})
