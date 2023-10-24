const nyplCoreLocations = require('@nypl/nypl-core-objects')('by-sierra-location')

/**
 *  Given a location id and a collectionType (Research / Branch), returns true
 *  if that location has no other collectionTypes but the named collectionType
 *  in NYPL-Core.
 */
const locationHasExclusiveCollectionType = (locationId, collectionType) => {
  const mappedLocation = nyplCoreLocations[locationId]
  // If collectionType has only one value, that imples item is definitely that type
  if (mappedLocation && Array.isArray(mappedLocation.collectionTypes) && mappedLocation.collectionTypes.length === 1) {
    return collectionType === mappedLocation.collectionTypes[0]
  }

  return false
}

/**
 *  Given a location id (e.g. 'mal92', 'abcd12'), returns true if location id
 *  has a known Research Center prefix (i.e. is likely SASB/Schomburg/LPA
 *  Research) OR the ReCAP prefix (rc)
 */
const locationHasResearchCenterPrefix = (locationId) => {
  return /^(ma|sc|pa|rc)/.test(locationId)
}

module.exports = {
  locationHasExclusiveCollectionType,
  locationHasResearchCenterPrefix
}
