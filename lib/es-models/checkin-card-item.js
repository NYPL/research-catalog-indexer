const EsBase = require('./base')
const nyplCoreStatuses = require('@nypl/nypl-core-objects')('by-statuses')
const nyplCoreLocations = require('@nypl/nypl-core-objects')('by-sierra-location')
const nyplCoreAccessMessages = require('@nypl/nypl-core-objects')('by-accessMessages')
const { pack } = require('../utils/packed-transform')
const { lookup } = require('../utils/lookup')
const logger = require('../logger')
const { HoldingMappings } = require('../mappings/mappings')
const { parseCheckinCardDate } = require('../utils/checkin-card-date-parse')
const { arrayToEsRangeObject, enumerationChronologySortFromEsRanges } = require('../utils/es-ranges')
const { parseVolume } = require('../utils/volume-parse')

class EsCheckinCardItem extends EsBase {
  /**
   *  Build a EsCheckinCardItem based on the given SierraHolding and
   *  checkin-card index
   */
  constructor (sierraHolding, checkinCardIndex, esBib) {
    super()
    this.sierraHolding = sierraHolding
    this.checkinCardIndex = checkinCardIndex
    this.checkinCard = sierraHolding.checkInCards[checkinCardIndex]
    this.esBib = esBib
  }

  /**
   *  Get static 'Use in library' access-message
   */
  accessMessage () {
    const id = '1'
    const label = nyplCoreAccessMessages[id].label
    return [
      { id: `accessMessage:${id}`, label }
    ]
  }

  accessMessage_packed () {
    return pack(this.accessMessage())
  }

  /**
   *  Get indexable date range(s) based on checkin card start and end dates
   */
  dateRange () {
    if (!this.checkinCard.start_date) return null

    let dateRange = []
    if (this.checkinCard.start_date) {
      dateRange[0] = parseCheckinCardDate(this.checkinCard.start_date)
    }
    if (this.checkinCard.end_date) {
      dateRange[1] = parseCheckinCardDate(this.checkinCard.end_date)
    }
    if (!dateRange[1]) {
      // For now, if no end-date is specified, just use start-date:
      dateRange[1] = dateRange[0]
    }

    // Remove nulls:
    dateRange = dateRange.filter((d) => d)
    // Insist on two-part range (i.e. no open ended ranges):
    if (dateRange.length === 2) {
      // Ensure bad parsing or data doesn't produce a reversed range:
      dateRange = dateRange.sort((d1, d2) => d1 < d2 ? -1 : 1)
      return [arrayToEsRangeObject(dateRange)]
    }
  }

  /**
   *  Get a statement about this checkin card's date and/or volume coverage
   */
  enumerationChronology () {
    let coverage = ''
    // Get any enumeration associated with this box
    if (this.checkinCard.enumeration && this.checkinCard.enumeration.enumeration) {
      coverage = this.checkinCard.enumeration.enumeration
    }

    // Add any date values to the coverage str
    let dateStr
    if (this.checkinCard.start_date || this.checkinCard.end_date) {
      if (this.checkinCard.start_date) dateStr = this.checkinCard.start_date
      if (this.checkinCard.end_date) dateStr = `${dateStr} - ${this.checkinCard.end_date}`

      if (coverage.length > 0) coverage = `${coverage} (${dateStr})`
      else coverage = dateStr
    }

    return [coverage]
  }

  /**
   *  Get a custom string that serves as the sortable form of
   *  enumeration-chronolgy
   */
  enumerationChronology_sort () {
    const sortValue = enumerationChronologySortFromEsRanges(this.volumeRange(), this.dateRange())
    return sortValue ? [sortValue] : null
  }

  /**
   *  Get effective format from parent holding record
   */
  formatLiteral () {
    let format = this.sierraHolding.varField('843', ['a']).shift()?.value
    // If failed to find format in holding record, use bib material type:
    if (!format && this.esBib) {
      const bibMaterialType = this.esBib.materialType()
      if (bibMaterialType && bibMaterialType[0]) format = bibMaterialType[0].label
    }
    if (!format) return null
    return [format]
  }

  /**
   *  Get holding-location of parent holding record
   */
  holdingLocation () {
    const holdingLocation = this.sierraHolding.location

    if (!holdingLocation || !holdingLocation.code) return null
    if (!nyplCoreLocations[holdingLocation.code]) {
      logger.warn(`Holding location not recognized: ${holdingLocation.code}`)
      return null
    }

    const id = `loc:${holdingLocation.code}`
    const label = nyplCoreLocations[holdingLocation.code].label
    return [{ id, label }]
  }

  holdingLocation_packed () {
    return pack(this.holdingLocation())
  }

  /**
   *  Get array of identifiers as entities
   */
  identifierV2 () {
    return this._identifiers()
  }

  /**
   *  Get shelf-mark from Holding record
   */
  shelfMark () {
    const mappings = HoldingMappings.get('shelfMark', this.sierraHolding)
    let shelfMarks = this.sierraHolding.varFieldsMulti(mappings)
      .map((varFieldMatch) => {
        // Sierra seems to put these '|h' prefixes on callnumbers; strip 'em
        return varFieldMatch.value.replace(/^\|h/, '')
      })
    if (shelfMarks.length === 0 && this.esBib) {
      shelfMarks = this.esBib.shelfMark()
    }
    return shelfMarks?.length ? shelfMarks : null
  }

  shelfMark_sort () {
    return this._sortableShelfMark()
  }

  /**
   *  Get status by translating checkin card's status into an item status
   */
  status () {
    const boxStatus = this.checkinCard.status.code
    const translatedStatusCode = lookup('lookup-checkin-card-status-to-item-status')[boxStatus]
    const status = nyplCoreStatuses[translatedStatusCode]
    const id = 'status:' + status.id.split(':').pop()
    return [
      { id, label: status.label }
    ]
  }

  status_packed () {
    return pack(this.status())
  }

  /**
   *  Get static checkin-card type
   */
  type () {
    return ['nypl:CheckinCardItem']
  }

  uri () {
    return `i-h${this.sierraHolding.id}-${this.checkinCardIndex}`
  }

  /**
   *  Get indexable volume range by parsing checkin card enumeration
   */
  volumeRange () {
    if (!this.checkinCard.enumeration) return null
    if (!this.checkinCard.enumeration.enumeration) return null

    const volumeRanges = parseVolume(this.checkinCard.enumeration.enumeration)
    // If no parsed ranges, return null:
    if (!volumeRanges.length) return null

    return volumeRanges.map(arrayToEsRangeObject)
  }

  /**
   *  Get raw volume range by from checkin card enumeration
   */
  volumeRaw () {
    if (!this.checkinCard?.enumeration?.enumeration) return null

    return [this.checkinCard.enumeration.enumeration]
  }

  /**
   *  Get all relevant identifiers as entities
   */
  _identifiers () {
    let identifiers = []

    // Add shelfmark (call number):
    if (this.shelfMark()) {
      identifiers = identifiers.concat(
        this.shelfMark().map((value) => ({ value, type: 'bf:ShelfMark' }))
      )
    }

    return identifiers
  }

  /**
   *  Given a SierraHolding instance, returns an array of EsCheckinCardItem
   *  instances parsed from it
   */
  static fromSierraHolding (sierraHolding, esBib) {
    if (!sierraHolding.checkInCards) return []

    return sierraHolding.checkInCards.map((checkinCard, index) => {
      return new EsCheckinCardItem(sierraHolding, index, esBib)
    })
  }
}

module.exports = EsCheckinCardItem
