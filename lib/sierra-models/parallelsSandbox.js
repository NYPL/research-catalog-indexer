const _parseParallelFieldLink = (subfield6) => {
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

_extractSubfield6 = (field) => {
  const subfields = field.subfields || field.subFields
  const subfield6 = subfields.find((sub) => sub.tag === '6')
  const content = subfield6?.content
  if (content) {
    const parsed = _parseParallelFieldLink(content)
    return parsed
  }
}


prim = [{
  marctag: 245,
  value: '03',
  subfields: [{ tag: '6', content: '880-03' }]
},
{
  marctag: 245,
  value: '02',
  subfields: [{ tag: '6', content: '880-02' }]
},
{
  marctag: 245,
  value: 'no primary',
  subfields: [{ tag: 'a', content: '880-02' }]
}]

const para = [
  {
    value: '01',
    marctag: 880,
    subfields: [{ tag: '6', content: '245-01' }]
  },
  {
    value: '03',
    marctag: 880,
    subfields: [{ tag: '6', content: '245-03' }]
  },
  {
    value: '02',
    marctag: 880,
    subfields: [{ tag: '6', content: '245-02' }]
  }]

// primaries and parallels are arrays of fields returned from 
// SierraBase._extractValuesFromVarfields. The primaries would just
// be returned from that function directly. The parallels would 
// have already been cached into an instance variable, after having
// been returned from _extractValuesFromVarFields(880, etc)
const _addParallels = (primaries = prim, parallels = para) => {
  // generate lookup table associating subfield6 suffix with parallel
  // respective parallel fields. These would be generated per marc tag
  const lookupTable = {
    '03': para[1],
    '02': para[2],
    '01': para[0]
  }
  const primariesWithAndWithoutMatches = primaries.map((field, i) => {
    // get subfield6
    const subfieldSix = _extractSubfield6(field)
    const subfieldSixSuffix = subfieldSix?.number
    // if its in table, 
    if (lookupTable[subfieldSixSuffix]) {
      //    add parallel to the primary
      field.parallel = lookupTable[subfieldSixSuffix]
      //    remove parallel from table, or find another way to signify that its an orphan
      lookupTable[subfieldSixSuffix] = null
    }
    // return primary
    return field
  })
  const orphanParallels = parallels.map((p) => {
    // get subfieldSixSuffix

    const subfieldSix = _extractSubfield6(p)
    const subfieldSixSuffix = subfieldSix?.number
    // if that subfield 6 remains in lookup table
    if (lookupTable[subfieldSixSuffix]) {
      return { parallel: p }
    }
  }).filter((p) => p)
  return primariesWithAndWithoutMatches.concat(orphanParallels)
}

console.log(_addParallels())
