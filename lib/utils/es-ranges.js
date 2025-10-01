const { leftPad } = require('../utils')
const moment = require('moment')

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

// accepts a string representing a year, possibly with some digits unspecified,
// but expects at least the first digit
// returns the earliest date consistent with that partially specified year
// used to populate the beginning of date ranges for bibs
const roundDateDown = (date) => {
  if (!date.match(/^\d/g)) { return null }
  return date.replaceAll(/[^\d]/g, 0)
}

// accepts a string representing a year, possibly with some digits unspecified
// but expects the specified digits to be a prefix
// returns the latest date consistent with that partially specified year
// used to populate the end of date ranges for bibs
const roundDateUp = (date) => {
  if (!date.match(/^\d{0,}[^\d]{0,4}$/)) { return null }
  return date.replaceAll(/[^\d]/g, 9)
}

class InconsistentDateRange extends Error {}
class InvalidDateError extends Error {}

const validateDate = (dateObj) => {
  const validatedDate = dateObj
  const attrs = ['gte', 'lte', 'lt']
  attrs.forEach((attr) => {
    if (attr in dateObj.range && !moment(dateObj.range[attr], moment.ISO_8601, true).isValid()) {
      throw new InvalidDateError()
    }
  })
  return validatedDate
}

const generateDateRangeFromYears = (first, second, rawMarc, type) => {
  const firstRoundedDown = roundDateDown(first)
  const secondRoundedUp = roundDateUp(second)
  if (!rawMarc || !rawMarc.length) { return null }
  if (!firstRoundedDown) { return null }
  if (parseInt(firstRoundedDown) > parseInt(secondRoundedUp)) {
    throw new InconsistentDateRange()
  }
  const date = {
    range: {
      gte: firstRoundedDown,
      lt: (parseInt(secondRoundedUp) + 1).toString()
    },
    raw: rawMarc[0].value,
    tag: type
  }
  if (parseInt(date.range.lt) > 9999) {
    delete date.range.lt
    date.range.lte = '9999'
  }
  return validateDate(date)
}

const generateDateRangeFromSingleDate = (year, month, day, rawMarc, type) => {
  if (!year.match(/^\d{4}$/)) { return null }
  if (!month.match(/^\d{2}$/)) {
    return generateDateRangeFromYears(year, year, rawMarc, type)
  }
  let date
  if (day.match(/^\d{2}$/)) {
    date = {
      range: {
        gte: `${year}-${month}-${day}`,
        lte: `${year}-${month}-${day}T23:59:59`
      },
      raw: rawMarc[0].value,
      tag: type
    }
  } else if (parseInt(month) !== 12) {
    date = {
      range: {
        gte: `${year}-${month}-01`,
        lt: `${year}-${leftPad(parseInt(month) + 1, 2, '0')}-01`
      },
      raw: rawMarc[0].value,
      tag: type
    }
  } else {
    date = {
      range: {
        gte: `${year}-12-01`,
        lt: `${year}-12-31T23:59:59`
      },
      raw: rawMarc[0].value,
      tag: type
    }
  }
  return validateDate(date)
}

module.exports = {
  arrayToEsRangeObject,
  enumerationChronologySortFromEsRanges,
  _fixMisorderedRange,
  _lowestEsRangeValue,
  roundDateUp,
  roundDateDown,
  generateDateRangeFromYears,
  generateDateRangeFromSingleDate,
  InconsistentDateRange,
  InvalidDateError
}
