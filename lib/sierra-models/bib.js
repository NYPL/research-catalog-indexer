const SierraItem = require('./item')
const SierraHolding = require('./holding')
const SierraBase = require('./base')
class SierraBib extends SierraBase {
  constructor (bib) {
    super(bib)
    if (this._items) {
      this._items = bib._items.map((item) => new SierraItem(item))
    }
    if (this._holdings) {
      this._holdings = bib._holdings.map((holding) => new SierraHolding(holding))
    }
  }

  items () {
    return this._items
  }

  holdings () {
    return this._holdings
  }

  isInRecap () {
    return this.items() && this.items().some((item) => item.location && item.location.code && item.location.code.startsWith('rc'))
  }

  isOtfRecord () {
    // Location code 'os' is a special location for temporary items
    // https://github.com/NYPL/nypl-core/blob/master/vocabularies/csv/locations.csv#L2265
    const hasOtfLocation = this.locations && this.locations[0] && this.locations[0].code === 'os'

    // Having 910 $a === 'RLOTF' is also a solid indicator introduced in OTF
    // record creation Oct 2021 https://github.com/NYPL/recap-hold-request-consumer/pull/33
    const varfield910 = this.varField('910', 'a')
    const hasOtf910 = Array.isArray(varfield910) && varfield910[0] === 'RLOTF'

    return hasOtfLocation || hasOtf910
  }

  getSuppressionRationale () {
    if (this.suppressed) return 'suppressed'
    if (this.deleted) return 'deleted'
    if (this.isOtfRecord()) return 'is-otf'
    return null
  }

  getSuppressionWithRationale () {
    const rationale = this.getSuppressionRationale()
    return { suppressed: Boolean(rationale), rationale }
  }
}

module.exports = SierraBib
