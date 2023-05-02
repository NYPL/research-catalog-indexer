const { sortableShelfMark } = require('../utils/shelfmark')

class EsBase {
  /**
   *  Returns a sortable form of this.shelfMark() for those descendent models
   *  that implement it.
   */
  _sortableShelfMark () {
    if (!this.shelfMark) return null

    const shelfMark = this.shelfMark().shift()
    if (shelfMark) {
      // order by call number; Put these items first
      return ['a' + sortableShelfMark(this.shelfMark()[0])]
    } else {
      // Order by id if we have no call numbers, but make sure these items
      // go after items with call numbers
      return ['b' + this.uri()]
    }
  }
}

module.exports = EsBase
