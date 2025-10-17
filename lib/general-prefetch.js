const { attachRecapCustomerCodesToBibs } = require('../lib/scsb/requests')
const { attachM2CustomerCodesToBibs } = require('../lib/utils/m2-customer-codes')
const { parseDatesAndCache } = require('../lib/utils/item-date-parse')

const generalPrefetch = async (records) => {
  // Run a collection "prefetcher jobs", which are async functions that operate on a set of records:
  await Promise.all([
    // Look up ReCAP customer codes:
    attachRecapCustomerCodesToBibs(records),
    // Look up M2 customer codes:
    attachM2CustomerCodesToBibs(records),
    // Pre-parse item dates:
    parseDatesAndCache(records)
  ])

  return records
}

module.exports.generalPrefetch = generalPrefetch
