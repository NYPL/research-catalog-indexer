const _cache = {}

const lookup = (type, key) => {
  if (!_cache[type]) {
    const path = `../../data/look-up-${type}.json`
    _cache[type] = require(path)
  }

  return _cache[type][key]
}

module.exports = lookup
