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
    const rationale = this.getSuppressionRationale()
    return { suppressed: Boolean(rationale.length), rationale }
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

  getSuppressionRationale () {
    const rationale = []
    if (this.deleted) rationale.push('deleted')

    if (this.isPartnerRecord()) {
      let group = this.varField('876', ['x'])
      if (group && group.length > 0 && group[0].value === 'Private') {
        rationale.push('876 $x')
      }

      group = this.varField('900', ['a'])
      if (group && group.length > 0 && group[0].value === 'Private') {
        rationale.push('900 $a')
      }
    } else {
      // First, we'll suppress it if catalogItemType is 50 (temporary item, aka
      // OTF record):
      if (this.getItemType() && this.getItemType() === 50) {
        rationale.push('catalogItemType')
      }
      // Next, we'll suppress it if fixed "Item Code 2" is 's', 'w', 'd', or 'p'
      if (['s', 'w', 'd', 'p'].indexOf(this.fixed('Item Code 2')) >= 0) {
        rationale.push('fixed "Item Code 2"')
      }
    }

    return rationale
  }
}

module.exports = SierraItem
