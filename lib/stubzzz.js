const prefilter = (bib, itemOrHolding) => {
  const filter = async (records) => {
    return await Promise.all(records.map((records) => Promise.resolve({ ...records, bibIds: [bib.id], [itemOrHolding]: { id: '123' } })))
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
  prefilterItems: (records) => prefilter(records[0], '_items'),
  prefilterHoldings: (records) => prefilter(records[0], '_holdings'),
  prefetch: asyncNoop,
  writeRecords: async (n) => Promise.resolve({ totalProcessed: n.length }),
  EsBib
}
