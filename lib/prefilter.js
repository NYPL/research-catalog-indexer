const SierraBib = require('./sierra-models/bib')
const SierraItem = require('./sierra-models/item')
const SierraHolding = require('./sierra-models/holding')
const logger = require('./logger')

const filteredSierraBibsForBibs = (bibs) => {
  const bibsToDelete = []
  const filteredBibs = bibs
    .map(bib => new SierraBib(bib))
    // Remove bibs that should be suppressed:
    .filter((bib) => {
      let suppress = false

      // If bib is not Research, suppress it:
      let { isResearch, rationale } = bib.getIsResearchWithRationale()
      if (!isResearch) {
        rationale = `is not Research (${rationale})`
        suppress = true
      } else {
        // Is Research. Do suppression check:
        ; ({ suppress, rationale } = bib.getSuppressionWithRationale())
      }

      // If suppressing the bib, log about it and add it to the bibsToDelete array:
      if (suppress) {
        logger.debug(`Suppressing ${bib.id} because ${rationale})`)
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
