/**
 * Supports building a CSV of Sierra bib/item ids for an arbitrary Sierra API query.
 *
 * Query by timestamp:
 *
 *   node scripts/identify-ids-by-sierra-query --timestamprange '[2019-11-18T02:40:18Z,2019-12-06T21:56:17Z]' --envfile config/qa-bulk-index.env
 *
 * Query bibs that have marc 799:
 *
 *   node scripts/identify-ids-by-sierra-query --hasmarc 799 --envfile config/qa-bulk-indexenv --outfile bib-ids-799-qa.csv
 *
 * Query items by location:
 *
 *   node scripts/identify-ids-by-sierra-query --query '{"target": {"record": {"type": "item"}, "id": "79"}, "expr": {"op": "equals", "operands": [ "map08" ]}}' --envfile config/qa-bulk-index.env --outfile bib-ids-799-qa.csv
 *
 * Common params:
 *  --envfile PATH - Specify path to a json file (see config/sample.json) REQ
 *  --outfile PATH - Specify where to write csv (default out.json)
 *  --type TYPE - Specify bib or item
 */
const dotenv = require('dotenv')
const kms = require('../lib/kms')
const { die } = require('./utils')

const wrapper = require('@nypl/sierra-wrapper')
const fs = require('fs')

const argv = require('minimist')(process.argv.slice(2), {
  string: ['hasmarc'],
  default: {
    outfile: './out.csv',
    type: 'bib',
    offset: 0
  }
})

const delay = (time) => new Promise((resolve, reject) => setTimeout(resolve, time))

/**
 *  Get items updated in range
 */
const getUpdatedIds = (type, range, offset = 0, ids = []) => {
  const limit = 500

  return wrapper.get(`${type}?updatedDate=${range}&offset=${offset}&limit=${limit}&fields=id`)
    .then((results) => {
      const newIds = results.entries[0].entries.map((rec) => rec.id)
      console.log(`Got ${newIds.length} more... `)

      fs.writeFileSync(argv.outfile, ids.join('\n'))

      if (newIds.length === 0) return ids

      // Recurse:
      return delay(1000).then(() => {
        return getUpdatedIds(type, range, offset + limit, ids.concat(newIds))
      })
    })
    .catch((e) => {
      console.log('Encountered error: ', e)
    })
}

/**
 *  Write new batch of ids to the outfile.
 */
const appendToFile = (newIds, allIds, outfile) => {
  if (newIds.length === 0) return

  console.log(`Got ${newIds.length} more. ${allIds.length} total written this run to ${outfile}`)
  const newline = fs.existsSync(outfile) ? '\n' : ''
  fs.appendFileSync(outfile, newline + newIds.join('\n'))
}

let lastGetRecordIdsByQueryCall
/**
 *  Get record (bibs or items) ids by query
 *
 *  @param type String identifying record type (bib, item)
 *  @param query Object giving sierra "json query"
 */
const getRecordIdsByQuery = (type, query, offset = 0, ids = []) => {
  const limit = 500

  // Store most recent call just in case it throws an uncaught exception
  // and we need to retry
  lastGetRecordIdsByQueryCall = { type, query, offset, ids }

  return wrapper.post(`${type}s/query?offset=${offset}&limit=${limit}&fields=id`, query)
    .then((results) => {
      const newIds = results.entries.map((rec) => rec.link.split('/').pop())

      ids = ids.concat(newIds)

      appendToFile(newIds, ids, argv.outfile)

      if (newIds.length === 0) return ids

      // Recurse:
      return delay(1000).then(() => {
        return getRecordIdsByQuery(type, query, offset + limit, ids)
      })
    })
    .catch((e) => {
      console.log('Encountered error: ', e)

      if (lastGetRecordIdsByQueryCall) {
        console.log('Detected error querying Sierra; Waiting 5s to retry..')

        const { type, query, offset, ids } = lastGetRecordIdsByQueryCall
        setTimeout(() => getRecordIdsByQuery(type, query, offset, ids), 5000)
      }
    })
}

/**
 *  Get bib ids that have named marc field
 */
const getBibIdsByHasMarc = (marc) => {
  const query = {
    target: {
      record: { type: 'bib' },
      field: { marcTag: argv.hasmarc, subfields: 'a' }
    },
    expr: {
      op: 'not_equal',
      operands: ['!']
    }
  }
  if (argv.verbose) {
    console.log('Issuing query: ', query)
  }
  getRecordIdsByQuery(argv.type, query, argv.offset)
}

const decryptConfig = async () => {
  const missingConfig = ['SIERRA_BASE', 'SIERRA_KEY', 'SIERRA_SECRET']
    .filter((key) => !process.env[key])
  if (missingConfig.length) {
    throw new Error(`Missing Sierra config: ${missingConfig}`)
  }

  // Decrypt the encrypted vars:
  const [key, secret] = await Promise.all([
    kms.decrypt(process.env.SIERRA_KEY),
    kms.decrypt(process.env.SIERRA_SECRET)
  ])

  return {
    key,
    secret,
    base: process.env.SIERRA_BASE
  }
}

/**
* Build a CSV based on command arguments.
*/
const run = async () => {
  if (!argv.envfile) throw new Error('Must use --envfile to specify a sierra wrapper config')
  dotenv.config({ path: argv.envfile || './config/qa-bulk-index.env' })

  const config = await decryptConfig()
    .catch((e) => die(`Aborting due to: ${e}`))
  wrapper.config(config)

  if (argv.timestamprange) {
    getUpdatedIds(argv.timestamprange, argv.offset)
  } else if (argv.hasmarc) {
    getBibIdsByHasMarc(argv.hasmarc)
  } else if (argv.query) {
    let query
    try {
      query = JSON.parse(argv.query)
    } catch (e) {
      console.log('Error parsing --query: ', e)
    }

    console.log(`Querying ${argv.type}s by ${JSON.stringify(query)}`)
    if (fs.existsSync(argv.outfile)) {
      console.log(`Note: ${argv.outfile} exists. Will append results to it.`)
    }
    getRecordIdsByQuery(argv.type, query, argv.offset)
  }
}

run()
