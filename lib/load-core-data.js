const accessMessagesRaw = require('@nypl/nypl-core-objects')('by-accessMessages')
const sierraLocationsRaw = require('@nypl/nypl-core-objects')('by-sierra-location')
const organizationsRaw = require('@nypl/nypl-core-objects')('by-organizations')
const catalogItemTypesRaw = require('@nypl/nypl-core-objects')('by-catalog-item-type')
const relatorsRaw = require('@nypl/nypl-core-objects')('by-relators')
const formatsRaw = require('@nypl/nypl-core-objects')('by-formats')
const collectionsRaw = require('@nypl/nypl-core-objects')('by-collection')
const statusesRaw = require('@nypl/nypl-core-objects')('by-statuses')
const NyplSourceMapper = require('./utils/nypl-source-mapper')
const logger = require('./logger')

async function resolveVocabulary (vocab) {
  return vocab instanceof Promise ? await vocab : vocab
}

// Cached resolved data
let cached = null

// Load and cache all nypl-core-objects vocabularies/mappings
async function loadNyplCoreData () {
  if (!cached) {
    logger.info(`loadNyplCoreData: loading data from NYPL-core ${process.env.NYPL_CORE_VERSION || 'master'}`)
    const [
      accessMessageMapping,
      sierraLocationMapping,
      organizationMapping,
      catalogItemTypeMapping,
      formatMapping,
      collectionMapping,
      statusMapping,
      relatorsMapping
    ] = await Promise.all([
      resolveVocabulary(accessMessagesRaw),
      resolveVocabulary(sierraLocationsRaw),
      resolveVocabulary(organizationsRaw),
      resolveVocabulary(catalogItemTypesRaw),
      resolveVocabulary(formatsRaw),
      resolveVocabulary(collectionsRaw),
      resolveVocabulary(statusesRaw),
      resolveVocabulary(relatorsRaw),
      NyplSourceMapper.loadInstance()
    ])

    cached = {
      accessMessageMapping,
      sierraLocationMapping,
      organizationMapping,
      catalogItemTypeMapping,
      formatMapping,
      collectionMapping,
      statusMapping,
      relatorsMapping
    }
  }

  return cached
}

module.exports = {
  loadNyplCoreData,
  accessMessageMapping: () => cached?.accessMessageMapping || {},
  sierraLocationMapping: () => cached?.sierraLocationMapping || {},
  organizationMapping: () => cached?.organizationMapping || {},
  catalogItemTypeMapping: () => cached?.catalogItemTypeMapping || {},
  formatMapping: () => cached?.formatMapping || {},
  collectionMapping: () => cached?.collectionMapping || {},
  statusMapping: () => cached?.statusMapping || {},
  nyplSourceMapping: () => cached?.nyplSourceMapping || {}
}
