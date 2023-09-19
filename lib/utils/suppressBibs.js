const logger = require('../logger')
const { client } = require('../elastic-search/client')
const { uriForRecordIdentifier } = require('./uriForRecordIdentifier')

const suppressBib = async (bib) => {
  const bibUri = await uriForRecordIdentifier(bib.nyplSource, bib.id, 'bib')

  const elasticClient = await client()

  logger.debug(`Deleting: ${bibUri}`)

  const opts = {
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME,
    type: 'resource',
    id: bibUri
  }
  return elasticClient.delete(opts)
    .catch((e) => {
      // Swallow 404s:
      if (e.statusCode === 404) return null
      throw e
    })
}

const suppressBibs = async (bibs) => {
  // Support a killswitch if something goes awry:
  if (process.env.DISABLE_CIRC_DELETE === 'true') {
    logger.info(`Skipping deletes because DISABLE_CIRC_DELETE=${process.env.DISABLE_CIRC_DELETE}`)
    return Promise.resolve()
  }
  return Promise.all(
    bibs.map(suppressBib)
  )
}

module.exports = {
  suppressBib,
  suppressBibs
}
