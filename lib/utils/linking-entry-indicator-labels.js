const labelMap = {
  780: ['Continues', 'Continues in part', 'Supersedes', 'Supersedes in part', 'Formed by the union of', 'Absorbed', 'Absorbed in part', 'Separated from'],
  785: ['Continued by', 'Continued in part by', 'Superseded by', 'Superseded in part by', 'Absorbed by', 'Absorbed in part by', 'Split into ... and ... (“Split into”)', 'Merged with ... to form ... (“Merged with”)', 'Changed back to']
}

exports.getLabelForMarcTagAndInd2 = (marcTag, ind2) => {
  return labelMap[marcTag][ind2]
}
