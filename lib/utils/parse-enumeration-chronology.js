const roman = require('@sguest/roman-js')

// These named patterns govern the enumeration tags we'll look for:
const enumerationTags = {
  ano: /ano\.?/,
  anno: /anno\.?/,
  article: /art\.?/,
  br: /br\./,
  bd: /bd\.?/,
  bind: /bind/,
  box: /box\.?/,
  c: /c\./,
  część: /cz\.?/, // part
  disc: /disc\.?/,
  edition: /ed\.?/,
  erganzungslfg: /erganzungslfg\.?/,
  fascicle: /fasc\.?/,
  god: /god\./,
  heft: /heft/,
  jaarg: /jaarg\.?/,
  jahrgang: /(?:jahrg\.?)(?:ang)?/,
  kniga: /kn\./, // book
  kot: /kot\.?/,
  k: /k\./,
  lfg: /lfg\.?/,
  livre: /livre/,
  number: /nos?[.,]?|nr\./,
  part: /part\.?|pt\.?|partie\.|ptie\./,
  parl: /parl\.?/,
  plate: /plate/,
  reel: /reel|r\.?/,
  rok: /rok\./,
  t: /t\./, // part
  teil: /teil/,
  series: /series/,
  sess: /sess\.?/,
  sheet: /sheet/,
  volume: /volume|vol\.?|v\.?|evf\.?/,
  vyp: /vyp\.?/
}

const tagPatterns = Object.entries(enumerationTags).map(([name, pattern]) => {
  // Convert tag pattern to no-capture:
  pattern = new RegExp('(' + pattern.toString().slice(1, -1) + ')')

  const fullPatternString = [
    // Require initial word boundary:
    /(?<=\b)/,
    // Require specific enumeration tag:
    pattern,
    // Require something numeric (or roman numeric)
    /\s*(?<start>\d+| [ivxlcdm]+)/,
    // Optionally capture range:
    /[-|/]?(?<end>\d+| ?[ivxlcdm]+)?/
  ]
    .map((reg) => reg.toString().slice(1, -1))
    .join('')
  const fullPattern = new RegExp(fullPatternString, 'gi')

  return [name, fullPattern]
}).reduce((h, [name, pattern]) => {
  return { ...h, [name]: pattern }
}, {})

const commonEnumerationTagsLookbehind = /(?<!\br\. |\breel |\bno\. )/
tagPatterns.year = new RegExp(
  [
    /(?<=\b)/,
    commonEnumerationTagsLookbehind,
    /(?<start>(16|17|18|19|20)\d{2})/,
    /[-|/]?/,
    commonEnumerationTagsLookbehind,
    / ?(?<end>\d{2,4})?/
  ]
    .map((pattern) => pattern.toString().slice(1, -1))
    .join(''),
  'gi'
)
tagPatterns._plainNumber = /^(?<start>\d{1,3})(?:\b|$|(?:-)(?<end>\d{1,3}))/gi

/**
 *  Given a string, if the string appears to comprise a Roman numeral, returns the decimal equivalent (as a string)
 * */
const convertRoman = (val) => {
  if (!/^[ivxlcdm]+$/i.test(val)) return val

  return '' + roman.parseRoman(val)
}

/**
 *  Given a string, returns an array of parsed enumeration tags.
 *
 *  @example
 *    parseEnumerationTags('v. 1, no.3, pt. v, 1966')
 *      => [
 *        { type: 'number', raw: 'no.3', start: '    3' },
 *        { type: 'part', raw: 'pt. v', start: '    5' },
 *        { type: 'volume', raw: 'v. 1', start: '    1' },
 *        { type: 'year', raw: '1966', start: ' 1966' }
 *      ]
 **/
const parseEnumerationTags = (fieldTagV) => {
  const types = []
  if (!fieldTagV) return types

  if (Array.isArray(fieldTagV)) fieldTagV = fieldTagV[0]

  for (const type of Object.keys(tagPatterns)) {
    const ranges = parseNamedEnumerationTags(type, fieldTagV)

    if (ranges) {
      types.push(ranges)
    }
  }
  return types.flat(1)
}

/**
 *  Given a type of enumeration tag (e.g. number, volume, year, part) and a string
 *  returns either null or an array of plainobjects that define:
 *   - type {string}: The type of tag (e.g. number, volume)
 *   - raw {string}: The original, literal value found, including the tag (e.g. "v. 1", "no. iv")
 *   - start {string}: A left-padded sortable string with the extracted start value (e.g. "    5", "    4")
 *   - end {string}: A left-padded sortable string with the extracted end value, if found
 *
 *   @example
 *     parseNamedEnumerationTags("number", "no. 1, no. ii-v")
 *       => [
 *         { type: 'number', raw: 'no. 1', start: '    1' },
 *         { type: 'number', raw: 'no. ii-v', start: '    2', end: '    5' }
 *       ]
 * **/
const parseNamedEnumerationTags = (type, s) => {
  const pattern = tagPatterns[type]
  const matches = [...s.matchAll(pattern)]
  const ranges = matches.map((match) => {
    const range = { type, raw: match[0] }
    if (match?.groups?.start) {
      let start = match.groups.start.trim()
      start = convertRoman(start)
      start = start.padStart(5, ' ')
      range.start = start
    }
    if (match?.groups?.end) {
      let end = match.groups.end.trim()
      end = convertRoman(end)
      end = end.padStart(5, ' ')
      range.end = end
    }
    return range
  })

  return ranges.length === 0 ? null : ranges
}

/**
 *  Given a string, removes apparent volume tags from string (such as found on item shelfmarks)
 * **/
const removeVolumeTags = (val) => {
  Object.values(tagPatterns).forEach((pattern) => {
    const index = val.search(pattern)
    if (index >= 0) { val = val.substring(0, index) }
  })
  return val
}

module.exports = {
  parseNamedEnumerationTags,
  parseEnumerationTags,
  removeVolumeTags
}
