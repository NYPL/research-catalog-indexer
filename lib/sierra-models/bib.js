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
}

module.exports = SierraBib
