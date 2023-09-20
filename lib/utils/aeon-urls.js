const { firstValue, addSierraCheckDigit, trimTrailingPunctuation } = require('../utils')
const logger = require('../logger')
const { truncate } = require('../utils')
const { lookup } = require('./lookup')

const locationLabelMap = lookup('aeon-site-code-to-label')

/**
 *  Given a EsItem, returns an Aeon URL
 */
const aeonUrlForItem = async (esItem) => {
  const siteCode = esItem._aeonSiteCode()
  if (!siteCode) return null

  const bibUri = await esItem.esBib?.uri()
  const itemUri = await esItem.uri()

  // Reject any Aeon site code we don't known about:
  if (!locationLabelMap[siteCode]) {
    logger.warn(`Unrecognized Aeon site code '${siteCode}' for item ${bibUri}/${itemUri}`)
    return null
  }

  const aeonBaseUrl = process.env.AEON_BASE_URL || 'https://specialcollections.nypl.org'
  const catalogBaseUrl = process.env.CATALOG_BASE_URL || 'https://catalog.nypl.org/record='

  const baseUrl = aeonBaseUrl + '/aeon/Aeon.dll?'

  const sierraItem = esItem.item
  const sierraBib = sierraItem.bibs() && sierraItem.bibs().length ? sierraItem.bibs()[0] : null

  const accessMessageLabel = (firstValue(esItem.accessMessage()) || {}).label
  const materialTypeLabel = sierraBib?.materialType?.value
  // Get edition from 250 $a if it exists:
  const edition = sierraBib?.varField('250', ['a'])
    .map((match) => match.value)
    .pop()
  // In addition to the typical title subfields a and b, also query k, f, and g:
  const extendedTitle = sierraBib?.varField('245', ['a', 'b', 'k', 'f', 'g'])
    .map((match) => match.value)
    .map((s) => trimTrailingPunctuation(s))
    .pop()
  const useStatement = sierraBib?.varField('506', ['a'])
    .map((match) => match.value)
    .pop()
  const locationLabel = locationLabelMap[siteCode]
  const holdingLocationId = firstValue(esItem.holdingLocation())?.id?.split(':').pop()
  const isReCAP = /^rc/.test(holdingLocationId)
  const itemVolume = sierraItem.fieldTag('v')[0]?.value

  const props = {
    Action: 10,
    Author: firstValue(esItem.esBib?.creatorLiteral()) || '',
    CallNumber: firstValue(esItem.shelfMark(false)) || '',
    Date: firstValue(esItem.esBib?.createdString()) || '',
    Form: 30,
    Genre: materialTypeLabel || '',
    ItemEdition: edition || '',
    ItemInfo1: accessMessageLabel || '',
    ItemInfo2: truncate(useStatement, 255) || '',
    ItemInfo3: bibUri ? `${catalogBaseUrl}${bibUri}` : '',
    ItemISxN: addSierraCheckDigit(itemUri),
    ItemNumber: firstValue(esItem.idBarcode()) || '',
    ItemPlace: firstValue(esItem.esBib?.placeOfPublication()) || '',
    ItemPublisher: firstValue(esItem.esBib?.publisherLiteral()) || '',
    ItemVolume: itemVolume,
    Location: isReCAP ? 'ReCAP' : (locationLabel || ''),
    ReferenceNumber: addSierraCheckDigit(bibUri),
    Site: siteCode,
    SubLocation: isReCAP ? holdingLocationId : '',
    Title: truncate(extendedTitle, 255)
  }
  const nonEmptyProps = Object.keys(props).reduce((h, k) => {
    if (props[k]) h[k] = props[k]
    return h
  }, {})

  // Note that use of this util appears to automatically encode characters
  // such as + characters in shelfmarks and diacritics
  return baseUrl + new URLSearchParams(nonEmptyProps).toString()
}

module.exports = {
  aeonUrlForItem,
  truncate
}
