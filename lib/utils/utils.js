const prefix = (source) => {
  switch (source) {
    case 'sierra-nypl':
      return 'b'
    case 'recap-pul':
      return 'pb'
    case 'recap-cul':
      return 'cb'
    case 'recap-hl':
      return 'hb'
    default:
      return ''
  }
}

const primaryValues = (mappings, model) => {
  return mappings.paths.map((path) => {
    return model.varField(path.marc, path.subfelds, { excludedSubfields: path.excludedSubfields })
  })
    .reduce((acc, el) => acc.concat(el))
    .map(el => el.value)
}

const parallelValues = (primaryMappings, model) => {
  return primaryMappings.paths.map((path) => {
    return model.parallel(path.marc, path.subfields, { excludeSubfields: path.excludedSubfields })
  })
    .reduce((acc, el) => acc.concat(el))
    .map(el => el.value)
}

module.exports = {
  prefix,
  primaryValues,
  parallelValues
}
