const SierraBase = require('./base')

class SierraHolding extends SierraBase {
  constructor (holding) {
    super(holding)
    this._bibs = []
  }

  addBib (bib) {
    this._bibs.push(bib)
  }

  bibs () {
    return this._bibs
  }

  getSuppressionWithRationale () {
    let suppressed = false
    const rationale = []

    if (this.deleted || this.suppressed) {
      suppressed = true
      if (this.deleted) rationale.push('deleted')
      if (this.suppressed) rationale.push('suppressed')
    }

    return { suppressed, rationale }
  }

  getHoldingStrings () {
    return (this.holdings || [])
      .map((holding) => holding.holding_string)
      .filter((h) => h)
  }
}

module.exports = SierraHolding
