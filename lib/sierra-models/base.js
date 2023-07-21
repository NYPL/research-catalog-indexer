const logger = require('../logger')
const { dupeObjectsByHash, uniqueObjectsByHash } = require('../utils/general')

class SierraBase {
  constructor (obj) {
    if (obj instanceof SierraBase) return obj
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

  fixed (name) {
    return this._fixedMap[name]
  }

  isNyplRecord () {
    return !this.isPartnerRecord()
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
      const parsedSubfield6 = this._parseSubfield6(parallelField)
      if (parsedSubfield6 && parsedSubfield6.tag && parsedSubfield6.number) {
        const { tag, number } = this._parseSubfield6(parallelField)
        return { ...acc, [tag + '-' + number]: parallelField }
      }

      return { ...acc }
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

  /**
   *
   * @typedef VarFieldQueryOptions
   * @type {object}
   * @property {string} subfieldJoiner - Character to join subfield values.
   *   Default ' '.
   * @property {function} preFilter - Optional function to filter out matching
   *   marc blocks before extracting value. Useful for checking atypical
   *   properties like `ind1`.
   * @property {string[]} excludeSubfields - Optional array identifying
   *   subfields that should be excluded (e.g. ['0', '6'])
   * @property {boolean} dedupe - Optional boolean indicating whether return
   *   should de-deupe entries that have matching primary and parallel values.
   *   Default true.
   *
   *
   * Given a marc tag, an array of subfields, and a hash of options, returns an
   * array of {VarFieldMatch} objects.
   *
   * @param {string} marc - The marc tag. E.g. '650', '100'
   * @param {string[]} subfields - An array of subfields to fetch.
   * @param {VarFieldQueryOptions} opts - A hash of options. (See
   *   VarFieldQueryOptions definition above)
   *
   * @return {VarFieldMatch[]}
   */
  varField (marc, subfields, opts) {
    opts = Object.assign({
      dedupe: true
    }, opts)
    const fieldsWithParallelsAndOrPrimaries = this._fieldsWithParallelsAndOrPrimaries(marc)

    // do extraction here after everything is all matched
    let matches = this._convertRawFieldToVarFieldMatch(fieldsWithParallelsAndOrPrimaries, subfields, opts)
      // Make sure there's either a primary or a parallel value:
      .filter((field) => field.value || field.parallel)

    if (opts.dedupe) {
      // De-dupe based on primary and parallel values:
      matches = this._uniqueVarFieldMatches(matches)
    }
    return matches
  }

  _uniqueVarFieldMatches (matches) {
    // Create a hash function, which will be used to determine equality of two
    // different maches. We consider two VarFieldMatches as being equal if
    // their primary and parallel values are equal:
    const hasher = (entry) => [entry.value, entry.parallel?.value].join('🎸')

    const unique = uniqueObjectsByHash(matches, hasher)

    if (unique.length < matches.length) {
      const dupes = dupeObjectsByHash(matches, hasher)
        // Only show first entry in each set of dupes, since they're presumably identical:
        .map((set) => set[0])
      logger.debug(`Removed ${matches.length - unique.length} dupe VarFieldMatch entries`, dupes)
    }

    return unique
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

  /**
   *
   *  @typedef MarcQuery
   *  @type {object}
   *  @property {string} marc - The marc tag. E.g. '650', '100'
   *  @property {string[]} subfields - An array of subfields to fetch.
   *  @property {VarFieldQueryOptions} mappingOptions - A hash of options.
   *
   *
   * Given an array of {MarcQuery} objects, returns a flattened array of {VarFieldMatch} objects.
   *
   * @param {MarcQuery[]} marcObjects - An array of MarcQuery objects. (See definition above)
   *
   * @return {VarFieldMatch[]}
   */
  varFieldsMulti (marcObjects) {
    return marcObjects
      .map(({ marc, subfields, mappingOptions }) => {
        return this.varField(marc, subfields, mappingOptions)
      })
      .flat()
      .filter((varField) => varField)
  }

  isPartnerRecord () {
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

  /**
   *  @typedef VarFieldMatch
   *  @type {object}
   *  @property {string} value - The primary value built from joining the subfield values
   *  @property {object} subfieldMap - An object that relates each subfield to it's value(s). Multiple values for a single subfield will be given as an array
   *  @property {VarFieldMatchParallel} parallel
   *
   *  @typedef VarFieldMatchParallel
   *  @type {object}
   *  @property {string} value - The parallel value built by joining the subfield values
   *  @property {object} subfieldMap - An object that relates each subfield to it's value(s). Multiple values for a single subfield will be given as an array
   *  @property {string} script - Identifies the script class. One of arabic, latin, cjk, cyrillic, greek
   *  @property {string} direction - Identifies the script direction. One of rtl, ltr
   *
   *
   * Given an array of raw varField entries from the Sierra record and the
   * queries sufields and options, returns VarFieldMatch objects
   *
   * @return {VarFieldMatch[]}
   */
  _convertRawFieldToVarFieldMatch (rawFields, includedSubfields, opts) {
    opts = opts || {}
    opts = Object.assign({
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
            // If there are multiple values for this tag, convert it into an array:
            if (hash[sub.tag]) {
              if (typeof hash[sub.tag] === 'string') {
                hash[sub.tag] = [hash[sub.tag]]
              }
              hash[sub.tag].push(sub.content)
            } else {
              hash[sub.tag] = sub.content
            }
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

    let [tag, number] = tagAndNumber.split('-')
    // Remove trailing non-numerics from number (e.g. "880-04." should produce "04")
    number = number.replace(/[^0-9]$/, '')

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
