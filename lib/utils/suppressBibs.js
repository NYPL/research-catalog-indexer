const logger = require('../logger')
const { client } = require('../elastic-search/client')
const { uriForRecordIdentifier } = require('./uriForRecordIdentifier')

const suppressBib = async (bib) => {
  const bibUri = await uriForRecordIdentifier(bib.nyplSource, bib.id, 'bib')

  const elasticClient = await client()
  // Support a killswitch if something goes awry:
  if (!process.env.CIRC_DELETE === 'true') return Promise.resolve()

  logger.info(`deleting: ${bibUri}`)

  return elasticClient.delete({
    index: process.env.ELASTIC_RESOURCES_INDEX_NAME,
    type: 'resource',
    id: bibUri
  })
}

const suppressBibs = async (bibs) => {
  return bibs.map(async (bib) => {
    await suppressBib(bib)
  })
}

module.exports = {
  suppressBib,
  suppressBibs
}
