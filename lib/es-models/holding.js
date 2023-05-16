const EsBase = require('./base')

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
    let formatLiteral
    if (this.holding.varField('843', ['a']).length > 0) {
      formatLiteral = this.holding.varField('843', ['a'])[0]
    } else if (this.holding.fieldTag('i') && this.holding.fieldTag('i').length > 0) {
      formatLiteral = this.holding.fieldTag('i')[0]
    }
    return formatLiteral?.value || null
  }

  holdingStatement () {
    if (this.holding.holdings) {
      return this.holding.getHoldingStrings().map((h) => {
        return this._valueToIndexFromBasicMapping('holdingStatement')
      })
    } else return null
  }
}

module.exports = EsHolding
