/**
* Script to check for schema changes between two remote mappings.
*
* Usage:
*   node scripts/mapping-compare INDEX1 INDEX2
*
* Optionally pass in --envfile1 and --envfile2 to identify the environment of
* each index. Otherwise environment will be assumed based on index name.
*
* Prints a colorized diff of the form:
*
*   Comparing resources-prod-2026-04-08 and resources-prod-2026-05-26
*     Using ./config/production.env for resources-prod-2026-04-08 because: Index name contains "prod"
*     Using ./config/production.env for resources-prod-2026-05-26 because: Index name contains "prod"
*
*   ~ numAvailable.type (long > short)
*   ~ numItems.type (long > short)
*   - parallelDescription.fields.keyword.type (keyword)
*   -                                   .ignore_above (256)
*   ~ parallelDisplayField.properties.fieldName.type (text > keyword)
*   -                                          .fields.keyword.type (keyword)
*   -                                                         .ignore_above (256)
*   - creators_packed.type (text)
*   -                .fields.keyword.type (keyword)
*   -                               .ignore_above (256)
*   + description.type (text)
*   +            .fields.keyword.type (keyword)
*   +                           .ignore_above (256)
*
* See also: mapping-check.js for comparing local schema to a remote schema
*
*/
const dotenv = require('dotenv')
const fs = require('fs')
const deepDiff = require('deep-diff-pizza')
const chalk = require('chalk')
const argv = require('minimist')(process.argv.slice(2))
const logger = require('../lib/logger')
const esClient = require('../lib/elastic-search/client')
const { die, setAwsProfile } = require('./utils')

const usage = () => {
  console.log('Usage: node scripts/mapping-compare --envfile CONFIG INDEX1 INDEX2')
  return true
}

/**
* Given an index name, returns the remote mapping object
*/
exports.getMapping = async (index, path) => {
  dotenv.config({ path, override: true })

  const client = await esClient.client()
  const resp = await client.indices.getMapping({ index })
  esClient._resetClient()
  return resp.body[index].mappings.properties
}

/**
 *  Given an index name and a set of options
 *  returns a pair of values representing
 *   1. the relevant envfile to use given the options and the index name
 *   2. the reason for the choice
 */
const envfileForIndex = (index, options) => {
  if (options.envfile1) {
    return [options.envfile1, 'Specified via --envfile1']
  } else if (options.envfile2) {
    return [options.envfile2, 'Specified via --envfile2']
  } else if (options.envfile) {
    return [options.envfile, 'Specified via --envfile']
  } else if (/qa/.test(index)) {
    return ['./config/qa.env', 'Index name contains "qa"']
  } else if (/prod/.test(index)) {
    return ['./config/production.env', 'Index name contains "prod"']
  } else {
    throw Error(`Could not determine appropriate envfile for ${index}`)
  }
}

/**
 *  Given two ES mappings, returns a colorized diff
 */
exports.getDiff = (mappings1, mappings2) => {
  let currentProp = ''

  const diffs = deepDiff(mappings1, mappings2)
    .filter((diff) => diff.operation !== 'UNCHANGED')
    .map(({ operation, path, was, is }) => {
      const scrub = currentProp.length ? (' '.repeat(currentProp.length - 1) + '.') : ''
      const formattedPath = path.replace(currentProp, scrub)
      currentProp = path.split('.').slice(0, -1).join('.') + '.'

      switch (operation) {
        case 'ADDED': return chalk.green(`+ ${formattedPath} (${is})`)
        case 'REMOVED': return chalk.red(`- ${formattedPath} (${was})`)
        case 'UPDATED': return chalk.yellow(`~ ${formattedPath} (${was} > ${is})`)
      }
      return null
    })
    .filter(Boolean)

  return diffs.join('\n')
}

/**
 Main script function: Load relevant envs and mappings. Print diff
*/
exports.run = async (index1, index2, options = {}) => {
  console.log(`Comparing ${index1} and ${index2}`)

  const mappings = []
  try {
    for (const [ind, name] of Object.entries([index1, index2])) {
      try {
        // if --envfile1 or --envfile2 given, pass in relevant config:
        const envfileKey = `envfile${parseInt(ind) + 1}`
        const [envfile, reason] = envfileForIndex(name, {
          [envfileKey]: options[envfileKey],
          envfile: options.envfile
        })
        console.log(`  Using ${envfile} for ${name} because: ${reason}`)
        const mapping = await exports.getMapping(name, envfile)
        mappings.push(mapping)
      } catch (e) {
        throw new Error(`Failed to fetch mapping for ${name}: ${e}`)
      }
    }
  } catch (e) {
    die(e)
  }

  console.log(
    exports.getDiff(mappings[0], mappings[1])
  )
}

const isCalledViaCommandLine = /scripts\/mapping-compare(.js)?/.test(fs.realpathSync(process.argv[1]))
if (isCalledViaCommandLine) {
  setAwsProfile()
  if (!argv._.length) usage() && die('INDEX1 and INDEX2 required')

  logger.setLevel(process.env.LOG_LEVEL || 'info')

  exports.run(argv._[0], argv._[1], argv)
}
