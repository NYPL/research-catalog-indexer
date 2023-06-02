const SierraBib = require('./sierra-models/bib')
const SierraItem = require('./sierra-models/item')
const SierraHolding = require('./sierra-models/holding')

const prefilterBibs = (bibs) => {
  return bibs
    .map(bib => new SierraBib(bib))
    .filter(bib => !getSuppressionWithRationale().suppressed)
}

const prefilterItems = (items) => {
  return items
    .map(item => new SierraItem(item))
    .filter(item => !getSuppressionWithRationale().suppressed)
}

const prefilterHoldings = (holdings) => {
  return holdings
    .map(holding => new SierraHolding(holding))
    .filter(holding => !getSuppressionWithRationale().suppressed)
}


module.exports = {
  prefilterBibs,
  prefilterItems,
  prefilterHoldings
}
