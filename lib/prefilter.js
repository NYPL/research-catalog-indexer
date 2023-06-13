const SierraBib = require('./sierra-models/bib')
const SierraItem = require('./sierra-models/item')
const SierraHolding = require('./sierra-models/holding')
const { client } = require('./elastic-search/client')
const { uriForRecordIdentifier } = require('./utils/uriForRecordIdentifier')

const filteredSierraBibsForBibs = (bibs) => {
  return bibs
    .map(bib => new SierraBib(bib))
    .filter((bib) => {
      const suppress = !bib.isResearch() ||
        bib.getSuppressionWithRationale().suppressed

      if (suppress) {
        suppressBib(bib)
      }

      return !suppress
    })
}

const suppressBib = async (bib) => {
  const bibUri = uriForRecordIdentifier(bib.nyplSource, bib.id, 'bib')

  const elasticClient = await client()
  // Support a killswitch if something goes awry:
  if (!process.env.CIRC_DELETE === 'true') return Promise.resolve()

  return elasticClient.delete({
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME,
    type: 'resource',
    id: bibUri
  })
}

const filteredSierraItemsForItems = (items) => {
  return items
    .map(item => new SierraItem(item))
    .filter(item => !item.getSuppressionWithRationale().suppressed)
}

const filteredSierraHoldingsForHoldings = (holdings) => {
  return holdings
    .map(holding => new SierraHolding(holding))
    .filter(holding => !holding.getSuppressionWithRationale().suppressed)
}

module.exports = {
  filteredSierraBibsForBibs,
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
}
