const { expect } = require('chai')

const { filteredSierraBibsForBibs } = require('../../lib/prefilter')

describe.only('prefilter', () => {
  describe('filteredSierraBibsForBibs', () => {
    it('should keep Research bibs', () => {
      const bibs = [require('../fixtures/bib-11606020.json')]
      const { filteredBibs, bibsToDelete } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(1)
      expect(bibsToDelete).to.have.lengthOf(0)
    })

    it('should filter out non-Research bibs', () => {
      const bibs = [require('../fixtures/bib-18101449.json')]
      const { filteredBibs, bibsToDelete } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(0)
      expect(bibsToDelete).to.have.lengthOf(1)
    })

    it('should filter out deleted bibs', () => {
      const bibs = [require('../fixtures/bib-19099433.json')]
      const { filteredBibs, bibsToDelete } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(0)
      expect(bibsToDelete).to.have.lengthOf(1)
    })

    it('should filter out suppressed bibs', () => {
      const bibs = [{ suppressed: true }]
      const { filteredBibs, bibsToDelete } = filteredSierraBibsForBibs(bibs)

      expect(filteredBibs).to.have.lengthOf(0)
      expect(bibsToDelete).to.have.lengthOf(1)
    })
  })
})
