const { attachRecapCustomerCodes } = require('../lib/scsb/requests')

const generalPrefetch = async (records) => {
  records = await Promise.all(records.map(async (bib) => {
    return await attachRecapCustomerCodes(bib)
  }))
  return records
}

export default generalPrefetch
