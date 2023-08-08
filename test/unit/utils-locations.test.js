const expect = require('chai').expect

const {
  locationHasExclusiveCollectionType,
  locationHasResearchCenterPrefix
} = require('../../lib/utils/locations')

describe('utils/locations', () => {
  describe('locationHasExclusiveCollectionType', () => {
    it('returns true for location with matching collectionType', () => {
      expect(locationHasExclusiveCollectionType('mal92', 'Research')).to.equal(true)
      expect(locationHasExclusiveCollectionType('aga01', 'Branch')).to.equal(true)
    })

    it('returns false for location with non-matching collectionType', () => {
      expect(locationHasExclusiveCollectionType('mal92', 'Branch')).to.equal(false)
      expect(locationHasExclusiveCollectionType('aga01', 'Research')).to.equal(false)
    })

    it('returns false for location with non-exclusive matching collectionType', () => {
      // Location ia has both Research and Branch:
      expect(locationHasExclusiveCollectionType('ia', 'Research')).to.equal(false)
      expect(locationHasExclusiveCollectionType('ia', 'Branch')).to.equal(false)
    })
  })

  describe('locationHasResearchCenterPrefix', () => {
    it('returns true for Research prefixed location ids', () => {
      expect(locationHasResearchCenterPrefix('mal')).to.equal(true)
      expect(locationHasResearchCenterPrefix('sc1234')).to.equal(true)
      expect(locationHasResearchCenterPrefix('pathispartcanbeanything')).to.equal(true)
    })
  })
})
