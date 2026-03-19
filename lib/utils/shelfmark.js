const { stringSimilarity } = require('string-similarity-js')
const {
  countDistinctValues,
  zeroPadString
} = require('../utils')

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
exports.sortableShelfMark = (shelfMark) => {
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

const shelfmarksEquivalent = (s1, s2) => {
  const isPrefix = s1.indexOf(s2) === 0 ||
    s2.indexOf(s1) === 0
  const similarity = stringSimilarity(s1, s2)

  return s1 && s2 && (
    s1 === s2 ||
    isPrefix ||
    similarity >= 0.66
  )
}

exports.normalizedShelfmarkLookup = (shelfmarks) => {
  const counts = countDistinctValues(shelfmarks)

  const sortedCounts = Object.entries(counts)
    .map(([shelfmark, count]) => ({ shelfmark, count }))
    .sort((s1, s2) => s1.count > s2.count ? 1 : -1)

  const dominantShelfmark = sortedCounts
    .filter((s) => s.shelfmark)
    .pop()

  const coerceShelfmark = {}
  sortedCounts.forEach((s, ind) => {
    let correctedShelfmark = null
    // If no shelfmark, choose dominant shelfmark:
    if (!s.shelfmark) correctedShelfmark = dominantShelfmark ? dominantShelfmark.shelfmark : ''
    // For other shelfmarks, if the shelfmark appears equivalent to a more popular shelfmark, coerce former to be latter
    if (!correctedShelfmark) {
      const betterShelfmark = sortedCounts.slice(ind + 1).find((other) => {
        return shelfmarksEquivalent(s.shelfmark, other.shelfmark)
      })
      if (betterShelfmark) correctedShelfmark = betterShelfmark.shelfmark
    }

    if (correctedShelfmark) {
      coerceShelfmark[s.shelfmark] = correctedShelfmark
    }
  })
  return coerceShelfmark
}
