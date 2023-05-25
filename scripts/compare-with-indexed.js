/**
 *
 * Given a bib uri, generates the ES doc using local code and then
 * fetches the same record from the remote index to perform a comparison.
 * When true is provided for active-index, the script  will query the index
 * that is updated by the DHI. Otherwise, it will go to the research-catalog-indexer
 * test index.
 *
 * Usage:
 *   node scripts/compare-with-indexed --envfile [path to .env] --uri [bnum] --activeIndex [boolean]
 */

const argv = require('minimist')(process.argv.slice(2))
const dotenv = require('dotenv')
dotenv.config({ path: argv.envfile || './config/qa.env' })

const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')
const { awsInit, die, printDiff } = require('./utils')
const { bibById } = require('../lib/platform-api/requests')
const { buildEsDocument } = require('../lib/build-es-document')
const { currentDocument } = require('../lib/elastic-search/requests')

const logger = require('../lib/logger')
logger.setLevel(process.env.LOGLEVEL || 'info')

const usage = () => {
  console.log('Usage: node scripts/compare-with-indexed --envfile [path to .env] [--uri bnum]')
  return true
}

// Ensure we're looking at the right profile and region
awsInit()

let indexName = process.env.ELASTIC_RESOURCES_INDEX_NAME
if (!argv.uri) usage() && die('Must specify event file or uri')
if (argv.activeIndex === 'true') indexName = process.env.HYBRID_ES_INDEX

const { id, type, nyplSource } = NyplSourceMapper.instance().splitIdentifier(argv.uri)

const buildLocalEsDocFromUri = async (nyplSource, id) => {
  const bib = await bibById(nyplSource, id)
  return buildEsDocument({ type: 'Bib', records: [bib] })
}

if (type === 'bib') {
  Promise.all([buildLocalEsDocFromUri(nyplSource, id), currentDocument(argv.uri, indexName)])
    .then(([[localEsRecord], liveEsRecord]) => {
      printDiff(liveEsRecord, localEsRecord, argv.verbose === 'true')
    }).catch(e => {
      logger.error(e.message)
      die()
    })
} else {
  die(`Only configured for bib uris, ${type} uri specified`)
}
