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

    // Having 910 $a contain 'RLOTF' is also a solid indicator introduced in OTF
    // record creation Oct 2021 https://github.com/NYPL/recap-hold-request-consumer/pull/33
    const hasOtf910 = this._varField910a().includes('RLOTF')

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

  /**
   *  Determine whether or not this bib is Reseearch. A bib is Research if it:
   *   - is a partner record OR
   *   - has a 910|a of RL/RLOTF OR
   *   - has locations tagged Research in NYPL-Core OR
   *   - has locations whose prefixes look like Research location prefixes
   *
   *  Otherwise bib is assumed non-Research
   */
  getIsResearchWithRationale () {
    // Partner bibs are Research.
    if (this.nyplSource && this.nyplSource !== 'sierra-nypl') {
      return { isResearch: true, rationale: 'Is partner bib' }
    }

    // Check 910 $a for RL or BL:
    const researchBranchFlags = this._varField910a()
    if (researchBranchFlags.length !== 0) {
      const isResearch = researchBranchFlags.includes('RL') || researchBranchFlags.includes('RLOTF')
      return { isResearch, rationale: `910 $a is ${researchBranchFlags}` }
    }

    // If bib has Research locations, it's Research
    const researchLocations = this._researchLocations()
    if (researchLocations.length) {
      return {
        isResearch: true,
        rationale: `Has Research locations: ${researchLocations.join(', ')}`
      }
    }

    // Lowest quality check: If bib has failed above checks, but has locations
    // that have Research prefixes, assume it's Research (i.e. handle Research
    // locations not yet added to NYPL-Core)
    if (this._plausibleResearchLocations().length) {
      return {
        isResearch: true,
        rationale: `Location codes resemble Research locations: ${this._plausibleResearchLocations().join(', ')}`
      }
    }

    // If bib fails above checks, assume it's not Research.
    return {
      isResearch: false,
      rationale: `No 910 and location codes do not imply Research: ${this._locationCodes().join(', ')}`
    }
  }

  /**
   *  Get the values in 910 $a.
   *
   *  These values typically are RL for Research bibs, BL for Branch bibs, or
   *  RLOTF for OTF (Research) bibs
   */
  _varField910a () {
    const varField = this.varField('910', ['a'])
    return Array.isArray(varField) ? varField.map(field => field.value) : []
  }

  /**
   *  Convenience to get is-Research determination as a boolean
   *
   *  @return {boolean}
   */
  isResearch () {
    const { isResearch } = this.getIsResearchWithRationale()
    return isResearch
  }

  /**
   *  Get location codes that are exclusively Research according to NYPL-Core
   *
   *  @return {string[]}
   */
  _researchLocations () {
    return this._locationCodes()
      .filter((code) => locationHasExclusiveCollectionType(code, 'Research'))
  }

  /**
   *  Get location codes (e.g. mal92, pad123) for this bib
   *
   *  @return {string[]}
   */
  _locationCodes () {
    // Gather location codes on the bib:
    return this.locations && Array.isArray(this.locations)
      ? this.locations.map((location) => location.code)
      : []
  }

  _plausibleResearchLocations () {
    return this.locations && Array.isArray(this.locations)
      ? this.locations.filter(locationHasResearchCenterPrefix)
      : []
  }
}

module.exports = SierraBib
