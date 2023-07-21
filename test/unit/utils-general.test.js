const expect = require('chai').expect

const {
  dupeObjectsByHash,
  uniqueObjectsByHash
} = require('../../lib/utils/general')

describe('utils/general', () => {
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
      expect(uniqueObjectsByHash(input, hasher)).to.deep.equal([
        { key1: 'key1 value 1', key2: 'key2 value 1' },
        { key2: 'key2 value 2' },
        { key1: 'key1 value 2' },
        { key1: 'key1 value 1', key2: 'key2 value 2' }
      ])
    })
  })

  describe('dupeObjectsByHash', () => {
    it('identifies sets of duplicate objects by hasher function', () => {
      expect(dupeObjectsByHash(input, hasher)).to.deep.equal([
        [
          { key1: 'key1 value 1', key2: 'key2 value 1' },
          { key1: 'key1 value 1', key2: 'key2 value 1', key3: 'key3 is ignored in comparison' },
          { key2: 'key2 value 1', key1: 'key1 value 1' }
        ]
      ])
    })
  })
})
