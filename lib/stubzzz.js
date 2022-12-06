const prefilter = (itemOrHolding) => {
  const filter = async (records) => {
    return await Promise.all(records.map((records) => Promise.resolve({ ...records, bibIds: [1, 2, 3], [itemOrHolding]: { id: '123' } })))
  }
  return filter
}

const asyncNoop = async (x) => Promise.resolve(x)
class EsBib {
  constructor (bib) {
    Object.keys(bib).forEach((key) => {
      this[key] = bib[key]
    })
  }
}
module.exports = {
  prefilterBibs: asyncNoop,
  prefilterItems: prefilter('_items'),
  prefilterHoldings: prefilter('_holdings'),
  prefetch: asyncNoop,
  writeRecords: async (n) => Promise.resolve({ totalProcessed: n.length }),
  EsBib
}
