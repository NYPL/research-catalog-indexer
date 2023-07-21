/**
 *  Generally usable formatting utils
 */

/**
 *  Given a hash, returns a new hash containing key-value pairs that meet:
 *   1) key must be in given `keys`
 *   2) value must by truthy
 */
const hashByKeysWithTruthyValues = (hash, keys) => {
  return Object.keys(hash)
    .reduce((newHash, key) => {
      const value = hash[key]
      // If the keys requested include this key
      // .. and extracted value is truthy
      // .. include it in new hash.
      if (keys.indexOf(key) >= 0 && value) newHash[key] = value
      return newHash
    }, {})
}

/**
 * Get array of truthy values from hash matching given keys
 *
 * @example
 * truthyValuesByKeys ({ key1: 'value1', key2: 'value2', key3: null }, ['key2'])
 *   => ['value2']
 */
const truthyValuesByKeys = (hash, keys) => {
  hash = hashByKeysWithTruthyValues(hash, keys)
  return Object.keys(hash).map((key) => hash[key])
}

// subjectLiteral formatter
const subjectLiteralFromSubfieldMap = (subfieldMap) => {
  // Join one set of keys with spaces
  // and another set of keys with ' -- '
  return [
    truthyValuesByKeys(subfieldMap, ['a', 'b', 'c', 'd', 'e', 'g', '4'])
      .map((v) => Array.isArray(v) ? v.join(' ') : v)
      .join(' '),
    truthyValuesByKeys(subfieldMap, ['v', 'x', 'y', 'z'])
      .map((v) => Array.isArray(v) ? v.join(' -- ') : v)
      .join(' -- ')
  ]
    // If either set of values matched nothing, drop it:
    .filter((v) => v)
    // Join sets together with ' -- ':
    .join(' -- ')
}

module.exports = {
  subjectLiteralFromSubfieldMap
}
