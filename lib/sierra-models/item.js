const SierraBase = require('./base')
const logger = require('../logger')
const {
  locationHasExclusiveCollectionType,
  locationHasResearchCenterPrefix
} = require('../utils/locations')
const nyplCore = require('../load-core-data')

class SierraItem extends SierraBase {
  constructor (item) {
    super(item)
    this._bibs = []
  }

  bibs () {
    return this._bibs
  }

  /**
   *  Returns an object indicating whether this item is suppressed or not and why.
   *
   *  @return {object} An object with {boolean} `suppressed` and {string} `rationale`
   */
  getSuppressionWithRationale () {
    const rationale = this._suppressionRationale()
    const suppressed = Boolean(rationale.length)
    logger.debug(`Determined item ${this.id} is ${suppressed ? '' : 'not '}suppressed${rationale.length ? ` because: ${rationale}` : ''}`)
    return { suppressed, rationale }
  }

  /**
   *  Returns item Item Type as an integer
   *
   *  @return {integer}
   */
  getItemType () {
    let type = null

    // parse from fixed:
    const fixedType = this.fixed('Item Type')
    if (/^\d+$/.test(fixedType)) type = parseInt(fixedType)

    // Partner recap items are hard-coded catalogItemType:1, "General Materials"
    if (this.isPartnerRecord()) type = 1

    return type
  }

  /**
   *  Returns an object indicating whether this item is Research or not and why.
   *
   *  An item is Research if:
   *   - It's a partner record
   *   - Item location is tagged Research in NYPL-Core
   *   - Item location is not in NYPL-Core, but location prefix begins with a known
   *     Research center prefix (e.g. ma*, sc*)
   *   - Item "Item Type" is tagged Research in NYPL-Core
   *
   *  @return {object} An object defining {boolean} `isResearch` and {string} `rationale`
   */
  getIsResearchWithRationale () {
    // If item is a partner record, it's necessarily Research
    if (this.isPartnerRecord()) {
      return { isResearch: true, rationale: 'Is partner record' }
    }

    // If location is tagged Research in NYPL-Core, item is Research:
    if (this._locationIsResearch()) {
      return { isResearch: true, rationale: 'Has research location' }
    }

    // If location prefix matches known Research center prefixes, assume item
    // is Research (i.e. new Research Sierra location):
    if (this._locationHasResearchPrefix()) {
      return {
        isResearch: true,
        rationale: `Has likely Research location: ${this.location.code}`
      }
    }

    // If has Item Type tagged Research in NYPL-Core, it's Research:
    if (this._itemTypeIsResearch()) {
      return { isResearch: true, rationale: `Item type ${this.getItemType()} implies research` }
    }

    return {
      isResearch: false,
      rationale: `Location (${this.location?.code}) and Item Type (${this.getItemType()}) collectionTypes are not Research`
    }
  }

  /**
   *  Returns true if item is determined to be Research based on a number of
   *  checks. (See getIsResearchWithRationale)
   */
  isResearch () {
    const { isResearch, rationale } = this.getIsResearchWithRationale()
    logger.debug(`Determined item ${this.id} is ${isResearch ? '' : 'not '}research because: ${rationale}`)
    return isResearch
  }

  /**
   *  Return true if Item Type is tagged Research in NYPL-Core, implying this
   *  item is Research
   */
  _itemTypeIsResearch () {
    // If object has item type, does NYPL-Core tag that type as Research?
    const itemType = this.getItemType()
    if (itemType) {
      if (!nyplCore.catalogItemTypeMapping()[itemType]) {
        logger.warn(`Unrecognized itemType: ${itemType}`)
      } else {
        // The item's itype implies 'Research' if the itype collectionType includes 'Research'
        const collectionTypes = nyplCore.catalogItemTypeMapping()[itemType].collectionType
        return collectionTypes && collectionTypes.indexOf('Research') >= 0
      }
    }
  }

  /**
   *  Returns true if item location has a known Research center prefix (e.g.
   *  ma, sc, pa). This check is important for items assigned to newly added
   *  Research Sierra locations that don't yet exist in NYPL-Core. If an item
   *  is added to ma1234 and NYPL-Core has not yet documented that new
   *  location as having collectionType 'Research', we may still assume the
   *  location is Research based on the 'ma' prefix. Doing so means items
   *  assigned to that location become visible by default in RC.
   */
  _locationHasResearchPrefix () {
    // Perform lowest quality check: Assume research if location starts with a
    // known research center prefix:
    return this.location?.code && locationHasResearchCenterPrefix(this.location.code)
  }

  /**
   *  Returns true if location is tagged Research in NYPL-Core
   */
  _locationIsResearch () {
    // If object has a location, see if NYPL-Core tags it as Research:
    if (this.location?.code) {
      return (locationHasExclusiveCollectionType(this.location.code, 'Research'))
    }
  }

  /**
   *  Returns a string[] representing the reason(s) for suppression if this
   *  item is suppressed. Otherwise returns an empty []
   *
   *  An item should be considered suppressed if:
   *   - Item is deleted
   *   - Item is a partner record with an 876|x or 900|a of "Private"
   *   - Item is an NYPL OTF record (i.e. Item Type 50)
   *   - Item is an NYPL record with a restricted icode2
   */
  _suppressionRationale () {
    const rationale = []
    if (this.deleted) rationale.push('Deleted')

    if (this.isPartnerRecord()) {
      let group = this.varField('876', ['x'])
      if (group && group.length > 0 && group[0].value === 'Private') {
        rationale.push('Partner 876 $x')
      }

      group = this.varField('900', ['a'])
      if (group && group.length > 0 && group[0].value === 'Private') {
        rationale.push('Partner 900 $a')
      }
    } else {
      // First, we'll suppress it if catalogItemType is 50 (temporary item, aka
      // OTF record):
      if (this.getItemType() && this.getItemType() === 50) {
        rationale.push('Item Type 50')
      }
      // Next, we'll suppress it if fixed "Item Code 2" is 's', 'w', 'd', or 'p'
      const icode2 = this.fixed('Item Code 2')
      if (['s', 'w', 'd', 'p'].indexOf(icode2) >= 0) {
        rationale.push('Restricted icode2')
      }
    }

    return rationale
  }
}

module.exports = SierraItem
