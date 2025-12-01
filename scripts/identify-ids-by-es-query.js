/**
 *
 * Given a ES query, identfies matching records and writes them to a local csv
 *
 * Options:
 *  --query QUERY - Provide ES query as a quoted JSON blob
 *  --queryfile FILE - Provide a file path to a json file with the query. Should be relative to the script and in quotes.
 *  e.g. `--queryfile '../query.json'` in case you are in the main `discovery-hybrid-indexer` directory
 *  --outfile FILE - Specify where to write the CSV (default ./out.csv)
 *  --from N - Specify index to start collecting from. Default 0
 *  --size M - Specify records per page. Default 100
 *  --stripprefix (true|false) - Specify whether or not to strip prefix from
 *                identifier before writing to CSV (e.g. hb12345 > 12345).
 *                Default false
 *  --envfile - Specify config file to use. Default ./config/qa.env
 *
 * Note that only one of --query and --queryfile should be used.
 *
 * Note that when using with `--stripprefix true`, because the output will not
 * include nyplSource, queries should ideally restrict their scope to one
 * nyplSource value (see example usage below):
 *
 * Usage:
 *   node scripts/identify-ids-by-es-query --envfile [path to .env] [--outfile out.csv] --query '{"query": {
 *      "bool": {
 *          "must": [
 *              {
 *                  "regexp": {
 *                      "idIsbn": ".*[^0-9x].*"
 *                  }
 *              },
 *              {
 *                  "term": {
 *                      "nyplSource": "sierra-nypl"
 *                  }
 *              }
 *          ]
 *      }
 *  }}'
 *
 */

const dotenv = require('dotenv')
const { parseArgs } = require('node:util')
const fs = require('fs')

const { query: esQuery, scroll: esScroll } = require('../lib/elastic-search/requests')
const {
  castArgsToInts,
  die,
  setAwsProfile
} = require('./utils')

/**
* Parse script arguments from process.argv:
**/
const parseArguments = () => {
  const argv = parseArgs({
    options: {
      envfile: {
        type: 'string',
        default: './config/qa.env'
      },
      from: {
        type: 'string',
        default: '0'
      },
      innerProperty: {
        type: 'string'
      },
      outfile: {
        type: 'string',
        default: './out.csv'
      },
      limit: { type: 'string' },
      query: { type: 'string' },
      size: {
        type: 'string',
        default: '100'
      },
      stripprefix: {
        type: 'boolean',
        default: false
      }
    }
  })

  castArgsToInts(argv, ['limit'])

  return argv.values
}

const usage = () => {
  console.log('Usage: node scripts/reindex-by-query --envfile [path to .env] --query QUERY')
  return true
}

/**
 * Recursive step. Given a raw search result, calls `scroll` until all records
 * consumed.
 *
 * @returns {Promise<String[]>} Promise that resolves an array of matching ids.
 */
const parseResultAndScroll = (result, options, records = []) => {
  // For V7 client:
  result = result.body

  let ids = result.hits.hits.map((h) => h._id)
  if (options.stripprefix) ids = ids.map((id) => id.replace(/^[a-z]+/, ''))

  if (options.innerProperty) {
    const extras = result.hits.hits
      .map((h) => {
        const nestedName = options.innerProperty.split('.')[0]
        return h.inner_hits[nestedName].hits.hits
          .map((_h) => _h.fields[options.innerProperty])
          .flat()
      })

    ids = ids.map((id, ind) => `${id},${extras[ind].join(';')}`)
  }

  records = records.concat(ids)

  if (options.limit && records.length >= options.limit) {
    console.log(`Reached ${options.limit} limit; Stopping`)
    records = records.slice(0, options.limit)
    return records
  }

  // Received any records at all? Ask for more:
  if (ids.length > 0) {
    const page = Math.ceil(records.length / options.size)
    const total = result.hits.total.value
    const pages = total === 10_000 ? '?' : Math.ceil(total / options.size)
    console.log(`Scrolling: ${page} of ${pages}`)

    if (records.length % 1000 === 0) {
      // Every so often, write to file:
      console.log('Writing to ', options.outfile)
      writeFile(records, options.outfile)
    }

    return esScroll({ scroll_id: result._scroll_id, scroll: '30s' })
      .then((result) => parseResultAndScroll(result, options, records))
  } else {
    return records
  }
}

const writeFile = (records, outpath) => {
  console.log(`Got ${records.length} results. Writing to ${outpath}`)

  fs.writeFileSync(outpath, records.join('\n'))
}

/**
 * Given an ES query, performs query, returning ids
 *
 * @returns {Promise<String[]>} Promise that resolves an array of matching ids.
 */
const fetch = (body, options, records = []) => {
  console.log('Query Index: ', JSON.stringify(body, null, 2))

  return esQuery(body, { scroll: '30s' })
    .then((result) => parseResultAndScroll(result, options))
}

const run = async () => {
  setAwsProfile()
  const args = parseArguments()

  // Require a --query
  if (!args.query && !args.queryfile) usage() && die('Must specify --query')

  dotenv.config({ path: args.envfile || './config/qa.env' })

  let query
  try {
    query = args.query ? JSON.parse(args.query) : require(args.queryfile)
  } catch (e) {
    die('Error parsing query: ', e)
  }
  // If "query" property used in root, remove it
  if (query.query) query = query.query

  const body = {
    _source: ['uri'],
    from: args.from,
    size: args.size,
    query
  }

  if (args.limit) console.log(`Applying limit of ${args.limit}`)
  fetch(body, args)
    .then((records) => writeFile(records, args.outfile))
}
console.log('fs: ', process.argv[1])

const isCalledViaCommandLine = /scripts\/identify-ids-by-es-query(.js)?/.test(fs.realpathSync(process.argv[1]))
if (isCalledViaCommandLine) {
  run()
}
