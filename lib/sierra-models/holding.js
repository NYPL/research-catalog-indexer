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
}

module.exports = SierraHolding
