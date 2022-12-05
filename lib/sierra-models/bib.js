const SierraItem = require('./item')
const SierraHolding = require('./holding')
const SierraBase = require('./base')
class SierraBib extends SierraBase {
  constructor (bib) {
    super(bib)
    this._items = bib._items.map((item) => new SierraItem(item))
    this._holdings = bib._holdings.map((holding) => new SierraHolding(holding))
  }

  items () {
    return this._items
  }

  holdings () {
    return this._holdings
  }
}

module.exports = SierraBib
