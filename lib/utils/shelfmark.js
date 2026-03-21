const { stringSimilarity } = require('string-similarity-js')
const {
  countDistinctValues,
  zeroPadString
} = require('../utils')
const { removeVolumeTags } = require('../utils/parse-enumeration-chronology')

/**
 * Get a sortable shelfmark value by collapsing whitespace and zero-padding
 * anything that looks like a box, volume, or tube number, identified as:
 *  - any number terminating the string, or
 *  - any number following known prefixes (e.g. box, tube, v., etc).
 *
 * If number is identified by prefix (e.g. box, tube), prefix will be made
 * lowercase.
 *
 * @return {string} A sortable version of the given shelfmark
 *
 * e.g.:
 *  "*T-Mss 1991-010   Box 27" ==> "*T-Mss 1991-010 box 000027"
 *  "*T-Mss 1991-010   Tube 70" ==> "*T-Mss 1991-010 tube 000070"
 *  "Map Div. 98­914    Box 25, Wi­Z')" ==> "Map Div. 98­914 box 000025, Wi­Z')"
 *
 * In addition to padding terminating numbers, any number following one of
 * these sequences anywhere in the string, case-insensitive, is padded:
 *  - box
 *  - tube
 *  - v.
 *  - no.
 *  - r.
 */
const sortableShelfMark = (shelfMark) => {
  // NodeJS doesn't have lookbehinds, so fake it with replace callback:
  const reg = /(\d+$|((^|\s)(box|v\.|no\.|r\.|box|tube) )(\d+))/i
  // This callback will receive all matches:
  const replace = (m0, fullMatch, label, labelWhitespace, labelText, number) => {
    // If we matched a label, build string from label and then pad number
    return label
      ? `${label.toLowerCase()}${zeroPadString(number)}`
      // Otherwise just pad whole match (presumably it's a line terminating num):
      : zeroPadString(fullMatch)
  }
  return shelfMark
    .replace(reg, replace)
    // Collapse redundant whitespace:
    .replace(/\s{2,}/g, ' ')
}

/**
 *  Given two shelfMark strings, returns true if
 *   - either of them are prefixes of the other
 *   - their string similarity is greater than 2/3
 */
const shelfMarksEquivalent = (s1, s2) => {
  const isPrefix = s1.indexOf(s2) === 0 ||
    s2.indexOf(s1) === 0
  const similarity = stringSimilarity(s1, s2)

  return s1 && s2 && (
    s1 === s2 ||
    isPrefix ||
    similarity >= 0.66
  )
}

/**
 *  Given a shelfmark value such as returned by EsItem.shelfMark(), returns a
 *  string representation optimal for comparing with other shelfmarks
 *
 *   - lowercases
 *   - removes extraneous prefixes & suffixes
 *   - removes known volume / chronology tags
 */
const cleanShelfMark = (shelfMark) => {
  if (Array.isArray(shelfMark)) shelfMark = shelfMark[0]
  if (!shelfMark) return null

  let normalized = shelfMark
    .toLowerCase()
    .replace(/\|z/, '')
    .replace(/\[|\(.*/, '')
    .replace(/(library has).*/, '')

  normalized = removeVolumeTags(normalized).trim()
  return normalized
}

/**
 *  Given an array of shelfMark values, attempts to correct typos and small
 *  style differences by analyzing the precedence of values and checking string
 *  similarity.
 *
 *  Returns a lookup table that relates each distinct value to a corrected
 *  value (which may be itself).
 *
 *  @example
 *    normalizedShelfMarkLookup(['jfe 123', 'abc 456', '[jfe 123]'])
 *      => {
 *        'jfe 123': 'jfe 123',
 *        'abc 456': 'abc 456',
 *        '[jfe 123]': 'jfe 123'
 *        }
 */
const normalizedShelfMarkLookup = (shelfmarks) => {
  const counts = countDistinctValues(shelfmarks)

  const sortedCounts = Object.entries(counts)
    .map(([shelfMark, count]) => ({ shelfMark, count }))
    .sort((s1, s2) => s1.count > s2.count ? 1 : -1)

  return sortedCounts
    .map((shelfMark) => shelfMark.shelfMark)
    .reduce((h, originalShelfMark, ind) => {
      const betterShelfMark = sortedCounts.slice(ind + 1).find((other) => {
        return shelfMarksEquivalent(originalShelfMark, other.shelfMark)
      })
      return { [originalShelfMark]: betterShelfMark?.shelfMark || originalShelfMark, ...h }
    }, {})
}

module.exports = {
  cleanShelfMark,
  normalizedShelfMarkLookup,
  sortableShelfMark,
  _private: {
    shelfMarksEquivalent
  }
}
