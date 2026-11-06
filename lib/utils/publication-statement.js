// Label chart for 260/264 publication statement fields, keyed by
// marcTag -> ind1 -> ind2. Blank indicators are represented by '#'.
// See: https://www.loc.gov/marc/bibliographic/bd264.html
const labelChart = {
  260: {
    '#': { '#': 'Imprint' },
    2: { '#': 'Earlier publisher' },
    3: { '#': 'Current publisher' }
  },
  264: {
    '#': {
      0: 'Production',
      1: 'Publisher',
      2: 'Distributor',
      3: 'Manufacturer',
      4: 'Copyright date'
    },
    2: {
      1: 'Earlier publisher',
      2: 'Earlier distributor',
      3: 'Earlier manufacturer',
      4: 'Earlier copyright'
    },
    3: {
      1: 'Latest publisher',
      2: 'Latest distributor',
      3: 'Latest manufacturer',
      4: 'Latest copyright'
    }
  }
}

// Fallback label to use when ind1/ind2 can't be determined (e.g. for
// orphaned/880 parallel data, which typically lacks its own indicators):
const defaultLabelByTag = {
  260: 'Imprint',
  264: 'Publisher'
}

/**
 *  Given a marc tag and (optionally) ind1/ind2, returns the appropriate
 *  publicationStatement label. Falls back to a tag-level default when
 *  ind1/ind2 are missing or don't match a known combination.
 */
const getPublicationStatementLabel = (marcTag, ind1, ind2) => {
  const normalize = (ind) => {
    const trimmed = typeof ind === 'string' ? ind.trim() : ind
    return trimmed || trimmed === 0 ? String(trimmed) : '#'
  }

  const label = labelChart[marcTag]?.[normalize(ind1)]?.[normalize(ind2)]
  return label || defaultLabelByTag[marcTag] || null
}

/**
 *  Given a subfield value (or array of values), strips trailing connecting
 *  punctuation (';', ':', ',') and whitespace to produce the key expected in
 *  publicationStatement's filterToSubstring map.
 *
 *  E.g. "Melbourne [Australia] :" => "Melbourne [Australia]"
 */
const trimFilterKeyPunctuation = (value) => {
  if (Array.isArray(value)) return value.map(trimFilterKeyPunctuation)
  if (typeof value !== 'string') return value
  return value.replace(/\s*[;:,]\s*$/, '').trim()
}

module.exports = {
  getPublicationStatementLabel,
  trimFilterKeyPunctuation
}
