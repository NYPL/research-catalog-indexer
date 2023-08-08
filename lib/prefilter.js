const SierraBib = require('./sierra-models/bib')
const SierraItem = require('./sierra-models/item')
const SierraHolding = require('./sierra-models/holding')
const logger = require('./logger')

const filteredSierraBibsForBibs = (bibs) => {
  const removedBibs = []
  const filteredBibs = bibs
    .map(bib => new SierraBib(bib))
    // Remove bibs that should be suppressed:
    .filter((bib) => {
      let suppressed = false

      // If bib is not Research, suppress it:
      let { isResearch, rationale } = bib.getIsResearchWithRationale()
      if (!isResearch) {
        rationale = `is not Research (${rationale})`
        suppressed = true
      } else {
        // Is Research. Do suppression check:
        ; ({ suppressed, rationale } = bib.getSuppressionWithRationale())
      }

      // If suppressing the bib, log about it and add it to the removedBibs array:
      if (suppressed) {
        logger.debug(`Suppressing ${bib.id} because ${rationale})`)
        removedBibs.push(bib)
      }

      return !suppressed
    })

  return { filteredBibs, removedBibs }
}

const filteredSierraItemsForItems = (items) => {
  return items && items
    .map(item => new SierraItem(item))
    .filter((item) => !item.getSuppressionWithRationale().suppressed)
    .filter((item) => item.isResearch())
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
