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
 *  Given an array of objects and a function that generates a sort key
 *  for any member of the input array, returns the original array sorted by the
 *  generated sort keys.
 *
 *  @param {object[]} array - Array of objects to sort
 *  @param {function} sortKeyGetter - An function that returns a sortable scalar value
 *  @param {string} direction - Either 'asc' or 'desc'. Default 'asc'
 */
const sortByKey = (array, sortKeyGetter, direction = 'asc') => {
  const sortableKeyElementPairs =
    array.map((element) => [sortKeyGetter(element), element])

  sortableKeyElementPairs.sort((pair1, pair2) => {
    const comparison = pair1[0] < pair2[0] ? -1 : 1
    return comparison * (direction === 'asc' ? 1 : -1)
  })
  return sortableKeyElementPairs.map((pair) => pair[1])
}

/**
 *  Simple util for truncating a string to the specified length and adding a
 *  ellipse suffix indicating that a truncation has occurred.
 */
const truncate = (s, length) => {
  if (!s || s.length <= length) return s

  // Use unicode ellipsis ( https://www.compart.com/en/unicode/U+2026 ):
  const suffix = '…'
  return s.substring(0, length - suffix.length) + suffix
}

/**
 *  Creates a compound comparator from an array of comparators. Returns the
 *  first non-zero value returned by any comparactor (or 0 if all return 0).
 *
 *  Useful when you have a set of comparators that you want to apply to an
 *  array of items in a fixed priority - for example to sort by shelfmark (1st
 *  comparator), followed by enumeration tag (second comparator), followed by
 *  alphabetical (third comparator). Each comparator will be attempted in
 *  sequence until one of them returns an inequal response (i.e. 1 or -1)
 **/
const compoundComparator = (comparators) => {
  return (o1, o2) => {
    for (const comparator of comparators) {
      const result = comparator(o1, o2)
      if (result !== 0) return result
    }
    // If all comparators produced 0, then they're equal:
    return 0
  }
}

/**
 *  Given an array of values, returns a hash where keys are the distinct
 *  values and values are the frequency
 *
 *  @example
 *    countDistinctValues(['a', 'b', 'b', 'c'])
 *      => { a: 1, b: 2, c: 1 }
 * */
const countDistinctValues = (a) => {
  if (!Array.isArray(a)) {
    throw new Error(`Invalid array supplied to countDistinctValues: ${a}`)
  }

  return a.reduce((h, v) => ({ ...h, [v]: (h[v] || 0) + 1 }), {})
}
/**
 *  Group elements of an array by whatever key is returned by callback
 *
 *  @example
 *    groupByCallback([1, 2, 3, 4], (v) => v % 2 === 0 ? 'even' : 'odd')
 *      => { even: [2, 4], odd: [1, 3] }
 * */
const groupByCallback = (a, cb) => {
  return a.reduce((h, item) => {
    const groupBy = cb(item)
    if (!h[groupBy]) h[groupBy] = []
    h[groupBy].push(item)
    return h
  }, {})
}

/**
 *  Creates a comparator based on a fixed array of values. The comparator governs
 *  order based on the order of elements in the fixedOrder array.
 *
 *  @example
 *    [1, 2, 3, 4, 5].sort(orderByFixed(['4', 2', 'x']))
 *      => [4, 2, 1, 3, 5]
 * */
const orderByFixedArrayComparator = (fixedOrder) => {
  return (v1, v2) => {
    const fixedOrder1 = fixedOrder.indexOf(v1)
    const fixedOrder2 = fixedOrder.indexOf(v2)
    if (fixedOrder1 >= 0 && fixedOrder2 >= 0) return fixedOrder1 > fixedOrder2 ? 1 : -1
    if (fixedOrder1 >= 0) return -1
    if (fixedOrder2 >= 0) return 1
    return 0
  }
}

module.exports = {
  compoundComparator,
  countDistinctValues,
  isValidResponse,
  addSierraCheckDigit,
  zeroPadString,
  groupByCallback,
  leftPad,
  orderByFixedArrayComparator,
  removeTrailingElementsMatching,
  trimTrailingPunctuation,
  unique,
  dupeObjectsByHash,
  uniqueObjectsByHash,
  firstValue,
  sortByKey,
  truncate
}
