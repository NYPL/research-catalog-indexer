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

/**
 * Given a raw mapping entry, returns a {MarcQuery} object suitable for passing
 * into SierraBase.varFieldsMulti
 */
const mappingEntryToMarcQueryObject = (mapping) => {
  const marcQuery = Object.assign({}, mapping)
  if (mapping.excludedSubfields) {
    marcQuery.mappingOptions = { excludedSubfields: marcQuery.excludedSubfields }
    delete marcQuery.excludedSubfields
  }

  return marcQuery
}

/**
 *
 *  @typedef MappingGetter
 *  @type {function}
 *  @param {string} propertyName - The property name to look up (e.g. contributorLiteral)
 *  @param {SierraBase} record - The record we intend to query (which may determine the set of MarcQuery objects returned
 *  @return {MarcQuery[]}
 *
 * Given a record type, returns a function that returns a MappingsGetter function
 *
 * @param {string} type - The record type. One of bib, item, or holding
 * @return {MappingGetter}
 */
const makeMappingsGetter = (type) => {
  const mappings = require(`./${type}-mapping.json`)
  return (propertyName, record) => {
    let mappingsForRecord = mappings
    // If nyplSource given, trim mappings to agree with it:
    if (record.nyplSource) mappingsForRecord = amendMappingsBasedOnNyplSource(mappings, record.nyplSource)
    if (!mappingsForRecord[propertyName]) return null

    return (mappingsForRecord[propertyName].paths || [])
      .map(mappingEntryToMarcQueryObject)
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
