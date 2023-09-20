const sierraLocationMapping = require('@nypl/nypl-core-objects')('by-sierra-location')

const EsBase = require('./base')
const logger = require('../../lib/logger')

class EsHolding extends EsBase {
  constructor (sierraHolding, esBib) {
    super(sierraHolding)
    this.holding = sierraHolding
    this.esBib = esBib
  }

  checkInBoxes () {
    const boxes = (this.holding.checkInCards || [])
      .map((box, index) => {
        // Create coverage string
        let coverage = ''
        // Get any enumeration associated with this box
        if (box.enumeration.enumeration) coverage = box.enumeration.enumeration
        let dateStr
        if (box.start_date || box.end_date) {
          if (box.start_date) dateStr = box.start_date
          if (box.end_date) dateStr = `${dateStr} - ${box.end_date}`

          if (coverage.length > 0) coverage = `${coverage} (${dateStr})`
          else coverage = dateStr
        }
        const shelfMark = this.shelfMark() ? this.shelfMark() : null
        const serialization = {
          shelfMark,
          coverage,
          position: box.box_count,
          status: box.status.label,
          type: 'nypl:CheckInBox'
        }
        if (box.copy_count) {
          serialization.copies = box.copy_count
        }
        return serialization
      })
      // Sort checkin boxes by box number:
      .sort((box1, box2) => box1.position - box2.position)

    return boxes.length ? boxes : null
  }

  format () {
    let formatLiteral = this._valueToIndexFromBasicMapping('format')
    if (!formatLiteral) {
      const fallbackFormatLiteral = this.holding.fieldTag('i')[0]?.value
      formatLiteral = fallbackFormatLiteral ? [fallbackFormatLiteral] : []
    }
    return formatLiteral.length ? formatLiteral : null
  }

  holdingStatement () {
    const statements = this.holding.getHoldingStrings()
    return statements.length ? statements : null
  }

  identifier () {
    const shelfMark = this.shelfMark()
    if (shelfMark && shelfMark.length) {
      return shelfMark.map((value) => {
        return { value, type: 'bf:shelfMark' }
      })
    } else return null
  }

  location () {
    const location = this.holding.location?.code
    if (location && sierraLocationMapping[location]) {
      const holdingLocationId = `loc:${location}`
      const holdingLocationLabel = sierraLocationMapping[location].label
      return [{ code: holdingLocationId, label: holdingLocationLabel }]
    } else if (location) {
      logger.warn('Location id not recognized: ' + location)
    }
    return null
  }

  // Only present in legacy fields
  // Some n fieldTag fields may be 843 Format fields, but will be ignored here as they are improperly formatted
  // to be retrieved via the fieldTag method
  notes () {
    const notes = this.holding.fieldTag('n')
    if (notes && notes.length) {
      return notes.map((n) => n.value)
    } else return null
  }

  physicalLocation () {
    return this.shelfMark()
  }

  shelfMark () {
    // Note that some holdings have multiple shelfmarks (e.g. h1089484)
    return this._valueToIndexFromBasicMapping('shelfMark') ||
      // Fall back on bib shelfmark:
      this.esBib.shelfMark()
  }

  uri () {
    return 'h' + this.holding.id
  }
}

module.exports = EsHolding
