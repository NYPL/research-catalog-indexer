/**
 * Returns the first matching entity in the given mapping hash that has a matching `code`
 * For use with nypl-core-objects mappings
 *
 * @example
 * // Returns the status entity matching code 'a':
 * coreObjectsMappingByCode(require('@nypl/nypl-core-objects')('by-statuses'), 'a')
 */
const coreObjectsMappingByCode = (mapping, code) => {
  // Reduce to values:
  return Object.keys(mapping)
    .map((id) => mapping[id])
    // Filter on matching code:
    .filter((org) => org.code === code)
    // Return first:
    .shift()
}

module.exports = {
  coreObjectsMappingByCode
}
