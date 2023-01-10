const { attachRecapCustomerCodes } = require('../lib/scsb/requests')

const generalPrefetch = async (records) => {
  records = await Promise.all(records.map(attachRecapCustomerCodes))
  return records
}

module.exports = generalPrefetch
