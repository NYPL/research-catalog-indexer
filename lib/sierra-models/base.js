class SierraBase {
  constructor (obj) {
    for (const key in obj) {
      this[key] = obj[key]
    }
    this._fixedMap = {}
    if (this.fixedFields) {
      this._fixedMap = Object.keys(this.fixedFields).reduce((map, k) => {
        const value = this.fixedFields[k].value
        const label = this.fixedFields[k].label
        map[label] = value
        return map
      }, {})
    }
  }

  isNyplRecord () {
    return !this._isPartnerRecord()
  }

  fieldTag (field, subfields, opts) {
    const varFields = this._varFieldByFieldTag(field)
    return this._extractValuesFromVarFields(varFields, subfields, opts)
  }

  // Return content for given marc tag
  // if subfields given, returns content of those fields joined (or as a hash if opts.tagSubfields is truthy)
  // Options include:
  //  * tagSubfields: If true, returns a hash of subfield values (rather than joining the values in a single string)
  //  * subfieldJoiner: Character to join subfield values. Default ' '
  //  * preFilter: Optional function to filter out matching marc blocks before extracting value. Useful for checking atypical properties like `ind1`.
  //  * excludeSubfields: Optional array identifying subfields that should be excluded (e.g. ['0', '6'])
  varField (marc, subfields, opts) {
    const fields = this._varFieldByMarcTag(marc)
    // does this need to return an array if we're not using its return value anymore?
    return this._extractValuesFromVarFields(fields, subfields, opts)
  }

  _isPartnerRecord () {
    // Presently matches known partner sources: recap-pul and recap-cul:
    return this.nyplSource && /^recap-/.test(this.nyplSource)
  }

  _vars () {
    return this.varFields ? Array.prototype.slice.call(this.varFields) : []
  }

  _varFieldByFieldTag (fieldTag) {
    return this._vars().filter((f) => !f.marcTag && f.fieldTag === `${fieldTag}`)
  }

  _varFieldByMarcTag (marc) {
    return this._vars().filter((f) => f.marcTag === `${marc}`)
  }

  _extractValuesFromVarFields (varFields, subfields, opts) {
    opts = opts || {}
    opts = Object.assign({
      tagSubfields: false,
      subfieldJoiner: ' ',
      preFilter: (block) => true,
      excludedSubfields: []
    }, opts)

    if (Array.isArray(varFields) && varFields.length) {
      const vals = varFields.filter(opts.preFilter).map((f) => {
        // sometimes there's a case error...
        const unfilteredFields = f.subFields || f.subfields
        // Remove any sufield we're meant to exclude
        const _subFields = unfilteredFields && opts.excludedSubfields
          ? unfilteredFields.filter(subfield => !opts.excludedSubfields.includes(subfield.tag))
          : unfilteredFields

        const subfieldParse = (subs) => {
          const subfieldMap = subs.reduce((hash, sub) => {
            hash[sub.tag] = sub.content
            return hash
          }, {})
          const value = subs.map((sub) => sub.content).join(opts.subfieldJoiner)
          return { value, subfieldMap }
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

  _parseParallelFieldLink (subfield6) {
    console.log('poopybutts')
    // Subfield 6 has form "[varfield]-[number]..."
    // In 880 fields, it may include language and direction suffixes,
    //   e.g. "245-01/(2/r", "100-01/(3/r"
    // In primary field (e.g. 245 $u) it will be for ex. "245-01"
    const parallelFieldLinkParts = subfield6.match(/^(\d+)-(\d+)(\/([^/]+)\/(\w))?/)

    // This should never happen, but if $6 is malformed, return null:
    if (!parallelFieldLinkParts) return null

    // Get the marc tag linked to by this 880 (e.g. '245')
    const tag = parallelFieldLinkParts[1]
    // Get the specific occurence number of the link (e.g. '01', '02', etc):
    const number = parallelFieldLinkParts[2]

    // Read optional suffix. "r" indicates direction 'rtl'
    let direction = 'ltr'
    if (parallelFieldLinkParts.length === 6 && parallelFieldLinkParts[5] === 'r') direction = 'rtl'
    console.log('parseparallelfiedllinks', tag, number, direction)
    return {
      tag,
      number,
      direction
    }
  }
}

module.exports = SierraBase
