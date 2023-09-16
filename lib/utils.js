const isValidResponse = (resp) => {
  return resp && resp.data
}

/**
 *  Given a bnumber (numeric or prefixed) returns the same id suffixed with
 *  Sierra's check digit
 */
const addSierraCheckDigit = (bnumber) => {
  if (!bnumber) return null
  if (typeof bnumber !== 'string') bnumber = String(bnumber)

  const bnumberPattern = /^([a-z]*)(\d+)$/
  if (!bnumberPattern.test(bnumber)) return null

  // Strip prefix:
  const [, prefix, ogBnumber] = bnumber.match(bnumberPattern)

  const results = []
  let multiplier = 2
  for (const digit of ogBnumber.split('').reverse().join('')) {
    results.push(parseInt(digit) * multiplier++)
  }

  let remainder = results.reduce(function (a, b) { return a + b }, 0) % 11

  // OMG THIS IS WRONG! Sierra doesn't do mod11 riggghhttttt
  // remainder = 11 - remainder

  if (remainder === 11) remainder = 0
  if (remainder === 10) remainder = 'x'

  return `${prefix}${ogBnumber}${remainder}`
}

/**
 * Returns a '0' left-padded string to default length of 6
 */
const zeroPadString = (s, padLen = 6) => leftPad(s, padLen, '0')

/**
 * Given a string, returns a new string left-padded with the specified
 * character to the specified length
 */
const leftPad = function (s, padLen, padChar = '0') {
  s = s === null || (typeof s) === 'undefined' ? '' : String(s)
  return (new Array(Math.max(0, (padLen - s.length) + 1))).join(padChar) + s
}

/**
 * Given an array of objects, removes elements from the end for which the cb
 * returns `true`
 *
 * @example
 * // The following returns ['one', 'two']:
 * removeTrailingEmptyStrings(['one', 'two', '', ''], (v) => v === '')
 *
 */
const removeTrailingElementsMatching = (a, cb) => {
  while (a.length && cb(a[a.length - 1])) {
    a.pop()
  }

  return a
}

/**
 * Given a string with trailing '/', ':', or ',', returns same string without
 * trailing puncutation
 */
const trimTrailingPunctuation = (s) => {
  return s.replace(/\s*(\/|:|,)\s*$/, '')
}

/**
 *  Given an array, returns a new array with unique members
 */
const unique = (array) => {
  return Array.from(new Set(array))
}

/**
 *  Given an array of plainobjects and a "hasher" function, returns a new
 *  array of those objects that are dupes based on the hasher function. That
 *  is, two objects are considered identical if the hasher function returns the
 *  same value for them. When dupes are found, all of them are returned.
 *
 *  @param {object[]} objects - An array of plainobjects
 *  @param {function} hasher - A function that takes a single argument and
 *    returns a string value that uniquely identifies the object's content
 *
 *  For example:
 *    dupeObjectsByHash([
 *      { k1: 'foo' },
 *      { k1: 'foo', k2: 'bar' },
 *      { k1: 'some other value', k2: 'bar' }
 *    ], (obj) => obj.k1)
 *    => [ { k1: 'foo' }, { k1: 'foo', k2: 'bar' } ]
 */
const dupeObjectsByHash = (objects, hasher) => {
  return Object.values(
    objects
      .reduce((h, object) => {
        const key = hasher(object)
        if (!h[key]) h[key] = []
        h[key].push(object)
        return h
      }, {})
  )
    .filter((set) => set.length > 1)
}

/**
 *  Given an array of plainobjects and a "hasher" function, returns a new
 *  array of those objects that are unique based on the hasher function. That
 *  is, two objects are considered identical if the hasher function returns the
 *  same value for them. When multiple objects are found to be identical, only
 *  the last of them is returned, incidentally.
 *
 *  @param {object[]} objects - An array of plainobjects
 *  @param {function} hasher - A function that takes a single argument and
 *    returns a string value that uniquely identifies the object's content
 *
 *  For example:
 *    dupeObjectsByHash([
 *      { k1: 'foo' },
 *      { k1: 'foo', k2: 'bar' }
 *    ], (obj) => obj.k1)
 *    => [ { k1: 'foo', k2: 'bar' } ]
 */
const uniqueObjectsByHash = (objects, hasher) => {
  if (!hasher || typeof hasher !== 'function') throw new Error('uniqueObjectsByHash requires a hasher function')

  const keyObjectPairs = objects.map((object) => [hasher(object), object])
  return [...new Map(keyObjectPairs).values()]
}

/**
 *  Given an array, returns the first value in the array. If the array is empty
 *  or not an array, returns null.
 */
const firstValue = (array) => {
  if (!Array.isArray(array) || array.length === 0) return null
  return array[0]
}

/**
 *  Given an array of objects and an async function that generates a sort key
 *  for any member of the input array, returns the original array sorted by the
 *  generated sort keys.
 *
 *  @param {object[]} array - Array of objects to sort
 *  @param {function} sortKeyGetter - An async function that returns a sortable scalar value
 *  @param {string} direction - Either 'asc' or 'desc'. Default 'asc'
 */
const sortByAsyncSortKey = async (array, sortKeyGetter, direction = 'asc') => {
  const sortableKeyElementPairs = await Promise.all(
    array.map(async (element) => {
      return [await sortKeyGetter(element), element]
    })
  )
  sortableKeyElementPairs.sort((pair1, pair2) => {
    const comparison = pair1[0] < pair2[0] ? -1 : 1
    return comparison * (direction === 'asc' ? 1 : -1)
  })
  return sortableKeyElementPairs.map((pair) => pair[1])
}

module.exports = {
  isValidResponse,
  addSierraCheckDigit,
  zeroPadString,
  leftPad,
  removeTrailingElementsMatching,
  trimTrailingPunctuation,
  unique,
  dupeObjectsByHash,
  uniqueObjectsByHash,
  firstValue,
  sortByAsyncSortKey
}
