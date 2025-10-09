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
        logger.debug(`Suppressing bib ${bib.nyplSource}/${bib.id} because ${rationale})`)
        removedBibs.push(bib)
      }

      return !suppressed
    })

  return { filteredBibs, removedBibs }
}

/**
 *  Given an array of plainobjects representing items,
 *  returns an array of SierraItems after removing items that are suppressed
 *  or non-Research
 */
const filteredSierraItemsForItems = (items) => {
  if (!items) return []

  items = items
    .map(item => new SierraItem(item))
  const originalCount = items.length

  items = items
    .filter((item) => !item.getSuppressionWithRationale().suppressed)
  const suppressedCount = originalCount - items.length

  items = items
    .filter((item) => item.isResearch())
  const circCount = originalCount - suppressedCount - items.length

  logger.debug(`From original ${originalCount} item(s), removed ${suppressedCount} suppressed, ${circCount} non-reseearch, resulting in ${items.length} item(s)`)

  return items
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
