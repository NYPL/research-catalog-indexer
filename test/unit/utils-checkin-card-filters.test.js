const expect = require('chai').expect

const { loadNyplCoreData } = require('../../lib/load-core-data')
const loadCoreData = require('../../lib/load-core-data')
const filters = require('../../lib/utils/checkin-card-filters')

describe('utils/checkin-card-filters', () => {
  describe('rangeIncludes', () => {
    it('identifies equivalent ranges', () => {
      // Identical:
      expect(filters._private.rangeIncludes({ start: 1, end: 2 }, { start: 1, end: 2 }))
        .to.equal(true)
      expect(filters._private.rangeIncludes({ start: 1, end: 2 }, { start: 1 }))
        .to.equal(true)
      expect(filters._private.rangeIncludes({ start: 1 }, { start: 1 }))
        .to.equal(true)

      // Contained:
      expect(filters._private.rangeIncludes({ start: 1, end: 3 }, { start: 2 }))
        .to.equal(true)
      expect(filters._private.rangeIncludes({ start: 1, end: 3 }, { start: 3 }))
        .to.equal(true)
      expect(filters._private.rangeIncludes({ start: 1, end: 3 }, { start: 2, end: 2 }))
        .to.equal(true)
      expect(filters._private.rangeIncludes({ start: 1, end: 3 }, { start: 1 }))
        .to.equal(true)
    })

    it('rejects if first range doesn\'t perfectly include second range', () => {
      // Outside range:
      expect(filters._private.rangeIncludes({ start: 1 }, { start: 2 }))
        .to.equal(false)
      expect(filters._private.rangeIncludes({ start: 1, end: 2 }, { start: 3 }))
        .to.equal(false)
      expect(filters._private.rangeIncludes({ start: 1, end: 2 }, { start: 3, end: 4 }))
        .to.equal(false)

      // Overlapped:
      expect(filters._private.rangeIncludes({ start: 1, end: 3 }, { start: 2, end: 4 }))
        .to.equal(false)
      expect(filters._private.rangeIncludes({ start: 2, end: 4 }, { start: 1, end: 3 }))
        .to.equal(false)
    })
  })

  describe('volumeIncludes', () => {
    it('identifies equiv ranges non-strict', () => {
      expect(filters._private.volumeIncludes({ start: 1 }, { start: 1 }))
        .to.equal(true)
      expect(filters._private.volumeIncludes({ start: 1, end: 2 }, { start: 1 }))
        .to.equal(true)
      expect(filters._private.volumeIncludes({ start: 1, end: 2 }, { start: 2 }))
        .to.equal(true)
    })

    it('identifies equiv ranges strict', () => {
      expect(filters._private.volumeIncludes({ start: 1, type: 'volume' }, { start: 1, type: 'volume' }, true))
        .to.equal(true)
      expect(filters._private.volumeIncludes({ start: 1, end: 2, type: 'volume' }, { start: 1, type: 'volume' }, true))
        .to.equal(true)
      expect(filters._private.volumeIncludes({ start: 1, end: 2, type: 'volume' }, { start: 2, type: 'volume' }, true))
        .to.equal(true)
    })

    it('rejects in-equiv ranges non-strict', () => {
      expect(filters._private.volumeIncludes({ start: 1 }, { start: 2 }))
        .to.equal(false)
      expect(filters._private.volumeIncludes({ start: 1, end: 2 }, { start: 2, end: 3 }))
        .to.equal(false)
    })

    it('rejects equiv ranges if types disagree while strict enabled', () => {
      expect(filters._private.volumeIncludes({ start: 1, type: 'volume' }, { start: 1, type: 'other' }, true))
        .to.equal(false)
      expect(filters._private.volumeIncludes({ start: 1, end: 2, type: 'box' }, { start: 1, type: 'volume' }, true))
        .to.equal(false)
    })
  })

  describe('checkinCardMatchesItem', () => {
    it('identifies exact equiv item for checkin card', () => {
      const checkinCardItem = { _taggedEnumerations: () => [{ start: 1, type: 'volume' }] }
      const item = { _taggedEnumerations: () => [{ start: 1, type: 'volume' }] }

      expect(filters._private.checkinCardMatchesItem(checkinCardItem, item))
        .to.equal(true)
      // Strict:
      expect(filters._private.checkinCardMatchesItem(checkinCardItem, item, true))
        .to.equal(true)
    })

    it('identifies roughly equiv item for checkin card', () => {
      const checkinCardItem = { _taggedEnumerations: () => [{ start: 1, type: 'volume' }] }
      const item = { _taggedEnumerations: () => [{ start: 1, end: 3, type: 'volume' }] }

      expect(filters._private.checkinCardMatchesItem(checkinCardItem, item))
        .to.equal(true)
      // Strict:
      expect(filters._private.checkinCardMatchesItem(checkinCardItem, item, true))
        .to.equal(true)
    })

    it('identifies equiv item for checkin card, non-strict', () => {
      const checkinCardItem = { _taggedEnumerations: () => [{ start: 1, type: 'number' }] }
      const item = { _taggedEnumerations: () => [{ start: 1, type: 'volume' }] }

      expect(filters._private.checkinCardMatchesItem(checkinCardItem, item))
        .to.equal(true)
    })

    it('identifies roughly equiv item for checkin card, non-strict', () => {
      const checkinCardItem = { _taggedEnumerations: () => [{ start: 1, type: 'number' }] }
      const item = { _taggedEnumerations: () => [{ start: 1, end: 3, type: 'volume' }] }

      expect(filters._private.checkinCardMatchesItem(checkinCardItem, item))
        .to.equal(true)
    })
  })

  describe('isRedundantCheckinCard', () => {
    it('identifies redundant checkin card via loose match', () => {
      const checkinCardItem = {
        _taggedEnumerations: () => [{ start: 1, type: 'number' }],
        _taggedYear: () => ({ start: '2002' }),
        enumerationChronology: () => 'ch'
      }
      const items = [
        {
          _taggedEnumerations: () => [{ start: 1, end: 3, type: 'volume' }],
          _taggedYear: () => ({ start: '2002' })
        }
      ]

      expect(filters._private.isRedundantCheckinCard(checkinCardItem, items))
        .to.equal(true)

      items[0]._taggedEnumerations = () => [{ start: 1, type: 'volume' }]
      expect(filters._private.isRedundantCheckinCard(checkinCardItem, items))
        .to.equal(true)
    })

    it('identifies redundant checkin card via strict match', () => {
      const checkinCardItem = {
        _taggedEnumerations: () => [{ start: 1, type: 'box' }],
        _taggedYear: () => null,
        enumerationChronology: () => 'ch'
      }
      const items = [
        {
          _taggedEnumerations: () => [{ start: 1, end: 3, type: 'box' }],
          _taggedYear: () => null
        }
      ]

      expect(filters._private.isRedundantCheckinCard(checkinCardItem, items))
        .to.equal(true)

      items[0]._taggedEnumerations = () => [{ start: 1, type: 'volume' }]
      expect(filters._private.isRedundantCheckinCard(checkinCardItem, items))
        .to.equal(true)
    })
  })

  describe('isOffsiteCheckinCard', () => {
    it('identifies offsite checkin card', () => {
      const item = { holdingLocation: () => [{ id: 'loc:rc123' }] }
      expect(filters._private.isOffsiteCheckinCard(item)).to.equal(true)
    })

    it('rejects non-offsite checkin cards', () => {
      let item = { holdingLocation: () => null }
      expect(filters._private.isOffsiteCheckinCard(item)).to.equal(false)

      item = { holdingLocation: () => [{ id: 'loc:ma123' }] }
      expect(filters._private.isOffsiteCheckinCard(item)).to.equal(false)
    })
  })

  describe('hasAllowedStatus', () => {
    let restoreCachedData
    before(() => {
      restoreCachedData = loadCoreData._private.cache
      console.log('captured nypl-core as ', restoreCachedData)

      loadCoreData._private.setCached({
        checkinCardStatusMapping: {
          '🎸': { display: true },
          '❌': { display: false },
          '❓': { }
        }
      })
    })

    after(async () => {
      console.log('restoring nypl-core data to ', restoreCachedData)
      loadCoreData._private.setCached(restoreCachedData)

      // Other tests depend on this:
      await loadNyplCoreData()
    })

    it('identifies allowed statuses', () => {
      let item = { checkinCard: { status: { code: '🎸' } } }
      expect(filters._private.hasAllowedStatus(item)).to.equal(true)

      // If checkin card status doesn't indicate `display`, defautl to show:
      item = { checkinCard: { status: { code: '❓' } } }
      expect(filters._private.hasAllowedStatus(item)).to.equal(true)

      // If checkin code unrecognized, default to show:
      item = { checkinCard: { status: { code: 'foo' } } }
      expect(filters._private.hasAllowedStatus(item)).to.equal(true)
    })

    it('identifies disallowed statuses', () => {
      const item = { checkinCard: { status: { code: '❌' } } }
      expect(filters._private.hasAllowedStatus(item)).to.equal(false)
    })
  })
})
