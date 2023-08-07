const { expect } = require('chai')

const {
  filteredSierraBibsForBibs,
  filteredSierraItemsForItems
} = require('../../lib/prefilter')

describe('prefilter', () => {
  describe('filteredSierraBibsForBibs', () => {
    it('should keep Research bibs', () => {
      const bibs = [require('../fixtures/bib-11606020.json')]
      const { filteredBibs, removedBibs } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(1)
      expect(removedBibs).to.have.lengthOf(0)
    })

    it('should filter out non-Research bibs', () => {
      const bibs = [require('../fixtures/bib-18101449.json')]
      const { filteredBibs, removedBibs } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(0)
      expect(removedBibs).to.have.lengthOf(1)
    })

    it('should filter out deleted bibs', () => {
      const bibs = [require('../fixtures/bib-19099433.json')]
      const { filteredBibs, removedBibs } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(0)
      expect(removedBibs).to.have.lengthOf(1)
    })

    it('should filter out suppressed bibs', () => {
      const bibs = [{ suppressed: true }]
      const { filteredBibs, removedBibs } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(0)
      expect(removedBibs).to.have.lengthOf(1)
    })
  })

  describe('filteredSierraItemsForItems', () => {
    it('should filter out items with branch locations', () => {
      const items = [{ location: { code: 'aga01' } }]
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(0)
    })

    it('should keep items with Research locations', () => {
      const items = [{ location: { code: 'mal92' } }]
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(1)
    })

    it('should filter out items with non-Research item types', () => {
      const items = [{ fixedFields: [{ label: 'Item Type', value: 120 }] }]
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(0)
    })

    it('should keep items with Research item types', () => {
      const items = [{ fixedFields: [{ label: 'Item Type', value: 6 }] }]
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(1)
    })

    it('should filter out partner items marked Private in 876 $x or 900 $a', () => {
      const items = [
        {
          nyplSource: 'recap-pul',
          varFields: [
            { marcTag: '876', subFields: [{ tag: 'x', content: 'Private' }] }
          ]
        },
        {
          nyplSource: 'recap-hl',
          varFields: [
            { marcTag: '900', subFields: [{ tag: 'a', content: 'Private' }] }
          ]
        }
      ]
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(0)
    })

    it('should filter out items suppessed by Item Type 50', () => {
      const items = [{ fixedFields: [{ label: 'Item Type', value: 50 }] }]
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(0)
    })

    it('should filter out items suppessed by Item Code 2', () => {
      // Generate a fake Research items for each of the known suppressable
      // Icode2 values. Add non-suppressed icode2 'a' as a control:
      const items = ['s', 'w', 'd', 'p', 'a']
        .map((icode2) => {
          return {
            // Give the fake item a Research location so that it would
            // otherwise appear to be Research:
            location: { code: 'mal92' },
            // Give it the Icode2 value:
            fixedFields: [{ label: 'Item Code 2', value: icode2 }]
          }
        })
      const filteredItems = filteredSierraItemsForItems(items)

      expect(filteredItems).to.have.lengthOf(1)
      // Expect only the item with an innocuous Item Code 2 value to survive:
      expect(filteredItems[0].fixedFields[0].value).to.equal('a')
    })
  })
})
