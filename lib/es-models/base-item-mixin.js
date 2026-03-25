const { parseEnumerationTags } = require('../utils/parse-enumeration-chronology')

/**
 *  A basic class mixin with methods common to EsItem and EsCHeckinCardItem instances
 */
const BaseItem = (C) => {
  return class extends C {
    /**
     *  Get a much simplified string representing the class of shelfmark, which
     *  can be compared to other items' "normalized shelfmark"s for grouping.
     */
    _shelfMarkNormalized () {
      if (!this.__shelfMarkNormalized) {
        this.__shelfMarkNormalized = this.esBib._normalizeItemShelfMark(this.shelfMark())
      }

      return this.__shelfMarkNormalized
    }

    /**
     *  Get an array of parsed enumerations
     *
     *  Returns an array of plainobjects that define:
     *   - type {string} - Type of enumeration tag (e.g. volume, number, anno, etc.)
     *   - start {string} - String-sortable representation of the start range
     *   - end {string} - String-sortable representation of the end range (optional)
     */
    _taggedEnumerations () {
      if (!this.__taggedEnumerations) {
        const fieldTagV = this.enumerationChronology()
        this.__taggedEnumerations = fieldTagV ? parseEnumerationTags(fieldTagV[0]) : []
      }

      return this.__taggedEnumerations
    }

    /**
     *  Get all (non-distinct) enumeration tag types
     */
    _taggedEnumerationTypes () {
      return this._taggedEnumerations()?.map((tag) => tag.type)
    }

    /**
     *  If a 'year' enumeration tag has been parsed, returns that value
     */
    _taggedYear () {
      return this._taggedEnumeration('year')
    }

    /**
     *  Get an enumeration tag by tag type
     */
    _taggedEnumeration (type) {
      const tag = this._taggedEnumerations()?.find((tag) => tag.type === type)
      return tag ? tag.start : null
    }
  }
}

module.exports = BaseItem
