/**
* Script to check for local schema changes that don't exist in the remote index
* (and vice versa). Checks the schema def in lib/elastic-search/index-schema
* (not es-models). For each discrepancy found, suggests PUT requests you can
* make to rectify the difference.
*
* Usage:
*   node scripts/mapping-check --envfile CONFIG [--index INDEX]
*
*/
const dotenv = require('dotenv')
const assert = require('assert')
const argv = require('minimist')(process.argv.slice(2))
const logger = require('../lib/logger')
const { die } = require('./utils')
const { client: esClient } = require('../lib/elastic-search/client')
const { schema } = require('../lib/elastic-search/index-schema')

const usage = () => {
  console.log('Usage: node mapping-check --envfile [path to .env] [--index INDEX]')
  return true
}

if (!argv.envfile) usage() && die('--envfile required')

dotenv.config({ path: argv.envfile })
logger.setLevel(process.env.LOG_LEVEL || 'info')

/**
* Given an index name, returns the remote mapping object
*/
const getMapping = async (index) => {
  const client = await esClient()
  const resp = await client.indices.getMapping({ index })
  return resp.body[index].mappings.resource.properties
}

/**
 * Given an indexname, queries the remote mapping active on the server
 * and produces a hash with `msisingProperties` and `misMappedProperties`
 */
const mappingCheck = async (indexName) => {
  const remoteMapping = await getMapping(indexName)

  const report = mappingsDiff(schema(), remoteMapping)

  return report
}

/**
* Util: Descends into given object, returning a new object containing only
* key-value pairs for which the given callback returns true.
*/
const deepFilterByKey = function (obj, cb) {
  if (typeof obj !== 'object') return obj

  return Object.keys(obj).reduce((clean, key) => {
    const value = obj[key]
    if (cb(key, value)) clean[key] = deepFilterByKey(obj[key], cb)
    return clean
  }, {})
}

/**
* Given two objects of arbitrary depth, returns true if they have identical
* structure and values.
*/
const deepEqual = function (o1, o2) {
  try {
    assert.deepStrictEqual(o1, o2)
    return true
  } catch {
    return false
  }
}

/**
* Given two ES mapping definitions, returns a new object that defines three
* arrays: `localOnlyProperties`, `unequalMappings`, and `remoteOnlyMappings`.
* Each array contains objects that define:
* - property {string} - The property name
* - local {object} - The mapping definition for the local mapping (if present)
* - rmote {object} - The mapping definition for the remote mapping (if present)
**/
const mappingsDiff = (localMapping, remoteMapping) => {
  // Create a report consisting of { localOnlyProperties: [...], unequalMappings: [...], remoteOnlyMappings: [] }
  const report = Object.keys(localMapping)
    .reduce((report, property) => {
      // If it's nested/object, recurse:
      if (localMapping[property].properties) {
        const nestedReport = mappingsDiff(localMapping[property].properties, remoteMapping[property] ? remoteMapping[property].properties : {})
        return Object.keys(nestedReport).reduce((newReport, key) => {
          newReport[key] = newReport[key].concat(nestedReport[key].map((instance) => {
            return Object.assign({}, instance, { property: `${property}.${instance.property}` })
          }))
          return newReport
        }, report)
      }

      const localProperty = localMapping[property]
      // Does property not exist in remote mapping?
      if (Object.keys(remoteMapping).indexOf(property) < 0) {
        report.localOnlyMappings.push({ property, local: localProperty })

        // So, property exists in both places. Compare them:
      } else {
        const remoteProperty = remoteMapping[property]
        // Remove irrelevant properties:
        const localPropertyClean = deepFilterByKey(localProperty, (key, value) => {
          // Only keep index prop if it's set to false (because default is true)
          if (key === 'index') return value === false
          // Remove type prop if type='object':
          if (key === 'type') return value !== 'object'

          // Otherwise keep key:
          return true
        })

        if (!deepEqual(localPropertyClean, remoteProperty)) {
          report.unequalMappings.push({ property, local: localProperty, remote: remoteProperty })
        }
      }
      return report
    }, { localOnlyMappings: [], unequalMappings: [], remoteOnlyMappings: [] })

  // Add remoteOnly to report (mappings on server we don't recognize based on configuration):
  report.remoteOnlyMappings = report.remoteOnlyMappings.concat(
    Object.keys(remoteMapping)
      .filter((property) => Object.keys(localMapping).indexOf(property) < 0)
      .map((property) => ({ property, remote: remoteMapping[property] }))
  )

  return report
}

/**
* Given an array of field definitions, returns an object approximating the
* payload for a mappings PUT call to add the mapping.
**/
const buildPutMapping = function (mappings) {
  return {
    properties: mappings.reduce((h, prop) => {
      h[prop.property] = prop.local
      return h
    }, {})
  }
}

/**
* Given a heading {string} and an array of mapping differences, prints a report
* on each.
*/
const reportOn = function (heading, instances) {
  console.log('######################################################')
  console.log(`${heading}: `)
  if (instances.length === 0) console.log('None')
  else {
    instances.forEach((prop) => {
      console.log('......................................................')
      console.log(`Property: ${prop.property}`)
      if (prop.local) console.log('  Local config:\n    ' + JSON.stringify(prop.local, null, 2).replace(/\n/g, '\n    '))
      if (prop.remote) console.log('  Remote (active) mapping:\n    ' + JSON.stringify(prop.remote, null, 2).replace(/\n/g, '\n    '))
    })
  }
}

/**
* Main script function.
*/
const run = async () => {
  const indexName = argv.index || process.env.ELASTIC_RESOURCES_INDEX_NAME
  console.log(`Running mapping-check on ${indexName}`)
  const mapping = await mappingCheck(indexName)

  // List differences:
  reportOn('Mis-mapped Properties', mapping.unequalMappings)
  reportOn('Remote-only Properties', mapping.remoteOnlyMappings)
  reportOn('Missing (local-only) Properties', mapping.localOnlyMappings)

  // Generate a sample PUT body to push local-only mappings to remote:
  if (mapping.localOnlyMappings.length > 0) {
    const putBody = buildPutMapping(mapping.localOnlyMappings)
    console.log('......................................................')
    console.log('To add missing mappings: PUT the following to the index:', JSON.stringify(putBody, null, 2))
  }

  // Object type differences:
  // Generate a sample PUT body to push object-type mappings differences to remote:
  const patchableObjectTypeMappings = mapping.unequalMappings
    .filter((diff) => {
      const localIsObject = diff.local.type === 'object' || (diff.local.type !== 'object' && diff.local.properties)
      const remoteIsObject = diff.remote.type === 'object' || (diff.remote.type !== 'object' && diff.remote.properties)
      return localIsObject && remoteIsObject
    })
  if (patchableObjectTypeMappings.length > 0) {
    const putBody = buildPutMapping(patchableObjectTypeMappings)
    console.log('......................................................')
    console.log('Object type mappings are fixable via PUT *if* diff.s are addititive.')
    console.log('To add new object properties you may be able to PUT the following to the index:', JSON.stringify(putBody, null, 2))
  }
}

run()
