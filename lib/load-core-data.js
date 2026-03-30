const nyplCoreObjects = require('@nypl/nypl-core-objects')
const NyplSourceMapper = require('./utils/nypl-source-mapper')
const logger = require('./logger')

// Register the vocabularies we want to be made available:
const vocabs = {
  accessMessageMapping: 'by-accessMessages',
  catalogItemTypeMapping: 'by-catalog-item-type',
  checkinCardStatusMapping: 'by-checkin-card-statuses',
  collectionMapping: 'by-collection',
  formatMapping: 'by-formats',
  organizationMapping: 'organizations',
  sierraLocationMapping: 'by-sierra-location',
  statusMapping: 'by-statuses'
}

// Cached mappings:
let cached = null

// Load and cache all nypl-core-objects vocabularies/mappings
async function loadNyplCoreData () {
  if (!cached) {
    logger.info(`loadNyplCoreData: loading data from NYPL-core ${process.env.NYPL_CORE_VERSION || 'master'}`)

    // Load all registered vocabularies:
    const pairs = await Promise.all(
      Object.entries(vocabs).map(async ([exportName, nyplCoreObjectsString]) => {
        const mapping = await nyplCoreObjects(nyplCoreObjectsString)
        return { [exportName]: mapping }
      })
    )
    // Assemble fetched vocabularies into a lookup:
    cached = pairs.reduce((h, o) => ({ ...h, ...o }), {})

    // Pre-load source-mapper while we're at it:
    await NyplSourceMapper.loadInstance()
  }
  return cached
}

// Export all cached vocabs:
const vocabExports = Object.keys(vocabs)
  .reduce((h, key) => ({ ...h, [key]: () => cached[key] }), {})

module.exports = {
  loadNyplCoreData,
  nyplSourceMapping: () => cached?.nyplSourceMapping || {},
  ...vocabExports,
  _private: {
    setCached: (c) => {
      cached = c
    }
  }
}
