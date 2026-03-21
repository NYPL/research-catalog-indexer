const { parseEnumerationTags } = require('../utils/parse-enumeration-chronology')

const BaseItem = (C) => {
  return class extends C {
    _taggedEnumerations () {
      if (!this.__taggedEnumerations) {
        const fieldTagV = this.enumerationChronology()
        this.__taggedEnumerations = fieldTagV ? parseEnumerationTags(fieldTagV[0]) : []
      }

      return this.__taggedEnumerations
    }

    _taggedEnumerationTypes () {
      return this._taggedEnumerations()?.map((tag) => tag.type)
    }

    _taggedYear () {
      return this._taggedEnumeration('year')
    }

    _taggedEnumeration (type) {
      const tag = this._taggedEnumerations()?.find((tag) => tag.type === type)
      return tag ? tag.start : null
    }
  }
}

module.exports = BaseItem
