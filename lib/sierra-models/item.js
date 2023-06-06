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

  getItemType () {
    let type = null

    // parse from fixed:
    const fixedType = this.fixed('Item Type')
    if (/^\d+$/.test(fixedType)) type = parseInt(fixedType)

    // Partner recap items are hard-coded catalogItemType:1, "General Materials"
    if (this.isPartnerRecord()) type = 1

    return type
  }
}

module.exports = SierraItem
