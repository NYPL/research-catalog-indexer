const expect = require('chai').expect

const SierraItem = require('../../lib/sierra-models/item')

describe('SierraItem', function () {
  describe('getSuppressionWithRationale', function () {
    describe('unsuppressed record', function () {
      it('should return suppressed: false and empty rationale', () => {
        const item = new SierraItem(require('../fixtures/item-pul-189241.json'))
        expect(item.getSuppressionWithRationale()).to.deep.equal({
          suppressed: false,
          rationale: []
        })
      })
    })

    describe('partner record with 876 x', function () {
      it('should show 876 $x as reason for suppression', () => {
        // Let's add 876 $x 'Private' to this recap item to confirm it becomes suppressed:
        const itemData = JSON.parse(JSON.stringify(require('../fixtures/item-pul-189241.json')))
        itemData.varFields
          .filter((f) => f.marcTag === '876')
          .forEach((f) => f.subFields.push({ tag: 'x', content: 'Private' }))
        const item = new SierraItem(itemData)

        expect(item.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['876 $x']
        })
      })
    })

    describe('partner record with 900 a', function () {
      it('should show 900 $a as reason for suppression', () => {
        // const item = new SierraItem('')
        // Let's set 900 $a to 'Private' to this recap item to confirm it becomes suppressed:
        const itemData = JSON.parse(JSON.stringify(require('../fixtures/item-pul-189241.json')))
        itemData.varFields
          .filter((f) => f.marcTag === '900')
          .forEach((f) => {
            // Modify the $a subField (currently "Shared"):
            f.subFields.forEach((subField) => {
              if (subField.tag === 'a') subField.content = 'Private'
            })
          })
        const item = new SierraItem(itemData)

        expect(item.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['900 $a']
        })
      })
    })

    describe('deleted record', function () {
      it('should show \'deleted\' as reason for suppression', () => {
        const itemData = JSON.parse(JSON.stringify(require('../fixtures/item-pul-189241.json')))
        itemData.deleted = true
        const item = new SierraItem(itemData)

        expect(item.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['deleted']
        })
      })
    })

    describe('nypl record with item type 50', function () {
      it('should suppress item based on fixed "Item Type"', function () {
        // Amend this item to have Item Type '50'
        const itemData = JSON.parse(JSON.stringify(require('../fixtures/item-10003973.json')))
        itemData.fixedFields
          .filter((f) => f.label === 'Item Type')
          .forEach((f) => {
            f.value = '50'
          })
        const item = new SierraItem(itemData)

        expect(item.getSuppressionWithRationale()).to.deep.equal({
          suppressed: true,
          rationale: ['catalogItemType']
        })
      })
    })

    describe('nypl record with fixed item code s/w/d/p', function () {
      it('should suppress item based on fixed Item Code 2', () => {
        const itemData = require('../fixtures/item-10003973.json')
        const items = ['s', 'w', 'd', 'p'].map((code) => {
          const copiedData = JSON.parse(JSON.stringify(itemData))
          // Set Item Code 2 to code
          copiedData.fixedFields
            .filter((f) => f.label === 'Item Code 2')
            .forEach((f) => {
              f.value = code
            })
          return new SierraItem(copiedData)
        })

        items.forEach((item) => {
          return expect(item.getSuppressionWithRationale()).to.deep.equal({
            suppressed: true,
            rationale: ['fixed "Item Code 2"']
          })
        })
      })

      it('should not suppress for other Item Code 2', () => {
        const itemData = JSON.parse(JSON.stringify(require('../fixtures/item-10003973.json')))
        itemData.fixedFields
          .filter((f) => f.label === 'Item Code 2')
          .forEach((f) => {
            f.value = '-'
          })
        const item = new SierraItem(itemData)

        expect(item.getSuppressionWithRationale()).to.deep.equal({
          suppressed: false,
          rationale: []
        })
      })
    })

    describe('record with multiple suppression rationales', function () {
      const itemData = JSON.parse(JSON.stringify(require('../fixtures/item-10003973.json')))
      itemData.deleted = true
      itemData.fixedFields
        .filter((f) => f.label === 'Item Type')
        .forEach((f) => {
          f.value = '50'
        })
      const item = new SierraItem(itemData)

      expect(item.getSuppressionWithRationale()).to.deep.equal({
        suppressed: true,
        rationale: ['deleted', 'catalogItemType']
      })
    })
  })
})
