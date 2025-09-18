const accessMessagesRaw = require('@nypl/nypl-core-objects')('by-accessMessages')
const sierraLocationsRaw = require('@nypl/nypl-core-objects')('by-sierra-location')
const organizationsRaw = require('@nypl/nypl-core-objects')('by-organizations')
const catalogItemTypesRaw = require('@nypl/nypl-core-objects')('by-catalog-item-type')
const formatsRaw = require('@nypl/nypl-core-objects')('by-formats')
const collectionsRaw = require('@nypl/nypl-core-objects')('by-collection')
const statusesRaw = require('@nypl/nypl-core-objects')('by-statuses')

async function resolveVocabulary (vocab) {
  return vocab instanceof Promise ? await vocab : vocab
}

// Cached resolved data
let cached = null

// Load and cache all nypl-core-objects vocabularies/mappings
async function loadNyplCoreData () {
  if (!cached) {
    const [
      accessMessageMapping,
      sierraLocationMapping,
      organizationMapping,
      catalogItemTypeMapping,
      formatMapping,
      collectionMapping,
      statusMapping
    ] = await Promise.all([
      resolveVocabulary(accessMessagesRaw),
      resolveVocabulary(sierraLocationsRaw),
      resolveVocabulary(organizationsRaw),
      resolveVocabulary(catalogItemTypesRaw),
      resolveVocabulary(formatsRaw),
      resolveVocabulary(collectionsRaw),
      resolveVocabulary(statusesRaw)
    ])

    cached = {
      accessMessageMapping,
      sierraLocationMapping,
      organizationMapping,
      catalogItemTypeMapping,
      formatMapping,
      collectionMapping,
      statusMapping
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
  statusMapping: () => cached?.statusMapping || {}
}
