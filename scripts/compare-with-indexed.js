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
    verbose: true,
    printDocument: false
  },
  boolean: ['activeIndex', 'printDocument']
})
const dotenv = require('dotenv')
dotenv.config({ path: argv.envfile || './config/qa.env' })

const NyplSourceMapper = require('../lib/utils/nypl-source-mapper')
const {
  buildSierraModelFromUri,
  die,
  printDiff,
  setAwsProfile
} = require('./utils')
const { bibsForHoldingsOrItems } = require('../lib/platform-api/requests')
const { buildEsDocument, transformIntoBibRecords } = require('../lib/build-es-document')
const { filteredSierraBibsForBibs } = require('../lib/prefilter')
const EsBib = require('../lib/es-models/bib')
const SierraBib = require('../lib/sierra-models/bib')
const SierraHolding = require('../lib/sierra-models/holding')
const { currentDocument } = require('../lib/elastic-search/requests')
const { loadNyplCoreData } = require('../lib/load-core-data')
const { schema } = require('../lib/elastic-search/index-schema')

const logger = require('../lib/logger')
logger.setLevel(process.env.LOG_LEVEL || 'info')

const usage = () => {
  console.log('Usage: node scripts/compare-with-indexed --envfile [path to .env] [--uri bnum]')
  return true
}

let indexName = process.env.ELASTIC_RESOURCES_INDEX_NAME
if (!argv.uri) usage() && die('Must specify event file or uri')
if (argv.activeIndex) indexName = process.env.HYBRID_ES_INDEX

/**
 *  Given a uri (e.g. b123, i987, hb99887766), returns the relevant EsModel
 *  instance
 */
const buildLocalEsDocFromUri = async (uri) => {
  const record = await buildSierraModelFromUri(uri)
  if (!record) {
    process.exit()
  }

  const mapper = await NyplSourceMapper.instance()
  const { type } = mapper.splitIdentifier(uri)
  const records = await transformIntoBibRecords(type, [record])
  const { filteredBibs, removedBibs } = await filteredSierraBibsForBibs(records)
  const recordsToIndex = (await buildEsDocument(filteredBibs))
    .map((r) => r.toPlainObject(schema()))
  return { recordsToIndex, recordsToDelete: removedBibs }
}

/**
 *  Given a uri (e.g. b123, i987, hb99887766), prints detailed report on
 *  whether and why record is suppressed and is Research
 */
const suppressionReport = async (uri) => {
  const record = await buildSierraModelFromUri(uri)
  if (!record) return null

  return suppressionReportForModel(record)
}

/**
 *  Given a {SierraBib|SierraHolding|SierraItem} instance, prints detailed
 *  report on whether and why record is suppressed and is Research
 */
const suppressionReportForModel = async (record) => {
  const type = record instanceof SierraBib
    ? 'Bib'
    : (record instanceof SierraHolding ? 'Holding' : 'Item')
  if (type !== 'Bib') {
    const bibs = await bibsForHoldingsOrItems('Holding', [record])
      .map((bib) => new SierraBib(bib))
    await Promise.all(
      bibs.map((bib) => suppressionReportForModel(bib))
    )
  }
  const recordIdentifier = (record.nyplSource ? `${record.nyplSource}/` : '') + record.id
  const { suppressed, rationale: suppressionRationale } = record.getSuppressionWithRationale()
  if (suppressed) {
    console.log(`  ${type} ${recordIdentifier} is ${suppressed ? '' : 'not '}suppressed: ${suppressionRationale}`)
  }

  if (record.getIsResearchWithRationale) {
    const { isResearch, rationale: isResearchRationale } = record.getIsResearchWithRationale()
    if (!isResearch) {
      console.log(`  ${type} ${recordIdentifier} is ${isResearch ? '' : 'not '}Research: ${isResearchRationale}`)
    }
  }
}

/**
 *  Run the compare-with-indexed report over the document identified by --uri
 */
const run = async () => {
  setAwsProfile()
  await loadNyplCoreData()
  console.log(`Comparing local ES doc against the one in ${indexName}`)
  const mapper = await NyplSourceMapper.instance()
  const { type } = mapper.splitIdentifier(argv.uri)

  try {
    const { recordsToIndex, recordsToDelete } = await buildLocalEsDocFromUri(argv.uri)
    // The local ES record is the sole element in recordsToIndex
    const localEsRecord = recordsToIndex[0]

    // Get bibUri so we can look up the currently indexed document:
    let bibUri
    if (localEsRecord) {
      bibUri = localEsRecord.uri
    } else if (recordsToDelete.length) {
      bibUri = await new EsBib(recordsToDelete[0]).uri()
    }
    // Get currently indexed document:
    const liveEsRecord = !bibUri
      ? null
      : await currentDocument(bibUri, indexName)
        .catch((e) => console.log(`Could not find ${bibUri} in ${indexName} (${e})`))

    // Would indexer delete it?
    if (recordsToDelete.length) {
      console.log(`Indexer would delete bib ${bibUri} (which ${liveEsRecord ? 'exists' : 'doesn\'t exist'} in ${indexName})`)
      suppressionReport(argv.uri)
    // Would indexer ignore it?
    } else if (!recordsToIndex.length) {
      console.log(`Indexer found no bibs to index from this ${type}`)
      suppressionReport(argv.uri)
    } else {
      if (argv.printDocument) {
        console.log('Built document:\n_______________________________________________________')
        console.log(JSON.stringify(localEsRecord, null, 2))
      }

      // Show diff:
      if (liveEsRecord) {
        printDiff(liveEsRecord, localEsRecord, argv.verbose)
      } else {
        console.log(`Can't display diff because record doesn't exist in live index (${indexName})`)
      }
    }
  } catch (e) {
    console.error(`Compare-With-Indexed encountered an error: ${e.message}`)
    console.error(e.stack)
    die()
  }
}

run()
