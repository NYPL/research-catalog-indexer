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
    this.parallelsCache = this._cacheParallels()
  }

  isNyplRecord () {
    return !this._isPartnerRecord()
  }

  fieldTag (field, subfields, opts) {
    const varFields = this._varFieldByFieldTag(field)
    return this._prettifyRawVarFields(varFields, subfields, opts)
  }

  _cacheParallels () {
    const parallels = this._varFieldByMarcTag(880)
    return parallels.reduce((acc, parallelField) => {
      const { tag, number } = this._extractAndParseSubfield6(parallelField)
      return { ...acc, [tag + '-' + number]: parallelField }
    }, {})
  }

  _extractAndParseSubfield6 (field) {
    let subfield6
    // If its an extracted field from extractVarfield, there is a
    //   subfieldMap already
    if (field.subfieldMap) {
      subfield6 = field.subfieldMap[6]?.content
    } else {
      // otherwise, it is a raw field from _varField
      const subfields = field.subfields || field.subFields
      subfield6 = subfields?.find((sub) => sub.tag === '6')
    }
    const content = subfield6?.content
    if (content) {
      const parsed = this._parseParallelFieldLink(content)
      return parsed
    }
  }

  // primaries is array of fields returned from
  //   SierraBase._prettifyRawVarFields. parallels is an array of the
  //   raw varField returned from _varFields (needed so we don't prematurely)
  //   lose subfield6. parallelsLookup is a lookup table relating the suffix
  //   of subfield6 to the prettified extracted value returned from
  //   prettifyRawVarFields
  _addParallels (primaries, marc) {
    const parallelFieldLinks = Object.keys(this.parallelsCache)
      .filter((parallelLink) => parallelLink.includes(marc))
    const parallelRawFields = parallelFieldLinks.map((parallelLink) => this.parallelsCache[parallelLink])

    // build lookup table with extracted values
    const parallelsLookup = parallelRawFields.reduce((lookup, rawField, i) => {
      const { number } = this._parseParallelFieldLink(parallelFieldLinks[i])
      // number is the two digits after the dash (100-01, number = 01)
      return { ...lookup, [number]: rawField }
    }, {})

    const lookup = (field) => {
      const subfieldSix = this._extractAndParseSubfield6(field)
      if (subfieldSix) {
        const { number: subfieldSixSuffix } = subfieldSix
        // if its in table,
        if (parallelsLookup[subfieldSixSuffix]) {
          //    add parallel to the primary
          field.parallel = { ...parallelsLookup[subfieldSixSuffix] }
          //    set value to null, so we know that parallel has been matched
          parallelsLookup[subfieldSixSuffix] = null
        }
      }
    }

    const primariesWithAndWithoutMatches = primaries.map((field, i) => {
      lookup(field)
      // return primary
      return field
    })

    const orphanParallels = parallelRawFields.map((field) => {
      // get subfieldSixSuffix
      lookup(field)
      if (field.parallel) {
        return field
      } else { return null }
    }).filter((p) => p)
    return primariesWithAndWithoutMatches.concat(orphanParallels)
  }

  // Return content for given marc tag
  // if subfields given, returns content of those fields joined (or as a hash if opts.tagSubfields is truthy)
  // Options include:
  //  * tagSubfields: If true, returns a hash of subfield values (rather than joining the values in a single string)
  //  * subfieldJoiner: Character to join subfield values. Default ' '
  //  * preFilter: Optional function to filter out matching marc blocks before extracting value. Useful for checking atypical properties like `ind1`.
  //  * excludeSubfields: Optional array identifying subfields that should be excluded (e.g. ['0', '6'])
  varField (marc, subfields, opts) {
    // filter cache on marc tag, pass those raw varfields into extract
    // _varFieldByMarcTag returns array of raw marc fields filtered by marc tag:
    //  [{fieldTag: 'a', marcTag: '123', content: 'the thing'}]
    const primaryRawFields = this._varFieldByMarcTag(marc)
    // prettifyRawVarFields returns array with massaged values per subfield
    //  [{value: 'subfields concatenated', subfieldMap: { a: 'subfields', b: 'concatenated'}}]
    //  for 880 marcTag fields, you end up with the full parallel link and the subfield map
    const fieldsWithParallelsAndOrPrimaries = this._addParallels(primaryRawFields, marc)
    // do extraction here after everything is all matched
    const fieldsFormatted = this._prettifyRawVarFields(fieldsWithParallelsAndOrPrimaries, subfields, opts)
    return fieldsFormatted
  }

  varFieldsMulti (marcObjects) {
    return marcObjects.map(({ marc, subfields, opts }) => this.varField(marc, subfields, opts))
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

  // returns array of raw field data, filtered by marc tag
  _varFieldByMarcTag (marc) {
    return this._vars().filter((f) => f.marcTag === `${marc}`)
  }

  // returns array of objects. value is concatenation of contents of
  //   specified subfields - {value: 'val parallel link', subfieldMap: {a:'val', 6:'parallel link'}}
  _prettifyRawVarFields (rawFields, subfields, opts) {
    opts = opts || {}
    opts = Object.assign({
      tagSubfields: false,
      subfieldJoiner: ' ',
      preFilter: (block) => true,
      excludedSubfields: []
    }, opts)

    if (Array.isArray(rawFields) && rawFields.length) {
      const vals = rawFields.filter(opts.preFilter).map((field) => {
        if (field.parallel) {
          // coerce parallel into array for the purpose of recursive call
          field.parallel = this._prettifyRawVarFields([field.parallel], subfields, opts)[0]
        }
        // sometimes there's a case error...
        const unfilteredFields = field.subFields || field.subfields
        // Remove any sufield we're meant to exclude
        const _subFields = unfilteredFields && opts.excludedSubfields
          ? unfilteredFields.filter(subfield => {
            return !opts.excludedSubfields.includes(subfield.tag) && subfield.tag !== '6'
          })
          : unfilteredFields

        const subfieldParse = (subs) => {
          const subfieldMap = subs.reduce((hash, sub) => {
            hash[sub.tag] = sub.content
            return hash
          }, {})
          const value = subs.map((sub) => sub.content).join(opts.subfieldJoiner)
          if (field.parallel) return { value, subfieldMap, parallel: field.parallel }
          else return { value, subfieldMap }
        }

        // If asked to match certain subfields, return only those:
        if (subfields) {
          const subs = (_subFields || []).filter((sub) => subfields.indexOf(sub.tag) >= 0)
          return subfieldParse(subs)
          // Otherwise, attempt to return 'content', falling back on subfields' content:
        } else {
          return field.content || (_subFields ? subfieldParse(_subFields) : null)
        }
      })
      return [].concat.apply([], vals).filter((v) => v)
    } else return []
  }

  _parseParallelFieldLink (subfield6) {
    // Subfield 6 has form "[varfield]-[number]..."
    // In 880 fields, it may include language and direction suffixes,
    //   e.g. "245-01/(2/r", "100-01/(3/r"
    // In primary field (e.g. 245 $u) it will be for ex. "245-01"
    const [tagAndNumber, scriptCode, dir] = subfield6.split('/')

    // This should never happen, but if $6 is malformed, return null:
    if (!tagAndNumber) return null

    const [tag, number] = tagAndNumber.split('-')

    const direction = dir === 'r' ? 'rtl' : 'ltr'

    return {
      tag,
      number,
      direction,
      scriptCode
    }
  }
}

module.exports = SierraBase
