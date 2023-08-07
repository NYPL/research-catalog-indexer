const nyplCoreItemTypes = require('@nypl/nypl-core-objects')('by-catalog-item-type')

const SierraBase = require('./base')
const logger = require('../logger')
const {
  locationHasExclusiveCollectionType,
  locationHasResearchCenterPrefix
} = require('../utils/locations')

class SierraItem extends SierraBase {
  constructor (item) {
    super(item)
    this._bibs = []
  }

  addBib (bib) {
    this._bibs.push(bib)
  }

  bibs () {
    return this._bibs
  }

  getSuppressionWithRationale () {
    const rationale = this.getSuppressionRationale()
    return { suppressed: Boolean(rationale.length), rationale }
  }

  getItemType () {
    let type = null

    // parse from fixed:
    const fixedType = this.fixed('Item Type')
    if (/^\d+$/.test(fixedType)) type = parseInt(fixedType)

    // Partner recap items are hard-coded catalogItemType:1, "General Materials"
    if (this.isPartnerRecord()) type = 1

    return type
  }

  getIsResearchWithRationale () {
    if (this.isPartnerRecord()) {
      return { isResearch: true, rationale: 'Is partner record' }
    }

    // If object has location, see if location implies items are definitely Research or definitely Branch
    if (this.location && this.location.code) {
      if (locationHasExclusiveCollectionType(this.location.code, 'Research')) {
        return { isResearch: true, rationale: 'Has research location' }
      }
    }

    // If object has item type, does type imply item is Research?
    const itemType = this.getItemType()
    let itemTypeImpliesResearch = false
    if (itemType) {
      if (!nyplCoreItemTypes[itemType]) {
        logger.warn(`Unrecognized itemType: ${itemType}`)
      } else {
        // The item's itype implies 'Research' if the itype collectionType includes 'Research'
        const collectionTypes = nyplCoreItemTypes[itemType].collectionType
        itemTypeImpliesResearch = collectionTypes && collectionTypes.indexOf('Research') >= 0
      }
    }
    if (itemTypeImpliesResearch) {
      return { isResearch: true, rationale: `Item type ${itemType} implies research` }
    }

    // Perform lowest quality check: Assume research if location starts with a
    // known research center prefix:
    if (this.location?.code && locationHasResearchCenterPrefix(this.location.code)) {
      return {
        isResearch: true,
        rationale: `Has likely Research location: ${this.location.code}`
      }
    }

    return {
      isResearch: false,
      rationale: `Location (${this.location?.code}) and Item Type (${itemType}) collectionTypes are not Research`
    }
  }

  isResearch () {
    const { isResearch, rationale } = this.getIsResearchWithRationale()
    logger.debug(`Determined ${this.id} is ${isResearch ? '' : 'not '}research because: ${rationale}`)
    return isResearch
  }

  getSuppressionRationale () {
    const rationale = []
    if (this.deleted) rationale.push('deleted')

    if (this.isPartnerRecord()) {
      let group = this.varField('876', ['x'])
      if (group && group.length > 0 && group[0].value === 'Private') {
        rationale.push('876 $x')
      }

      group = this.varField('900', ['a'])
      if (group && group.length > 0 && group[0].value === 'Private') {
        rationale.push('900 $a')
      }
    } else {
      // First, we'll suppress it if catalogItemType is 50 (temporary item, aka
      // OTF record):
      if (this.getItemType() && this.getItemType() === 50) {
        rationale.push('catalogItemType')
      }
      // Next, we'll suppress it if fixed "Item Code 2" is 's', 'w', 'd', or 'p'
      if (['s', 'w', 'd', 'p'].indexOf(this.fixed('Item Code 2')) >= 0) {
        rationale.push('fixed "Item Code 2"')
      }
    }

    return rationale
  }
}

module.exports = SierraItem
