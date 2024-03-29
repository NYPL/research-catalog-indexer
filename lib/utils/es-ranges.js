const { leftPad } = require('../utils')

/**
 *  Given an array representing one or more ranges
 *  returns an array of objects that ES understands to represent ranges
 *  (i.e. includes "gte" and "lte" properties identifying range)
 *
 *  Will reorder the range if lower/upper bounds are swapped to ensure
 *  it's a valid ES range
 */
const arrayToEsRangeObject = (rangeArray) => {
  if (!Array.isArray(rangeArray) || rangeArray.length !== 2) throw Error('Invalid array passed to arrayToEsRangeObject')

  const [gte, lte] = _fixMisorderedRange(rangeArray)
  return {
    gte,
    lte
  }
}

/**
 *  Given an array of ranges (a 2-D array of 2-element arrays), returns
 *  the lowest lower bounds in any of the ranges
 */
const _lowestEsRangeValue = function (arrayOfEsRanges) {
  if (!arrayOfEsRanges || !Array.isArray(arrayOfEsRanges) || arrayOfEsRanges.length === 0) return null
  // Reject if no range has gte:
  if (!arrayOfEsRanges.find((r) => r.gte)) return null

  return arrayOfEsRanges
    .sort((r1, r2) => r1.gte < r2.gte ? -1 : 1)
    .shift().gte
}

/**
 *  Given a range (a 2-element array), returns a new array with elements ordered
 */
const _fixMisorderedRange = (range) => {
  // Sort values to correct for swapped upper/lower bounds
  return [].concat(range)
    .sort((v1, v2) => v1 < v2 ? -1 : 1)
}

const enumerationChronologySortFromEsRanges = (volumeRange, dateRange) => {
  const lowestVolume = _lowestEsRangeValue(volumeRange)
  const lowestDate = _lowestEsRangeValue(dateRange)

  if (!lowestVolume && !lowestDate) return null

  // Build enumerationChronology_sort as the lowest vol number (left-
  // padded) followed by the lowest date
  const enumerationChronologySort = [
    leftPad(lowestVolume, 10, ' '),
    lowestDate
  ].join('-')

  return enumerationChronologySort
}

module.exports = {
  arrayToEsRangeObject,
  enumerationChronologySortFromEsRanges,
  _fixMisorderedRange,
  _lowestEsRangeValue
}
