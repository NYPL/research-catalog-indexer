const fold = require('accent-fold')
/**
 * Given a string, applies several transformations to make it suitable for title_sort:
 * - Replace / and - with a space (See Sec. 3.2 above) √
 * - Apply basic char folding so that accented characters are ordered where we’d expect (and not stripped by following rule)
 * - Strip anything matching /[^\w\s]/ (non characters/numbers/whitespace) from the whole string √
 * - Replace multiple contiguous whitespace characters with a single character. √
 * - Strip leading whitespace √
 * - Lowercase it √
 * - Substring to 80 characters
 */
exports.titleSortTransform = function (string) {
  return fold(string)
    .replace(/[/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^\w\s]+/g, '')
    .toLowerCase()
    .substring(0, 80)
}
