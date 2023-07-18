/**
 *
 * Given a bib uri, generates the ES doc using local code and then
 * fetches the same record from the remote index to perform a comparison.
 * When true is provided for active-index, the script  will query the index
 * that is updated by the DHI (provided in the config file as HYBRID_ES_INDEX).
 * Otherwise, it will compare against the research-catalog-indexer test index.
 * If --verbose is true, the diff will show the differing values from each record,
 * instead of reporting only that there is a diff.
 *
 * Usage:
 *   node scripts/compare-with-indexed --envfile [path to .env] --uri [bnum] --activeIndex [boolean] --verbose [boolean]
 */

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    verbose: false
  }
})
const dotenv = require('dotenv')
dotenv.config({ path: argv.envfile || './config/qa.env' })

const NyplSourceMapper = require('../lib/utils/nypl-source-mapper')
const { awsInit, die, printDiff } = require('./utils')
const { bibById } = require('../lib/platform-api/requests')
const { buildEsDocument } = require('../lib/build-es-document')
const { currentDocument } = require('../lib/elastic-search/requests')

const logger = require('../lib/logger')
logger.setLevel(process.env.LOG_LEVEL || 'info')

const usage = () => {
  console.log('Usage: node scripts/compare-with-indexed --envfile [path to .env] [--uri bnum]')
  return true
}

// Ensure we're looking at the right profile and region
awsInit()

let indexName = process.env.ELASTIC_RESOURCES_INDEX_NAME
if (!argv.uri) usage() && die('Must specify event file or uri')
if (argv.activeIndex === 'true') indexName = process.env.HYBRID_ES_INDEX

const { id, type, nyplSource } = (new NyplSourceMapper()).splitIdentifier(argv.uri)

const buildLocalEsDocFromUri = async (nyplSource, id) => {
  const bib = await bibById(nyplSource, id)
  return buildEsDocument({ type: 'Bib', records: [bib] })
}

if (type === 'bib') {
  Promise.all([buildLocalEsDocFromUri(nyplSource, id), currentDocument(argv.uri, indexName)])
    .then(([{ recordsToIndex, recordsToDelete }, liveEsRecord]) => {
      if (recordsToDelete.length) {
        console.log('Indexer would delete this bib', recordsToDelete)
      } else {
        // The local ES record is the sole element in recordsToIndex
        const localEsRecord = recordsToIndex[0]
        printDiff(liveEsRecord, localEsRecord, argv.verbose)
      }
    }).catch(e => {
      console.error(`Compare-With-Indexed encountered an error: ${e.message}`)
      console.error(e.stack)
      die()
    })
} else {
  die(`Only configured for bib uris, ${type} uri specified`)
}
