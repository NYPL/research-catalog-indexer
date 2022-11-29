const SierraBase = require('./base')
class SierraBib extends SierraBase {
  items () {
    return this._items
  }

  holdings () {
    return this._holdings
  }
}

module.exports = SierraBib
