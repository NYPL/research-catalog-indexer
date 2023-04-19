const fs = require('fs')
const path = require('node:path')
const { parse } = require('csv-parse/sync')

const _cache = {}

/**
 *  Given a lookupName, loads the named lookup file (in /data/) and returns a
 *  hash that relates values in the first column to values in the second.
 */
const lookup = (lookupName) => {
  // If we already loaded the lookup, use that:
  if (_cache[lookupName]) return _cache[lookupName]

  const filePath = path.join(__dirname, `../../data/${lookupName}.csv`)
  const rawContent = fs.readFileSync(filePath, 'utf8')

  // Parse as CSV and convert to a lookup hash:
  _cache[lookupName] = parse(rawContent, { ltrim: true })
    .reduce((h, [key, value]) => Object.assign(h, { [key]: value }), {})

  return _cache[lookupName]
}

module.exports = {
  lookup
}
