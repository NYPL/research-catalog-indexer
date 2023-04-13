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
    return this._convertRawFieldToVarFieldMatch(varFields, subfields, opts)
  }

  ldr () {
    let val = this._vars()
      .filter((v) => v.fieldTag === '_')[0]
    if (!val || !val.content) return null
    val = val.content
    return {
      recStat: val[5],
      recType: val[6],
      bibLevel: val[7]
    }
  }

  _cacheParallels () {
    const parallels = this._varFieldByMarcTag(880)
    return parallels.reduce((acc, parallelField) => {
      const { tag, number } = this._parseSubfield6(parallelField)
      return { ...acc, [tag + '-' + number]: parallelField }
    }, {})
  }

  _parseSubfield6 (field) {
    // otherwise, it is a raw field from _varField
    const subfields = field.subfields || field.subFields
    const subfield6 = subfields?.find((sub) => sub.tag === '6')
    const content = subfield6?.content
    if (content) {
      const parsed = this._parseParallelFieldLink(content)
      return parsed
    }
  }

  // This function takes a marc tag, and returns an array of primary values with
  //   relevant parallel values attached and or orphaned parallels relevant to
  //   given marc tag
  _fieldsWithParallelsAndOrPrimaries (marc) {
    // _varFieldByMarcTag returns array of raw marc fields filtered by marc tag:
    //  [{fieldTag: 'a', marcTag: '123', content: 'the thing'}]
    const primaryRawFields = this._varFieldByMarcTag(marc)
    const parallelFieldLinks = Object.keys(this.parallelsCache)
      .filter((parallelLink) => parallelLink.includes(marc))
    const parallelRawFields = parallelFieldLinks.map((parallelLink) => this.parallelsCache[parallelLink])

    // build lookup table with extracted values
    const parallelsLookup = parallelRawFields.reduce((lookup, rawField, i) => {
      const { number } = this._parseParallelFieldLink(parallelFieldLinks[i])
      // number is the two digits after the dash (100-01, number = 01)
      //   since we've filtered on marc tag, we can check for match based
      //   on number, which is the only value available in both primary and
      //   parallel subfield 6.
      return { ...lookup, [number]: rawField }
    }, {})

    const attachParallelToPrimary = (field) => {
      const subfieldSix = this._parseSubfield6(field)
      if (subfieldSix) {
        const { number: subfieldSixSuffix } = subfieldSix
        // if its in table,
        if (parallelsLookup[subfieldSixSuffix]) {
          //    add parallel to the primary
          field.parallel = { ...parallelsLookup[subfieldSixSuffix] }
          //    set value to null, so we know that parallel has been matched
          delete parallelsLookup[subfieldSixSuffix]
        }
      }
      return field
    }

    const primariesWithAndWithoutMatches = primaryRawFields
      .map(attachParallelToPrimary)

    const orphanParallels = Object.values(parallelsLookup)
      .map((parallel) => ({ parallel }))

    // Join primaries (with attached parallels) to orphaned parallels
    return primariesWithAndWithoutMatches.concat(orphanParallels)
  }

  // Return content for given marc tag, including parallels and orphaned parallels
  //   if subfields given, returns content of those fields joined (or as a hash if opts.tagSubfields is truthy)
  // Options include:
  //  * tagSubfields: If true, returns a hash of subfield values (rather than joining the values in a single string)
  //  * subfieldJoiner: Character to join subfield values. Default ' '
  //  * preFilter: Optional function to filter out matching marc blocks before extracting value. Useful for checking atypical properties like `ind1`.
  //  * excludeSubfields: Optional array identifying subfields that should be excluded (e.g. ['0', '6'])
  varField (marc, subfields, opts) {
    const fieldsWithParallelsAndOrPrimaries = this._fieldsWithParallelsAndOrPrimaries(marc)
    // do extraction here after everything is all matched
    const fieldsFormatted = this._convertRawFieldToVarFieldMatch(fieldsWithParallelsAndOrPrimaries, subfields, opts)
    return fieldsFormatted.filter((field) => field.value)
  }

  // Get marc field segment (e.g. varFieldSegment('008', [35, 37]) => 'eng')
  varFieldSegment (marc, range) {
    const values = this.varField(marc)
    if (values && values.length > 0) {
      if (values[0].value.length >= range[1]) {
        // Note: ranges are generally specified inclusive, so ending index should add 1
        return values[0].value.substring(range[0], range[1] + 1)
      }
    }
  }

  varFieldsMulti (marcObjects) {
    return marcObjects.map(({ marc, subfields, opts }) => this.varField(marc, subfields, opts)).flat().filter(varField => varField)
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
  _convertRawFieldToVarFieldMatch (rawFields, includedSubfields, opts) {
    opts = opts || {}
    opts = Object.assign({
      tagSubfields: false,
      subfieldJoiner: ' ',
      preFilter: (block) => true,
      excludedSubfields: []
    }, opts)

    if (Array.isArray(rawFields) && rawFields.length) {
      const vals = rawFields.filter(opts.preFilter).map((field) => {
        // Build return:
        const varFieldMatchReturn = {}

        // Build value
        //
        // If this raw varfield contains any subfields at all (always true, except for orphaned parallels):
        // (sometimes there's a case error)
        const unfilteredSubFields = field.subFields || field.subfields
        if (unfilteredSubFields) {
          let filteredSubfields = unfilteredSubFields

          // Apply inclusion/exclusion rules to select desired subfields:
          if (includedSubfields) {
            filteredSubfields = filteredSubfields
              .filter((sub) => includedSubfields.indexOf(sub.tag) >= 0)
          } else if (opts.excludedSubfields) {
            filteredSubfields = filteredSubfields
              .filter((sub) => !opts.excludedSubfields.includes(sub.tag) && sub.tag !== '6')
          }

          varFieldMatchReturn.value = filteredSubfields.map((sub) => sub.content).join(opts.subfieldJoiner)
          varFieldMatchReturn.subfieldMap = filteredSubfields.reduce((hash, sub) => {
            hash[sub.tag] = sub.content
            return hash
          }, {})
        } else if (field.content) {
          varFieldMatchReturn.value = field.content
        }

        // Build parallel:
        if (field.parallel) {
          const subfield6 = this._parseSubfield6(field.parallel)
          // coerce parallel into array for the purpose of recursive call
          varFieldMatchReturn.parallel = this._convertRawFieldToVarFieldMatch([field.parallel], includedSubfields, opts)[0]
          if (subfield6) {
            varFieldMatchReturn.parallel.script = subfield6.script
            varFieldMatchReturn.parallel.direction = subfield6.direction
          }
        }

        return varFieldMatchReturn
      })
      return [].concat.apply([], vals).filter((v) => v)
    } else return []
  }

  _parseParallelFieldLink (subfield6) {
    const scriptLookup = {
      '(3': 'arabic',
      '(B': 'latin',
      $1: 'cjk',
      '(N': 'cyrillic',
      '(S': 'greek',
      '(2': 'hebrew'
    }
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
      script: scriptLookup[scriptCode]
    }
  }
}

module.exports = SierraBase
