const dupeObjectsByHash = (objects, hasher) => {
  return Object.values(
    objects
      .reduce((h, object) => {
        const key = hasher(object)
        if (!h[key]) h[key] = []
        h[key].push(object)
        return h
      }, {})
  )
    .filter((set) => set.length > 1)
}

const uniqueObjectsByHash = (objects, hasher) => {
  if (!hasher || typeof hasher !== 'function') throw new Error('uniqueObjectsByHash requires a hasher function')

  const keyObjectPairs = objects.map((object) => [hasher(object), object])
  return [...new Map(keyObjectPairs).values()]
}

module.exports = {
  dupeObjectsByHash,
  uniqueObjectsByHash
}
