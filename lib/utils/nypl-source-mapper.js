const logger = require('../logger')
class NyplSourceMapper {
  constructor (mapping) {
    this.nyplSourceMap = mapping
  }

  /**
   *  Given a discovery identifier (aka "uri"),
   *  e.g. "b12082323", "i123456", "pb98766", "ci2342343"
   *
   *  Returns a hash with:
   *   - `nyplSource`: System/institution identifier. One of sierra-nypl,
   *                   recap-pul, recap-cul, recap-hl
   *   - `type`: Record type. One of bib, item, holding
   *   - `id`: The non-prefixed identifier, e.g. "12082323"
   */
  splitIdentifier (prefixedIdentifier) {
    if (!/^[a-z]+/.test(prefixedIdentifier)) return null

    const nyplSourceMapping = this.nyplSourceMap
    const prefix = prefixedIdentifier.match(/^[a-z]{1,2}/)[0]
    const mapping = Object.keys(nyplSourceMapping)
      .map((nyplSource) => Object.assign({}, { nyplSource }, nyplSourceMapping[nyplSource]))
      .find((properties) => {
        return [properties.bibPrefix, properties.itemPrefix, properties.holdingPrefix].includes(prefix)
      })
    // Because this method tends to be be called with destructuring, return {}
    // if prefixedIdentifier is not recognized
    if (!mapping) return {}

    const type = mapping.bibPrefix === prefix
      ? 'bib'
      : mapping.holdingPrefix === prefix
        ? 'holding'
        : 'item'

    return {
      nyplSource: mapping.nyplSource,
      type,
      id: prefixedIdentifier.replace(prefix, '')
    }
  }

  /** Given an nypl source (such as sierra-nypl or recap-pul) returns the matching prefix
   */
  prefix (source, type = 'bib') {
    const nyplSourceMapping = this.nyplSourceMap
    if (!nyplSourceMapping[source]) return ''
    return nyplSourceMapping[source][`${type}Prefix`]
  }
}

/**
* Create a NyplSourceMapper instance
*/
const createInstance = async () => {
  const sourceMappingUrl = `https://raw.githubusercontent.com/NYPL/nypl-core/${process.env.NYPL_CORE_VERSION || 'master'}/mappings/recap-discovery/nypl-source-mapping.json`

  let resp
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Retrieve json file:
      resp = await fetch(sourceMappingUrl)
      // Assert 2xx status:
      if (resp?.ok) break
      throw new Error(`got status ${resp?.status}`)
    } catch (err) {
      if (attempt === 1) {
        logger.warn(`First fetch attempt failed for ${sourceMappingUrl} (${err.message}). Retrying...`)
      } else {
        const msg = resp && !resp.ok
          ? `Error retrieving ${sourceMappingUrl} - got status ${resp.status}`
          : `Error retrieving ${sourceMappingUrl}: ${err.message}`
        throw new Error(msg)
      }
    }
  }

  // Parse JSON:
  const data = await resp.json()
    .catch((e) => {
      throw new Error(`Error parsing ${sourceMappingUrl}: ${e}`)
    })

  // Check for invalid data structure:
  if (!data || !data['sierra-nypl']) {
    throw new Error(`Error parsing data at ${sourceMappingUrl}`)
  }

  return new NyplSourceMapper(data)
}

let sourceMapperInstance = null

/**
* Get singleton NyplSourceMapper instance
*/
NyplSourceMapper.loadInstance = async () => {
  logger.info('Loading nypl source mapping')
  sourceMapperInstance = await createInstance()
}

NyplSourceMapper.instance = () => sourceMapperInstance

// only for testing
NyplSourceMapper.__resetInstance = () => {
  sourceMapperInstance = null
}

module.exports = NyplSourceMapper
