const { attachRecapCustomerCodesToBibs } = require('../lib/scsb/requests')
const { parseDatesAndCache } = require('../lib/utils/item-date-parse')

const generalPrefetch = async (records) => {
  // Run a collection "prefetcher jobs", which are async functions that operate on a set of records:
  await Promise.all([
    // Look up ReCAP customer codes:
    attachRecapCustomerCodesToBibs(records),
    // Pre-parse item dates:
    parseDatesAndCache(records)
  ])

  return records
}

module.exports = generalPrefetch
