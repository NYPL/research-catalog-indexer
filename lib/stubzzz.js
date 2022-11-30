const asyncNoop = (x) => Promise.resolve(x)
class EsBib {
  constructor (bib) {
    Object.keys(bib).forEach((key) => {
      this[key] = bib[key]
    })
  }
}
module.exports = {
  prefilterBibs: asyncNoop,
  prefilterItems: asyncNoop,
  prefilterHoldings: asyncNoop,
  prefetch: (records) => records.map((x) => Promise.resolve({ ...x, recapCustomerCode: 'VK' })),
  EsBib,
  bibIdentifiersForItems: async (items) => await Promise.all(items.map(() => Promise.resolve('b12345678')))
}
