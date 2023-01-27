function parallel (marc, subfields = null, opts = {}) {
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

module.exports = parallel
