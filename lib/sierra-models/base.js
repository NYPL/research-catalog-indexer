class SierraBase {
  constructor (obj) {
    for (const key in obj) {
      this[key] = obj[key]
    }
  }

  isNyplRecord () {
    return !this._isPartnerRecord()
  }

  fieldTag (field, subfields, opts) {
    const varFields = this._varFieldByFieldTag(field)
    return this._extractValuesFromVarFields(varFields, subfields, opts)
  }

  _isPartnerRecord () {
    // Presently matches known partner sources: recap-pul and recap-cul:
    return this.nyplSource && /^recap-/.test(this.nyplSource)
  }

  _varFieldByFieldTag (fieldTag) {
    return this.vars().filter((f) => !f.marcTag && f.fieldTag === `${fieldTag}`)
  }

  _extractValuesFromVarFields (varFields, subfields, opts) {
    opts = opts || {}
    opts = Object.assign({
      tagSubfields: false,
      subfieldJoiner: ' ',
      preFilter: (block) => true,
      excludedSubfields: []
    }, opts)

    if (varFields.length) {
      const vals = varFields.filter(opts.preFilter).map((f) => {
        // sometimes there's a case error...
        const unfilteredFields = f.subFields || f.subfields
        // Remove any sufield we're meant to exclude
        const _subFields = unfilteredFields && opts.excludedSubfields
          ? unfilteredFields.filter(subfield => !opts.excludedSubfields.includes(subfield.tag))
          : unfilteredFields

        // return subfields based on options
        const subfieldParse = (subs) => {
          if (opts.tagSubfields) {
            return subs.reduce((hash, sub) => {
              hash[sub.tag] = sub.content
              return hash
            }, {})
          } else {
            return subs.map((sub) => sub.content).join(opts.subfieldJoiner)
          }
        }

        // If asked to match certain subfields, return only those:
        if (subfields) {
          const subs = (_subFields || []).filter((sub) => subfields.indexOf(sub.tag) >= 0)
          return subfieldParse(subs)
          // Otherwise, attempt to return 'content', falling back on subfields' content:
        } else {
          return f.content || (_subFields ? subfieldParse(_subFields) : null)
        }
      })
      return [].concat.apply([], vals).filter((v) => v)
    } else return []
  }
}
