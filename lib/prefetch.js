const platformApi = require('./platform-api/requests')
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
// Defer model-prefetch to the PlatformAPI:
// Note that we have to define it as an arrow function so that
// platformApi.modelPrefetch is evaluated at call time to ensure we can spy on
// it in tests
module.exports.modelPrefetch = (bibs) => platformApi.modelPrefetch(bibs)
module.exports.generalPrefetch = generalPrefetch
