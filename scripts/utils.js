const { diff, detailedDiff } = require('deep-object-diff')
const aws = require('aws-sdk')

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
  const updateTypes = Object.keys(diffObj, remote, local)
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
    console.log(`${holdingsOrItems[0].toUpperCase() + holdingsOrItems.substring(1)} diff:`)

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
              logObject(itemDiff, 4)
            }
          }
        })
      }
    }
  })

  // console.log("Difference between live and new record:")
  // console.log(JSON.stringify(diff(liveRecord, newRecord), null, 2))
  // console.log("Deletions:")
  // console.log(JSON.stringify(deletedDiff(liveRecord, newRecord), null, 2))

  // console.log(JSON.stringify(addedDiff(liveRecord, records[0]), null, 2))
  // console.log(JSON.stringify(detailedDiff(liveRecord, records[0]), null, 2))
}

module.exports = {
  awsInit,
  die,
  printDiff
}
