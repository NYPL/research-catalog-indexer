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

  describe('sortByKey', () => {
    it('sorts array of values by a getter', () => {
      const input = ['element 2', 'element 1', 'element 4', 'element 3']
      const sorted = utils.sortByKey(input, (element) => element)
      expect(sorted).to.deep.equal([
        'element 1', 'element 2', 'element 3', 'element 4'
      ])
    })

    it('sorts array of values by a member function', () => {
      const input = [
        { id: 'element 2', sortKey: () => 2 },
        { id: 'element 1', sortKey: () => 1 },
        { id: 'element 4', sortKey: () => 4 },
        { id: 'element 3', sortKey: () => 3 }
      ]
      const sorted = utils.sortByKey(input, (element) => element.sortKey())
      expect(sorted.map((el) => el.id)).to.deep.equal([
        'element 1', 'element 2', 'element 3', 'element 4'
      ])
    })

    it('supports reverse sorting', () => {
      const input = ['element 2', 'element 1', 'element 4', 'element 3']
      const sorted = utils.sortByKey(input, (element) => element, 'desc')
      expect(sorted).to.deep.equal([
        'element 4', 'element 3', 'element 2', 'element 1'
      ])
    })
  })

  describe('truncate', () => {
    it('returns original value if unable to truncate', () => {
      expect(utils.truncate('')).to.equal('')
      expect(utils.truncate(false)).to.equal(false)
      expect(utils.truncate(undefined)).to.equal(undefined)
    })

    it('truncates strings to length', () => {
      expect(utils.truncate('123456789', 4)).to.equal('123…')
      expect(utils.truncate('123456789', 4)).to.have.lengthOf(4)
      expect(utils.truncate('123456789', 40)).to.equal('123456789')
    })
  })

  describe('compoundComparator', () => {
    it('sorts on single comparator', () => {
      expect(
        [8, 4, 5, 3, 7, 2, 9, 1, 6].sort(
          utils.compoundComparator([
            (o1, o2) => o1 > o2 ? 1 : -1
          ])
        )
      ).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('sorts on two comparators', () => {
      expect(
        [8, 4, 5, 3, 7, 2, 9, 1, 6].sort(
          utils.compoundComparator([
            // Sort evens, then odds
            (o1, o2) => {
              if (o1 % 2 === o2 % 2) return 0
              return o1 % 2 ? 1 : -1
            },
            // Sort by value:
            (o1, o2) => o1 > o2 ? 1 : -1
          ])
        )
      ).to.deep.equal([2, 4, 6, 8, 1, 3, 5, 7, 9])
    })

    it('sorts on three comparators', () => {
      expect(
        [8, 4, 5, 3, 7, 2, 9, 1, 6].sort(
          utils.compoundComparator([
            // Make 1 and 7 come first:
            (o1, o2) => {
              const o1Privileged = [1, 7].includes(o1)
              const o2Privileged = [1, 7].includes(o2)
              if (o1Privileged && !o2Privileged) return -1
              if (o2Privileged && !o1Privileged) return 1
              return 0
            },
            // Sort evens, then odds
            (o1, o2) => {
              if (o1 % 2 === o2 % 2) return 0
              return o1 % 2 ? 1 : -1
            },
            // Sort by value:
            (o1, o2) => o1 > o2 ? 1 : -1
          ])
        )
      ).to.deep.equal([1, 7, 2, 4, 6, 8, 3, 5, 9])
    })
  })

  describe('countDistinctValues', () => {
    it('counts distinct values', () => {
      expect(utils.countDistinctValues([
        'a', 'b', 'b', 'c', 'c', 'c', 'd', 'c'
      ])).to.deep.equal({
        a: 1,
        b: 2,
        c: 4,
        d: 1
      })
    })
  })

  describe('groupByCallback', () => {
    it('groups elements of an array by callback value', () => {
      expect(utils.groupByCallback([1, 2, 3, 4], (v) => v % 2 === 0 ? 'even' : 'odd'))
        .to.deep.equal({
          even: [2, 4],
          odd: [1, 3]
        })
    })
  })

  describe('orderByFixedArrayComparator', () => {
    it('governs order by matching element in a fixed array', () => {
      const compare = utils.orderByFixedArrayComparator([4, 2, 'x'])

      expect(compare(1, 4)).to.equal(1)
      expect(compare(2, 4)).to.equal(1)
      expect(compare(4, 'x')).to.equal(-1)
      expect(compare('x', 4)).to.equal(1)
      expect(compare('x', 4)).to.equal(1)
      expect(compare('x', 9)).to.equal(-1)
      expect(compare(9, 9)).to.equal(0)
    })
  })
})
