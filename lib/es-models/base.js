const { sortableShelfMark } = require('../utils/shelfmark')
const { HoldingMappings, BibMappings, ItemMappings } = require('../mappings/mappings')
const { parallelValues, primaryValues } = require('../utils/primary-and-parallel-values')

const { toJson } = require('../to-json')

class EsBase {
  /**
   *  Returns a sortable form of this.shelfMark() for those descendent models
   *  that implement it.
   *
   *  Note that, unlike most other ES properties, we're indexing this as a
   *  string instead of an array. There's no functional difference, but we're
   *  choosing string for parity with discovery-hybrid-indexer.
   */
  async _sortableShelfMark () {
    if (!this.shelfMark) return null

    const shelfMarkArray = this.shelfMark()
    if (!shelfMarkArray || !shelfMarkArray[0]) {
      // Order by id if we have no call numbers, but make sure these items
      // go after items with call numbers
      const uri = await this.uri()
      return `b${uri}`
    }

    const shelfMark = shelfMarkArray.shift()
    if (shelfMark) {
      // order by call number; Put these items first
      return 'a' + sortableShelfMark(this.shelfMark()[0])
    }
  }

  /**
   *  All ES models are "jsonable", meaning they can be rendered as a
   *  plainobject by calling `.toJson()`.
   *
   *  If any sub-models implement `.toJson`, they will also be rendered as a
   *  plainobject. For example, if `EsBib.prototype.items` returns an array of
   *  `EsItem` instances, calling `.toJson` on the `EsBib` instance will
   *  trigger calling `.toJson` on each of the `EsItem` instances.
   */
  async toJson () {
    // Apply to-json to this object:
    const plainObject = await toJson(this)
    // Recursively apply to-json to any child entity that implements toJson:
    await Promise.all(
      Object.entries(plainObject).map(async ([key, value]) => {
        // Handle case where ES model method returns a single ES model:
        if (value && value.toJson) {
          plainObject[key] = await value.toJson()
        // Handle case where ES model method returns an array of ES models:
        } else if (Array.isArray(value) && value.some((v) => v && v.toJson)) {
          plainObject[key] = await Promise.all(
            value.map((subModel) => subModel && subModel.toJson())
          )
        }
      })
    )
    return plainObject
  }

  _valueToIndexFromBasicMapping (field, primary = true) {
    const fields = this._varFieldMatchesForBasicMapping(field)
    const values = primary ? primaryValues(fields) : parallelValues(fields)
    return values.length === 0 ? null : values
  }

  _varFieldMatchesForBasicMapping (field) {
    // due to implcit binding, `this` refers to the object where this method is called, which is an Elastic Search model (bib, item, or holding)
    const esRecordType = this.constructor.name
    let mapping
    let record
    if (esRecordType === 'EsHolding') {
      mapping = HoldingMappings
      record = 'holding'
    }
    if (esRecordType === 'EsItem') {
      mapping = ItemMappings
      record = 'item'
    }
    if (esRecordType === 'EsBib') {
      mapping = BibMappings
      record = 'bib'
    }
    const mappings = mapping.get(field, this[record])
    return this[record].varFieldsMulti(mappings)
  }
}

module.exports = EsBase
