const scsb = require('./client')
const logger = require('../logger')
const { bNumberWithCheckDigit } = require('../utils')

// Ensure scsb live querying has not been disabled via ENV:
const scsbLiveQueryDisabled = process.env.DISABLE_SCSB_LIVE_QUERY === 'true'

// Given a bib, if it is NYPL-owned and has reCAP items, returns an object
// mapping the item ids of that bib's items to their just-queried from
// SCSB recap codes.

const _createRecapCodeMap = async (bib) => {
  let recapCodeItemIdMap
  if (bib.isInRecap() && bib.isNyplRecord() && !scsbLiveQueryDisabled) {
    const client = await scsb.client()
    const __start = new Date()
    // Bib service returns bibId without check digit, but SCSB requires it, as well as .b prefix
    const scsbFriendlyBibId = '.b' + bNumberWithCheckDigit(bib.id)
    const updatedRecapBib = await client.search({ deleted: false, fieldValue: scsbFriendlyBibId, fieldName: 'OwningInstitutionBibId', owningInstitutions: ['NYPL'] })
    const elapsed = ((new Date()) - __start)
    logger.debug(`HTC searchByParam API took ${elapsed}ms`, { metric: 'searchByParam-owningInstitutionBibId', timeMs: elapsed })
    if (updatedRecapBib?.searchResultRows?.length) {
      const results = updatedRecapBib.searchResultRows
      if (results && (results.length > 0) && results[0].searchItemResultRows && results[0].searchItemResultRows.length > 0) {
        recapCodeItemIdMap = results[0].searchItemResultRows.reduce((map, item) => {
          // SCSB items also have check digit and .i prefix, but in this case we can just remove them
          const nyplItemId = item.owningInstitutionItemId.slice(2, -1)
          return { ...map, [nyplItemId]: item.customerCode }
        }, {})
      } else {
        const nyplItemId = results[0].owningInstitutionItemId.slice(2, -1)
        recapCodeItemIdMap = { [nyplItemId]: results[0].customerCode }
      }
    }
  }
  return recapCodeItemIdMap
}

// Given a bib, if it is NYPL-owned and has reCAP items, returns that bib with
// appropriate recap codes attached to its items. Otherwise returns unmutated bib

const attachRecapCustomerCodes = async (bib) => {
  const recapCodeItemIdMap = await _createRecapCodeMap(bib)
  if (recapCodeItemIdMap) {
    bib.items().forEach((item) => { item._recapCustomerCode = recapCodeItemIdMap[item.id] })
  }
  return bib
}

module.exports = { attachRecapCustomerCodes, private: { _createRecapCodeMap } }
