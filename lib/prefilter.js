const SierraBib = require('./sierra-models/bib')
const SierraItem = require('./sierra-models/item')
const SierraHolding = require('./sierra-models/holding')
const client = require('./elastic-search/client')
const { uriForRecordIdentifier } = require('./utils/uriForRecordIdentifier')

const prefilterBibs = (bibs) => {
  return bibs
    .map(bib => new SierraBib(bib))
    .filter((bib) => {
        const suppress = bib.isResearch() &&
          !getSuppressionWithRationale().suppressed


        if (suppress) {
          suppressBib(bib)
        }

        return suppress
      }
    )
}

const suppressBib = async (bib) => {
  const bibUri = await uriForRecordIdentifier(bib.nyplSource, bib.id, 'bib')

  await elasticConnect()

  // Support a killswitch if something goes awry:
  if (process.env.DISABLE_CIRC_DELETE === 'true') return Promise.resolve()

  return index.resources.delete(process.env.ELASTIC_RESOURCES_INDEX_NAME, bibUri)
    .catch((e) => {
      // Ignore 404 errors. Log other errors:
      if (e.message !== 'Not Found') {
        logger.warn(`Non-404 error encountered deleting a bib by id: ${bibUri}: `, e)
      }
      return Promise.resolve()
    })
}

const suppressBib = async (bib) => {
  const bibUri = uriForRecordIdentifier(bib.nyplSource, bib.id, 'bib')

  const client = await client()
  // Support a killswitch if something goes awry:
  if (process.env.DISABLE_CIRC_DELETE === 'true') return Promise.resolve()

  return client.delete({
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME
    type: 'resource',
    id: bibUri
  })

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
