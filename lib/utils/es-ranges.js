
/**
 *  Given an array representing one or more ranges
 *  returns an array of objects that ES understands to represent ranges
 *  (i.e. includes "gte" and "lte" properties identifying range)
 *
 *  Will reorder the range if lower/upper bounds are swapped to ensure
 *  it's a valid ES range
 */
exports.arrayToEsRangeObject = function (rangeArray) {
  if (!Array.isArray(rangeArray) || rangeArray.length !== 2) throw Error('Invalid array passed to arrayToEsRangeObject')

  const [gte, lte] = exports.fixMisorderedRange(rangeArray)
  return {
    gte,
    lte
  }
}

/**
 *  Given an array of ranges (a 2-D array of 2-element arrays), returns
 *  the lowest lower bounds in any of the ranges
 */
exports.lowestEsRangeValue = function (arrayOfEsRanges) {
  if (!arrayOfEsRanges || arrayOfEsRanges.length === 0) return null

  return arrayOfEsRanges
    .sort((r1, r2) => r1.gte < r2.gte ? -1 : 1)
    .shift().gte
}

/**
 *  Given a range (a 2-element array), returns a new array with elements ordered
 */
exports.fixMisorderedRange = function (range) {
  // Sort values to correct for swapped upper/lower bounds
  return [].concat(range)
    .sort((v1, v2) => v1 < v2 ? -1 : 1)
}
