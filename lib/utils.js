const logger = require('./logger')
const SierraItem = require('./sierra-models/item')
const nyplCoreItemTypes = require('@nypl/nypl-core-objects')('by-catalog-item-type')
const nyplCoreLocations = require('@nypl/nypl-core-objects')('by-sierra-location')

const isValidResponse = (resp) => {
  return resp && resp.data
}

/**
* Given an array of items, resolves a new array of items containing only
* those items that *may* be Research based on Item Type
*/
const prefilterItems = async function (items) {
  const filteredItems = items.filter((item) => {
    if (item.nyplSource !== 'sierra-nypl') return true
    const sierraItem = new SierraItem(item)
    const itemType = sierraItem.fixed('Item Type')
    if (!itemType || !nyplCoreItemTypes[itemType]) return true
    if (
      nyplCoreItemTypes[itemType].collectionType &&
      nyplCoreItemTypes[itemType].collectionType.includes('Research')
    ) {
      return true
    }
    logger.debug(`#filterOutNonResearchItems: Skipping ${item.nyplSource}/${item.id} due to non-Research Item Type (${itemType})`)
    return false
  })

  logger.info(`From original ${items.length} item(s), removed ${items.length - filteredItems.length} circulating, resulting in ${filteredItems.length} research item(s)`)
  return filteredItems
}

const prefilterBibs = async function (bibs) {
  const filteredBibs = bibs.filter((bib) => {
    if (bib.nyplSource !== 'sierra-nypl') return true

    // Gather location codes on the bib:
    const locationCodes = bib.locations && Array.isArray(bib.locations)
      ? bib.locations.map((location) => location.code)
      : []

    // If bib has location code 'os' or 'none', pass it through
    // and let discovery-api-indexer handle suppressing it if needed
    if (locationCodes.includes('none') || locationCodes.includes('os')) return true

    const branchLocations = locationCodes
      .map((code) => nyplCoreLocations[code] || {})
      .filter((location) => {
        return Array.isArray(location.collectionTypes) &&
          location.collectionTypes.length === 1 &&
          location.collectionTypes[0] === 'Branch'
      })
    // If bib has any locations with just "Branch" collection type, bib is not research:
    if (branchLocations.length > 0) {
      logger.debug(`#filterOutAndDeleteNonResearchBibs: Bib has branch locations: ${branchLocations.join(', ')}`)
      return false
    }
    return true
  })

  logger.info(`From original ${bibs.length} bib(s), removed ${bibs.length - filteredBibs.length} circulating, resulting in ${filteredBibs.length} research bibs(s)`)
  return filteredBibs
}

const prefilterHoldings = async function (holdings) {
  return holdings
}
const bNumberWithCheckDigit = (bnumber) => {
  const ogBnumber = bnumber
  const results = []
  let multiplier = 2
  for (const digit of bnumber.split('').reverse().join('')) {
    results.push(parseInt(digit) * multiplier++)
  }

  const remainder = results.reduce(function (a, b) { return a + b }, 0) % 11

  // OMG THIS IS WRONG! Sierra doesn't do mod11 riggghhttttt
  // remainder = 11 - remainder

  if (remainder === 11) return `${ogBnumber}0`
  if (remainder === 10) return `${ogBnumber}x`

  return `${ogBnumber}${remainder}`
}

module.exports = {
  isValidResponse,
  prefilterBibs,
  prefilterItems,
  prefilterHoldings,
  bNumberWithCheckDigit
}
