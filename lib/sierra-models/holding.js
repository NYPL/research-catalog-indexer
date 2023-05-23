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

  getHoldingStrings () {
    return this.holdings.map((holding) => holding.holding_string).filter((h) => h)
  }
}

module.exports = SierraHolding
