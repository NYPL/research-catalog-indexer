/**
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
const { filteredSierraBibsForBibs } = require('../lib/prefilter')
const { buildEsDocument, transformIntoBibRecords } = require('../lib/build-es-document')

dotenv.config({ path: argv.envfile || './config/qa.env' })

const NyplSourceMapper = require('../lib/utils/nypl-source-mapper')
const {
  buildSierraModelFromUri,
  die,
  setAwsProfile
} = require('./utils')
const { loadNyplCoreData } = require('../lib/load-core-data')

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
  const { filteredBibs } = await filteredSierraBibsForBibs(records)

  if (!filteredBibs.length) {
    die('No bibs found to index')
  }
  const recordsToIndex = (await buildEsDocument(filteredBibs))
  if (!recordsToIndex) {
    die('Indexer would suppress record')
  }
  return { recordsToIndex }
}

/**
 *  Run the compare-with-indexed report over the document identified by --uri
 */
const run = async () => {
  setAwsProfile()
  await loadNyplCoreData()

  const { recordsToIndex } = await buildLocalEsDocFromUri(argv.uri)
  const bib = recordsToIndex[0]
  const items = await bib.items()

  const data = [[
    'URI',
    'Shelfmark (normalized)',
    'Enumeration Chronology',
    'Tags'
  ]]
  items.forEach((item) => {
    data.push([
      item.uri(),
      item._shelfMarkNormalized(),
      item.enumerationChronology()[0],
      item._taggedEnumerations().map(({ type, start, end }) => `${type}: ${start.trim()}${end ? `-${end.trim()}` : ''}`).join('; ')
    ])
  })
  const columnWidths = data[0].map((_, ind) => {
    return data.reduce((max, row) => Math.max(max, (row[ind] || '').length), 0) + 2
  })
  const rows = data.map((row) => {
    return row.map((val, ind) => ('' + val).padEnd(columnWidths[ind], ' ')).join(' | ')
  })
  console.info(rows.join('\n'))
}

run()
