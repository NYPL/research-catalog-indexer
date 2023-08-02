const platformApi = require('../platform-api/requests')
const { unique } = require('../utils')

/**
 * Given a location code, returns true if the location is in M2
 *
 * Should match:
 *   mal92, mal98, mal99, mag92, maf92, maf98, maf99, mas92, map92, map98
 *
 * Ideally this would be data-driven rather than hard coded, but at writing,
 * NYPL-Core does not associate M2 customer codes with Sierra holding locations
 * (only delivery locations)
*/
const isM2Location = (location) => /^(mal9|mag9|maf9|mas9|map9)/.test(location)

const attachM2CustomerCodesToBibs = async (bibs) => {
  // Get barcodes from M2 items:
  const barcodes = unique(
    bibs
      .map((bib) => bib.items())
      .flat()
      .filter((item) => item.barcode)
      .filter((item) => item.location && isM2Location(item.location.code))
      .map((item) => item.barcode)
  )
  if (barcodes.length === 0) return bibs

  // Get map relating barcodes to M2 Customer Codes:
  const barcodeToM2CustomerCode = await platformApi.m2CustomerCodesForBarcodes(barcodes)
  bibs.forEach((bib) => {
    bib._items = bib.items().map((item) => {
      if (barcodeToM2CustomerCode[item.barcode]) {
        item._m2CustomerCode = barcodeToM2CustomerCode[item.barcode]
      }
      return item
    })
  })

  return bibs
}

module.exports = {
  attachM2CustomerCodesToBibs
}
