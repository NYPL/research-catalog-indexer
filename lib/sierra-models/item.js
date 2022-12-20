const SierraBase = require('./base')
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

  getSuppressedWithRationale () {
    let suppressed = false
    const rationale = []

    if (this.deleted || this.suppressed) {
      suppressed = true
      if (this.deleted) rationale.push('deleted')
      if (this.suppressed) rationale.push('suppressed')
    }

    return { suppressed, rationale }
  }
}

module.exports = SierraItem
