const { diff, detailedDiff } = require('deep-object-diff')

const NyplSourceMapper = require('../lib/utils/nypl-source-mapper')
const { bibById, itemById, holdingById } = require('../lib/platform-api/requests')
const SierraBib = require('../lib/sierra-models/bib')
const SierraItem = require('../lib/sierra-models/item')
const SierraHolding = require('../lib/sierra-models/holding')
const logger = require('../lib/logger')

const { fromIni } = require('@aws-sdk/credential-providers')

/**
* Given a named profile, returns a `credentials` value suitable for sending
* into any AWS SDK client class
*/
const awsCredentialsFromIni = (profile = 'nypl-digital-dev') => {
  return fromIni({ profile })
}

const die = (message) => {
  logger.error('Error: ' + message)
  process.exit()
}

function removeEmpty (obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v != null)
      .map(([k, v]) => [k, v === Object(v) ? removeEmpty(v) : v])
  )
}

const verboseDiffPerType = (diffedProperties, remote, local) => {
  return Object.keys(diffedProperties).reduce((acc, prop) => {
    if (remote[prop] || local[prop]) {
      return {
        ...acc,
        [prop]: {
          actualIndexedValue: remote[prop],
          locallyBuiltValue: local[prop]
        }
      }
    } else return acc
  }, {})
}

const buildVerboseDiff = (diffObj, remote, local) => {
  // there are three first level properties on the diff obj, added, local, and
  // deleted.
  const updateTypes = Object.keys(diffObj)
  return updateTypes.reduce((acc, type) => ({
    ...acc,
    [type]: verboseDiffPerType(diffObj[type], remote, local)
  }), {})
}

function logObject (obj, indent = 2) {
  obj = removeEmpty(obj)
  let s = JSON.stringify(
    obj,
    (k, v) => v === undefined ? null : v,
    2
  )
  s = s.split('\n')
    .map((line) => `${' '.repeat(indent)}${line}`)
    .join('\n')
  console.log(s)
}

/**
 *  Given a string, returns same string with first character capitalized
 */
const capitalize = (s) => {
  return s.replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase())
}

/**
 *  Given a name in dash/underscore (shish-kebab/snake) case, returns same name
 *  in camel case
 */
const camelize = (s) => {
  return s.toLowerCase().replace(/([-_][a-z])/g, group =>
    group
      .toUpperCase()
      .replace('-', '')
      .replace('_', '')
  )
}

/**
 *  Given a uri (e.g. b123, i987, hb99887766), returns the relevant SierraModel
 *  instance
 */
const buildSierraModelFromUri = async (uri) => {
  const mapper = await NyplSourceMapper.instance()
  const { id, type, nyplSource } = mapper.splitIdentifier(uri)

  const {
    fetcher,
    Klass
  } = {
    bib: {
      fetcher: bibById,
      Klass: SierraBib
    },
    item: {
      fetcher: itemById,
      Klass: SierraItem
    },
    holding: {
      fetcher: (_, id) => holdingById(id),
      Klass: SierraHolding
    }
  }[type]

  const data = await fetcher(nyplSource, id)
  if (!data) {
    console.log(`${type} ${nyplSource}/${id} not found`)
    return null
  }

  return new Klass(data)
}

const diffHasSomethingToSay = (diff) => {
  if (!diff || Object.keys(diff).length === 0) return false

  for (const prop of ['added', 'deleted', 'updated']) {
    const truthyValues = Object.values(diff[prop])
      .filter((v) => v)
    if (truthyValues.length >= 1) return true
  }
}

function printDiff (remote, local, verbose) {
  console.log(`Bib metadata diff for ${remote.uri}:`)
  const noChildren = (bib) => Object.assign({}, bib, { items: null, holdings: null, uris: null, localAt: null })
  if (Object.keys(diff(noChildren(remote), noChildren(local))).length > 0) {
    const metaDiff = detailedDiff(noChildren(remote), noChildren(local))
    if (verbose) {
      const verboseDiff = buildVerboseDiff(metaDiff, remote, local)
      logObject(verboseDiff)
    } else {
      logObject(metaDiff)
    }
  } else {
    console.log('  No diff')
  }

  ;['items', 'holdings'].forEach((holdingsOrItems) => {
    console.log(`${capitalize(holdingsOrItems)} diff:`)

    if (remote[holdingsOrItems] || local[holdingsOrItems]) {
      if (!remote[holdingsOrItems]) console.log(`  No ${holdingsOrItems} in remote (${local[holdingsOrItems].length} ${holdingsOrItems} in local doc)`)
      else if (!local[holdingsOrItems]) console.log(`  No ${holdingsOrItems} in local doc (${remote[holdingsOrItems].length} ${holdingsOrItems} in remote doc)`)
      else if (remote[holdingsOrItems].length !== local[holdingsOrItems].length) {
        console.log(`  remote ${holdingsOrItems}: ${remote[holdingsOrItems].length}, new ${holdingsOrItems} length: ${local[holdingsOrItems].length}`)
      } else {
        console.log(`  Both documents have ${remote[holdingsOrItems].length} ${holdingsOrItems}`)
      }

      if (remote[holdingsOrItems] && local[holdingsOrItems]) {
        remote[holdingsOrItems].forEach((remoteItem) => {
          if (!local[holdingsOrItems]) {
            console.log(`  Can not find ${holdingsOrItems} in local doc`)
            return
          }
          const localItem = local[holdingsOrItems].find((i) => i.uri === remoteItem.uri)
          if (!localItem) console.log(`  Can not find ${remoteItem.uri} in ${holdingsOrItems} in local doc`)
          else {
            const itemDiff = detailedDiff(remoteItem, localItem)
            if (diffHasSomethingToSay(itemDiff)) {
              console.log(`  Diff in ${holdingsOrItems} ${remoteItem.uri}:`)
              if (verbose) {
                const verboseDiff = buildVerboseDiff(itemDiff, remoteItem, localItem)
                logObject(verboseDiff, 4)
              } else {
                logObject(itemDiff, 4)
              }
            }
          }
        })
      }
    }
  })
}

/**
* Given a number of seconds, returns an object that defines:
*  - days: Number of whole days
*  - hours: Number of whole hours
*  - minutes: Number of whole minutes
*  - seconds: Number of whole seconds
*  - display: A string representation of the duration incorporating above properties
*/
const secondsAsFriendlyDuration = (seconds) => {
  const secondsPerHour = 60 * 60
  const secondsPerDay = secondsPerHour * 24

  const days = Math.floor(seconds / secondsPerDay)
  seconds -= days * secondsPerDay

  const hours = Math.floor(seconds / secondsPerHour)
  seconds -= hours * secondsPerHour

  const minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60

  seconds = Math.floor(seconds)

  return {
    days,
    hours,
    minutes,
    seconds,
    display: [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      seconds ? `${seconds}s` : null
    ]
      .filter((statement) => statement)
      .join(' ')
  }
}

/**
* Given an array of identifiers (e.g. ['b123', 'pb456']) and a batchSize
*  1. converts the identifiers into objects that define `type`, `nyplSource`, and `id`
*  2. groups the mapped identifiers by type and nyplSource
*  3. returns a new 2d array where each array contains no more than `batchSize` elements
*
* For example:
* batchByTypeAndNyplSource(['b123', 'b456', 'b789', 'pb987'], 2)
* => [
*      [
*        { type: 'bib', nyplSource: 'sierra-nypl', id: '123' },
*        { type: 'bib', nyplSource: 'sierra-nypl', id: '456' }
*      ],
*      [
*        { type: 'bib', nyplSource: 'sierra-nypl', id: '789' }
*      ],
*      [
*        { type: 'bib', nyplSource: 'recap-pul', id: '987' }
*      ]
*    ]
*/
const batchIdentifiersByTypeAndNyplSource = async (identifiers, batchSize = 100) => {
  const grouped = await groupIdentifiersByTypeAndNyplSource(identifiers)
  const batches = grouped
    // Apply batching to each group:
    .map((group) => batch(group, batchSize))
    // Flatten into a 1D array of grouped batches:
    .flat()

  // Log out the groupings:
  logger.info(`Grouped ${identifiers.length} identifiers into ${batches.length} batches of length ${batchSize} by type and nyplSource`)

  return batches
}

/**
* Given an array of identifiers (e.g. ['b123', 'pb456']):
*  1. converts the identifiers into objects that define `type`, `nyplSource`, and `id`
*  2. groups the mapped identifiers by type and nyplSource
*  3. returns a new 2d array where each array contains only identifers of the same type and nyplSource
*
* For example:
* groupByTypeAndNyplSource(['b123', 'b456', 'b789', 'pb987'], 2)
* => [
*      [
*        { type: 'bib', nyplSource: 'sierra-nypl', id: '123' },
*        { type: 'bib', nyplSource: 'sierra-nypl', id: '456' },
*        { type: 'bib', nyplSource: 'sierra-nypl', id: '789' }
*      ],
*      [
*        { type: 'bib', nyplSource: 'recap-pul', id: '987' }
*      ]
*    ]
*/
const groupIdentifiersByTypeAndNyplSource = async (identifiers) => {
  const mapper = await NyplSourceMapper.instance()

  if (!/^[a-z]+\d+$/.test(identifiers[0])) {
    logger.error(`Invalid prefixed id: ${identifiers[0]}`)
    return
  }
  // Attempt to split all identifiers, capturing invalids
  const { splitIdentifiers, invalid } = identifiers
    .reduce((h, ident) => {
      const split = mapper.splitIdentifier(ident)
      if (!split || !split.type || !split.nyplSource) {
        h.invalid.push(ident)
      } else {
        h.splitIdentifiers.push(split)
      }
      return h
    }, { invalid: [], splitIdentifiers: [] })

  // Report if some were not parsable:
  if (invalid.length) {
    console.warn(`Found ${invalid.length} invalid identifiers: `, invalid.slice(0, 10))
  }

  const grouped = splitIdentifiers.reduce((h, ident) => {
    if (!h[ident.type]) h[ident.type] = []
    if (!h[ident.type][ident.nyplSource]) h[ident.type][ident.nyplSource] = []
    h[ident.type][ident.nyplSource].push(ident)
    return h
  }, {})

  // Flatten:
  return Object.keys(grouped).reduce((all, type) => {
    return all.concat(Object.values(grouped[type]))
  }, [])
}

const batch = (things, batchSize = 100) => {
  return things.reduce((batches, thing) => {
    let currentBucket = batches[batches.length - 1]
    if (!currentBucket || currentBucket.length === batchSize) {
      currentBucket = []
      batches.push(currentBucket)
    }
    currentBucket.push(thing)
    return batches
  }, [])
}

module.exports = {
  awsCredentialsFromIni,
  batch,
  batchIdentifiersByTypeAndNyplSource,
  buildSierraModelFromUri,
  camelize,
  capitalize,
  die,
  groupIdentifiersByTypeAndNyplSource,
  printDiff,
  secondsAsFriendlyDuration
}
