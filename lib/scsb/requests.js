const scsb = require('./client')
const logger = require('../logger')
const { addSierraCheckDigit } = require('../utils')

// Ensure scsb live querying has not been disabled via ENV:
const scsbLiveQueryDisabled = process.env.DISABLE_SCSB_LIVE_QUERY === 'true'

// Given a bib, if it is NYPL-owned and has reCAP items, returns an object
// mapping the item barcodes of that bib's items to their just-queried from
// SCSB recap codes.

const _createRecapCodeMap = async (bib) => {
  let recapCodeBarcodeMap
  if (bib.isInRecap() && bib.isNyplRecord() && !scsbLiveQueryDisabled) {
    const client = await scsb.client()
    const __start = new Date()
    // Bib service returns bibId without check digit, but SCSB requires it, as well as .b prefix
    const scsbFriendlyBibId = '.b' + addSierraCheckDigit(bib.id)
    const updatedRecapBib = await client.search({ deleted: false, fieldValue: scsbFriendlyBibId, fieldName: 'OwningInstitutionBibId', owningInstitutions: ['NYPL'] })
    const elapsed = ((new Date()) - __start)
    logger.debug(`HTC searchByParam API took ${elapsed}ms`, { metric: 'searchByParam-owningInstitutionBibId', timeMs: elapsed })
    if (updatedRecapBib?.searchResultRows?.length) {
      const results = updatedRecapBib.searchResultRows
      if (results && (results.length > 0) && results[0].searchItemResultRows && results[0].searchItemResultRows.length > 0) {
        recapCodeBarcodeMap = results[0].searchItemResultRows.reduce((map, item) => {
          return { ...map, [item.barcode]: item.customerCode }
        }, {})
      } else {
        recapCodeBarcodeMap = { [results[0].barcode]: results[0].customerCode }
      }
    }
  }
  return recapCodeBarcodeMap
}

/**
 *  Given a bib with items in ReCAP, uses barcode-customer-code cache to attach customer codes
 */
const _createRecapCodeMapFromCache = (bib) => {
  if (!bib.isInRecap()) return null

  // Determine all of the barcodes we're looking for:
  const offsiteItemBarcodes = bib.items()
    .filter((item) => item.location?.code.startsWith('rc'))
    .map((item) => item.barcode)
    .filter((b) => !!b)

  // Map barcodes to cached customer codes:
  const barcodeMap = offsiteItemBarcodes
    .reduce((h, barcode) => ({ ...h, [barcode]: _barcodeRecapCustomerCodeCache[barcode] }), {})

  // Identify barcodes not recognized:
  const missingBarcodes = offsiteItemBarcodes
    .filter((barcode) => !Object.keys(barcodeMap).includes(barcode))
  if (missingBarcodes.length) {
    logger.debug(`Barcode cache miss: ${missingBarcodes.join(', ')}`)
    return null
  }

  logger.debug(`Serving ${offsiteItemBarcodes.length} barcode-customer-code(s) from cache`)
  return barcodeMap
}

// Given a bib, if it is NYPL-owned and has reCAP items, returns that bib with
// appropriate recap codes attached to its items. Otherwise returns unmutated bib
const attachRecapCustomerCodes = async (bib) => {
  let barcodeMap
  if (_barcodeRecapCustomerCodeCache) {
    barcodeMap = _createRecapCodeMapFromCache(bib)
  }

  // Use barcode-customer-code cache if available:
  const map = await (barcodeMap ? Promise.resolve(barcodeMap) : _createRecapCodeMap(bib))
  if (map) {
    bib.items().forEach((item) => { item._recapCustomerCode = map[item.barcode] })
  }
  return bib
}

let _barcodeRecapCustomerCodeCache
const populateBarcodeRecapCustomerCodeCache = (map) => {
  _barcodeRecapCustomerCodeCache = map
  logger.info(`Populated recap barcode-customer-code map with ${Object.keys(map).length} entries`)
}

/**
 *  Apply attachRecapCustomerCodes to all given bibs
 */
const attachRecapCustomerCodesToBibs = async (bibs) => {
  return Promise.all(bibs.map(attachRecapCustomerCodes))
}

module.exports = { attachRecapCustomerCodes, attachRecapCustomerCodesToBibs, populateBarcodeRecapCustomerCodeCache, private: { _createRecapCodeMap } }
