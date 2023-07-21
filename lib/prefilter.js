const SierraBib = require('./sierra-models/bib')
const SierraItem = require('./sierra-models/item')
const SierraHolding = require('./sierra-models/holding')
const logger = require('./logger')

const filteredSierraBibsForBibs = (bibs) => {
  const bibsToDelete = []
  const filteredBibs = bibs
    .map(bib => new SierraBib(bib))
    .filter((bib) => {
      const { suppress, rationale } = !bib.isResearch() ||
        bib.getSuppressionWithRationale()

      if (suppress) {
        logger.debug(`Suppressing ${bib.id} because ${rationale}`)
        bibsToDelete.push(bib)
      }

      return !suppress
    })

  return { filteredBibs, bibsToDelete }
}

const filteredSierraItemsForItems = (items) => {
  return items && items
    .map(item => new SierraItem(item))
    .filter(item => !item.getSuppressionWithRationale().suppressed)
}

const filteredSierraHoldingsForHoldings = (holdings) => {
  return holdings && holdings
    .map(holding => new SierraHolding(holding))
    .filter(holding => !holding.getSuppressionWithRationale().suppressed)
}

module.exports = {
  filteredSierraBibsForBibs,
  filteredSierraItemsForItems,
  filteredSierraHoldingsForHoldings
}
