const sierraLocationMapping = require('@nypl/nypl-core-objects')('by-sierra-location')

const EsBase = require('./base')
const logger = require('../../lib/logger')

class EsHolding extends EsBase {
  constructor (sierraHolding) {
    super(sierraHolding)
    this.holding = sierraHolding
  }

  checkInBoxes () {
    const boxes = this.holding.checkInCards
    return boxes.map((box, index) => {
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
      return {
        copies: box.copy_count,
        coverage,
        position: box.box_count,
        status: box.status.label,
        type: 'nypl:CheckInBox'
      }
    })
  }

  format () {
    let formatLiteral = this._valueToIndexFromBasicMapping('format')
    if (!formatLiteral) {
      formatLiteral = [this.holding.fieldTag('i')[0]?.value]
    }
    return formatLiteral.length ? formatLiteral : null
  }

  holdingStatement () {
    if (this.holding.holdings) {
      return this.holding.getHoldingStrings().map((h) => {
        return this._valueToIndexFromBasicMapping('holdingStatement')
      })
    } else return null
  }

  identifier () {
    const shelfMark = this.shelfMark()
    if (shelfMark.length) return [{ value: shelfMark[0], type: 'bf:shelfMark' }]
    else return null
  }

  location () {
    const location = this.holding.location?.code
    if (location && sierraLocationMapping[location]) {
      const holdingLocationId = `loc:${location}`
      const holdingLocationLabel = sierraLocationMapping[location].label
      return [{ id: holdingLocationId, label: holdingLocationLabel }]
    } else if (location) {
      logger.warn('Location id not recognized: ' + location)
    }
    return null
  }

  physicalLocation () {
    return this.shelfMark()
  }

  shelfMark () {
    return this._valueToIndexFromBasicMapping('shelfMark')
  }

  uri () {
    return 'h' + this.holding.id
  }
}

module.exports = EsHolding
