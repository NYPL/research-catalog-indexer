const { diff, detailedDiff } = require('deep-object-diff')
const aws = require('aws-sdk')
const NyplSourceMapper = require('../lib/utils/nypl-source-mapper')
const { bibById, itemById, holdingById } = require('../lib/platform-api/requests')
const SierraBib = require('../lib/sierra-models/bib')
const SierraItem = require('../lib/sierra-models/item')
const SierraHolding = require('../lib/sierra-models/holding')

const awsInit = (profile) => {
  // Set aws creds:
  aws.config.credentials = new aws.SharedIniFileCredentials({
    profile: profile || 'nypl-digital-dev'
  })

  // Set aws region:
  const awsSecurity = { region: 'us-east-1' }
  aws.config.update(awsSecurity)
}

const die = (message) => {
  console.log('Error: ' + message)
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
 *  Given a uri (e.g. b123, i987, hb99887766), returns the relevant SierraModel
 *  instance
 */
const buildSierraModelFromUri = async (uri) => {
  const mapper = await (new NyplSourceMapper())
  const { id, type, nyplSource } = await mapper.splitIdentifier(uri)

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
            const diffed = diff(remoteItem, localItem)
            if (Object.keys(diffed).length > 0) {
              const itemDiff = detailedDiff(remoteItem, localItem)
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

module.exports = {
  awsInit,
  die,
  printDiff,
  capitalize,
  buildSierraModelFromUri
}
