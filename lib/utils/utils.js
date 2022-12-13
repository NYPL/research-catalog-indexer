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
  primaryValues,
  parallelValues
}
