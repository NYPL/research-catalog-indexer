const isValidResponse = (resp) => {
  return resp && resp.data
}

const bNumberWithCheckDigit = (bnumber) => {
  const ogBnumber = bnumber
  const results = []
  let multiplier = 2
  for (const digit of bnumber.split('').reverse().join('')) {
    results.push(parseInt(digit) * multiplier++)
  }

  const remainder = results.reduce(function (a, b) { return a + b }, 0) % 11

  // OMG THIS IS WRONG! Sierra doesn't do mod11 riggghhttttt
  // remainder = 11 - remainder

  if (remainder === 11) return `${ogBnumber}0`
  if (remainder === 10) return `${ogBnumber}x`

  return `${ogBnumber}${remainder}`
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

module.exports = {
  isValidResponse,
  bNumberWithCheckDigit,
  zeroPadString,
  leftPad,
  removeTrailingElementsMatching,
  trimTrailingPunctuation
}
