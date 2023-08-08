
const SierraItem = require('./item')
const SierraHolding = require('./holding')
const SierraBase = require('./base')
const {
  locationHasExclusiveCollectionType,
  locationHasResearchCenterPrefix
} = require('../utils/locations')

class SierraBib extends SierraBase {
  constructor (bib) {
    super(bib)
    if (this._items) {
      this._items = bib._items.map((item) => new SierraItem(item))
    }
    if (this._holdings) {
      this._holdings = bib._holdings.map((holding) => new SierraHolding(holding))
    }
  }

  items () {
    return this._items || []
  }

  holdings () {
    return this._holdings || []
  }

  isInRecap () {
    return this.items() && this.items().some((item) => item.location && item.location.code && item.location.code.startsWith('rc'))
  }

  isOtfRecord () {
    // Location code 'os' is a special location for temporary items
    // https://github.com/NYPL/nypl-core/blob/master/vocabularies/csv/locations.csv#L2265
    const hasOtfLocation = this.locations && this.locations[0] && this.locations[0].code === 'os'

    // Having 910 $a === 'RLOTF' is also a solid indicator introduced in OTF
    // record creation Oct 2021 https://github.com/NYPL/recap-hold-request-consumer/pull/33
    const varfield910 = this.varField('910', 'a')
    const hasOtf910 = Array.isArray(varfield910) && varfield910[0] && varfield910[0].value === 'RLOTF'

    return hasOtfLocation || hasOtf910
  }

  getSuppressionRationale () {
    if (this.suppressed) return 'Suppressed'
    if (this.deleted) return 'Deleted'
    if (this.isOtfRecord()) return 'Is OTF'
    return null
  }

  getSuppressionWithRationale () {
    const rationale = this.getSuppressionRationale()
    return { suppressed: Boolean(rationale), rationale }
  }

  getIsResearchWithRationale () {
    // Partner bibs are Research
    if (this.nyplSource && this.nyplSource !== 'sierra-nypl') {
      return { isResearch: true, rationale: 'Is partner bib' }
    }

    // Gather location codes on the bib:
    const locationCodes = this.locations && Array.isArray(this.locations)
      ? this.locations.map((location) => location.code)
      : []

    if (locationCodes.includes('none') || locationCodes.includes('os')) {
      return { isResearch: true, rationale: 'Locations include none/os' }
    } else {
      // Determine locations that are exclusively 'Branch'
      const branchLocations = locationCodes
        .filter((code) => locationHasExclusiveCollectionType(code, 'Branch'))
      // If bib has any locations with just "Branch" collection type, bib is not research:
      if (branchLocations.length > 0) {
        return {
          isResearch: false,
          rationale: `Has branch locations: ${branchLocations.join(', ')}`
        }
      }
    }

    // Last ditch effort to determine is-research: If it has a location code
    // that starts with a known research center location code prefix, assume
    // it's Research (i.e. new location unknown to NYPL-Core):
    if (locationCodes.some((code) => locationHasResearchCenterPrefix(code))) {
      return {
        isResearch: true,
        rationale: `Has likely Research locations: ${locationCodes.join(', ')}`
      }
    }

    return {
      isResearch: false,
      rationale: `Location codes do not imply Research: ${locationCodes.join(', ')}`
    }
  }

  isResearch () {
    const { isResearch } = this.getIsResearchWithRationale()
    return isResearch
  }
}

module.exports = SierraBib
