// Utility function, returns true if nyplSource matches any of the given nyplSources patterns
const sourceMatches = (nyplSource, sourcePatterns) => {
  return sourcePatterns.filter((pattern) => {
    return pattern === '*' || pattern === nyplSource
  }).length > 0
}

// Takes a mappings doc and an nyplSource and removes any mappings paths that
// are invalid based on the nyplSource
const amendMappingsBasedOnNyplSource = (data, nyplSource) => {
  return Object.keys(data).reduce((m, name) => {
    const revised = Object.assign({}, data[name])
    if (revised.paths) {
      // Remove unmatching paths:
      revised.paths = revised.paths.filter((path) => {
        return (!path.nyplSources || (Array.isArray(path.nyplSources) && sourceMatches(nyplSource, path.nyplSources)))
      })
    }
    m[name] = revised
    return m
  }, {})
}

const makeMappingsGetter = (type, nyplSource) => {
  let mappings = require(`./${type}-mapping.json`)
  // If nyplSource given, trim mappings to agree with it:
  if (nyplSource) mappings = amendMappingsBasedOnNyplSource(mappings, nyplSource)

  return (propertyName, bib) => {
    return mappings[propertyName]
  }
}

module.exports = {
  sourceMatches,
  amendMappingsBasedOnNyplSource,
  BibMappings: {
    get: makeMappingsGetter('bib')
  },
  ItemMappings: {
    get: makeMappingsGetter('item')
  },
  HoldingMappings: {
    get: makeMappingsGetter('holding')
  }
}
