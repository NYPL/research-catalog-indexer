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

  parallel (marc, subfields = null, opts = {}) {
    opts = Object.assign({
      excludedSubfields: []
    }, opts)

    // Although we're querying into 880, first perform identical query against
    // linked tag (e.g. 490), including subfield 6:
    const subfieldsWith6 = Array.isArray(subfields) && subfields.length ? subfields.concat(['6']) : null

    // Primary field mapping may exclude 6, but we need it:
    const excludedSubfieldsWithout6 = opts.excludedSubfields ? opts.excludedSubfields.filter((subfield) => subfield !== '6') : null

    // Although we're querying into 880, first perform identical query against
    // linked tag (e.g. 490), including subfield 6:
    const fields = this._varFieldByMarcTag(marc)
    const primaryValues = this._extractValuesFromVarFields(fields, subfieldsWith6, { tagSubfields: true, excludedSubfields: excludedSubfieldsWithout6 })
    const parallelValues = primaryValues
      .map(({ subfieldMap }) => {
        // Grab subfield 6:
        const subfield6 = subfieldMap['6']
        // If there is no $6, intentionally add '' to returned array
        // because we presumably there's some primary value at this index,
        // which just doesn't have a corresponding parallel value.
        if (!subfield6) return ''

        // Parse subfield $6 into tag and number (e.g. 880 & 01 respectively)
        const parallelFieldLink = this._parseParallelFieldLink(subfield6)
        // Subfield 6 should always contain a parsable link, but, make sure..
        if (!parallelFieldLink) return ''

        let direction = 'ltr'
        let scriptCode
        // Find the parallel field by looping over *all* 880s and using a
        // preFilter block to choose the one that has a matching $6:
        const parallelFields = this._varFieldByMarcTag(parallelFieldLink.tag)
        const parallelField = this._extractValuesFromVarFields(parallelFields, subfields, {
          excludedSubfields: opts.excludedSubfields,
          // Use preFilter so that we can filter on raw subfield data:
          preFilter: (block) => {
            // Establish the $u value we're looking for (e.g. 490-01)
            const uVal = `${marc}-${parallelFieldLink.number}`

            // Looking for the one varfield matching the uVal:
            const subFields = block.subFields || block.subfields
            const subfield6 = (subFields.filter((s) => s.tag === '6').pop() || { content: '' }).content

            // If no $6, 880 is malformed; remove it
            if (!subfield6) return false

            const parallelFieldLink880 = this._parseParallelFieldLink(subfield6)

            // If the value in this 880 $6 is malformed, don't consider this 880:
            if (!parallelFieldLink880) {
              // log.warn(`Skipping one of the 880 values because "${subfield6}" is malformed`)
              return false
            }

            // Does this 880 have the expected $u subfield value, e.g. "245-02"
            // 880 $6 values include extra info on end, so just match beginning
            const match = subfield6.indexOf(uVal) === 0

            // If we found the right 880 and this 880's $u includes a direction
            // suffix or script code, grab it:
            if (match) {
              if (parallelFieldLink880.direction) {
                direction = parallelFieldLink880.direction
              }
              if (parallelFieldLink880.scriptCode) {
                scriptCode = parallelFieldLink880.scriptCode
              }
            }
            return match
          }
        })

        // We've queried all matching parallel fields and there will be only
        // one (because we preFilter'd on $u === FIELD-NUM), so return the
        // only match (or undefined if for some reason the link is broken):
        const [parallelValue] = parallelField
        const directionControlPrefix = direction === 'rtl' ? '\u200F' : ''
        return {
          ...parallelValue,
          value: directionControlPrefix + parallelValue.value,
          direction,
          script: scriptCode
        }
      })
    return parallelValues
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

  fixed (label) {
    return this._fixedMap[label]
  }
}

module.exports = SierraBase
