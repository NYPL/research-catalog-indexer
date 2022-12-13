const axios = require('axios')

class NyplSourceMapper {
  async nyplSourceMapping () {
    if (!this.nyplSourceMap) {
      const resp = await axios.get(`https://raw.githubusercontent.com/NYPL/nypl-core/${process.env.NYPL_CORE_VERSION || 'master'}/mappings/recap-discovery/nypl-source-mapping.json`)
      const mappingData = resp.data
      this.nyplSourceMap = mappingData
      console.log('mapping Data: ', JSON.stringify(mappingData, null, 2))
    }
    return this.nyplSourceMap
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
  async splitIdentifier (prefixedIdentifier) {
    if (!/^[a-z]+/.test(prefixedIdentifier)) return null

    const nyplSourceMapping = await this.nyplSourceMapping()
    const prefix = prefixedIdentifier.match(/^[a-z]+/)[0]
    const mapping = await Object.keys(nyplSourceMapping)
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

  async prefix (source) {
    const nyplSourceMapping = await this.nyplSourceMapping()
    return nyplSourceMapping[source].bibPrefix
  }
}

module.exports = NyplSourceMapper
