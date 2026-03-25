/**
 *
 * Print a report showing the applied sort for the given bnum. Useful for
 * understanding an odd item sort as it shows the normalized shelfmark used
 * for intitial grouping and the extracted tags.
 *
 * Usage:
 *   node scripts/item-sort-report.js --envfile [path to .env] --uri [bnum]
 *
 * Example
 *
 *   node scripts/item-sort-report.js --envfile config/production.env --uri b10011753
 *
 *   URI         | Shelfmark (normalized)   | Enumeration Chronology                           | Tags
 *   i12540559   | jlm 81-299               | Mar. 1973-June 1975 inc.                         | year: 1973; year: 1975
 *   i12540560   | jlm 81-299               | July 1975-Mar. 1976                              | year: 1975; year: 1976
 *   i12540561   | jlm 81-299               | Apr.-Aug.(1976)                                  | year: 1976
 *   i12540562   | jlm 81-299               | Nov. 1976-Feb. 1977                              | year: 1976; year: 1977
 *   i12540563   | jlm 81-299               | Mar. 1977-Oct. 1977                              | year: 1977; year: 1977
 *   i12540564   | jlm 81-299               | Parl. 30, Sess. 3, no. 1-19 (1977-1978)          | number: 1-19; parl: 30; sess: 3; year: 1977-1978
 *   i12540565   | jlm 81-299               | Parl. 30, Sess 3, no. 20-36 (1977-1978)          | number: 20-36; parl: 30; sess: 3; year: 1977-1978
 *   i12540566   | jlm 81-299               | Parl. 30, Sess. 4, no. 1-12 inc. (1978-1979)     | number: 1-12; parl: 30; sess: 4; year: 1978-1979
 *   i12540567   | jlm 81-299               | parl. 32, sess. 1-12 (1980)                      | parl: 32; sess: 1-12; year: 1980
 *   ...
 **/
const argv = require('minimist')(process.argv.slice(2), {
  default: {
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
