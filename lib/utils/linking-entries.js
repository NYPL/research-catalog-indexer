const labelMap = {
  780: ['Continues', 'Continues in part', 'Supersedes', 'Supersedes in part', 'Formed by', 'Absorbed', 'Absorbed in part', 'Separated from'],
  785: ['Continued by', 'Continued in part by', 'Superseded by', 'Superseded in part by', 'Absorbed by', 'Absorbed in part by', 'Split into', 'Merged with', 'Changed back to']
}

exports.getLabelForMarcTagAndInd2 = (marcTag, ind2) => {
  return labelMap[marcTag][ind2]
}

exports.sentenceCase = (str) => str.toLowerCase().split(' ')
  .map((word) => word[0].toUpperCase() + word.substring(1))
  .join(' ')

exports.conditionallyJoinArrayFields = (varfieldMatchObject, subfieldTag, filterMethod = (x) => x) => {
  let subfields = varfieldMatchObject.subfieldMap?.[subfieldTag]
  if (!subfields || !subfields.length) return null
  subfields = Array.isArray(subfields) ? subfields : [subfields]
  return subfields.filter(filterMethod).join(' ')
}

exports.hashObject = (object) => {
  // contrived early return for orphan parallels. possible to get the value we need, but unneccessarily
  // complicated because we will not be linking those anywhere.
  if (!object) return
  const string = JSON.stringify(object)
  return Math.abs([...string].reduce((hash, char) => {
    return char.charCodeAt(0) +
            ((hash << 5) - hash)
  }, 0))
}
