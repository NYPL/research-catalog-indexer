const { firstValue, addSierraCheckDigit, trimTrailingPunctuation } = require('../utils')
const logger = require('../logger')
const { truncate } = require('../utils')
const { lookup } = require('./lookup')

const locationLabelMap = lookup('aeon-site-code-to-label')

/**
 *  Given a EsItem, returns an Aeon URL
 */
const aeonUrlForItem = (esItem) => {
  const siteCode = esItem._aeonSiteCode()
  if (!siteCode) return null

  const bibUri = esItem.esBib?.uri()
  const itemUri = esItem.uri()

  // Reject any Aeon site code we don't known about:
  if (!locationLabelMap[siteCode]) {
    logger.warn(`Unrecognized Aeon site code '${siteCode}' for item ${bibUri}/${itemUri}`)
    return null
  }

  const aeonBaseUrl = process.env.AEON_BASE_URL || 'https://specialcollections.nypl.org'
  const catalogBaseUrl = process.env.CATALOG_BASE_URL || 'https://catalog.nypl.org/record='

  const baseUrl = aeonBaseUrl + '/aeon/Aeon.dll?'

  const sierraItem = esItem.item
  const sierraBib = sierraItem.bibs()?.length ? sierraItem.bibs()[0] : null

  const accessMessageLabel = (firstValue(esItem.accessMessage()) || {}).label
  // Get the Item Type `display` value:
  const itemTypeLabel = Object.values(sierraItem?.fixedFields || {})
    .find((fixedField) => fixedField.label === 'Item Type')
    ?.display
  // Get edition from 250 $a if it exists:
  const edition = sierraBib?.varField('250', ['a'])
    .map((match) => match.value)
    .pop()
  // In addition to the typical title subfields a and b, also query k, f, and g:
  const extendedTitle = sierraBib?.varField('245', ['a', 'b', 'k', 'f', 'g'])
    .map((match) => match.parallel?.value || match.value)
    .map((s) => trimTrailingPunctuation(s))
    .pop()
  const useStatement = sierraBib?.varField('506', ['a'])
    .map((match) => match.value)
    .pop()
  const locationLabel = locationLabelMap[siteCode]
  const holdingLocationId = firstValue(esItem.holdingLocation())?.id?.split(':').pop()
  const isMaps = /^map/.test(holdingLocationId)
  const isReCAP = /^rc/.test(holdingLocationId)
  const itemVolume = sierraItem.fieldTag('v')[0]?.value
  const itemPublisher = sierraBib?.varFieldsMulti([
    { marc: '260', subfields: ['b', 'c'] },
    { marc: '264', subfields: ['b', 'c'] }
  ])
    .map((match) => match.parallel?.value || match.value)
    .map((s) => trimTrailingPunctuation(s))
    .pop()
  const bib651 = sierraBib?.varField('651')
    .map((match) => match.value)
    .pop()
  const item852 = sierraItem?.varField('852', ['m'])
    .map((match) => match.value)
    .pop()
  const bib852 = sierraBib?.varField('852', ['m'])
    .map((match) => match.value)
    .pop()

  const props = {
    Action: 10,
    Author: firstValue(esItem.esBib?.creatorLiteral()) || '',
    CallNumber: firstValue(esItem.shelfMark(false)) || '',
    Date: firstValue(esItem.esBib?.createdString()) || '',
    Form: 30,
    Genre: itemTypeLabel || '',
    ItemEdition: edition || '',
    ItemInfo1: accessMessageLabel || '',
    ItemInfo2: truncate(useStatement, 255) || '',
    ItemInfo3: bibUri ? `${catalogBaseUrl}${bibUri}` : '',
    ItemISxN: addSierraCheckDigit(itemUri),
    ItemNumber: firstValue(esItem.idBarcode()) || '',
    ItemPlace: firstValue(esItem.esBib?.placeOfPublication()) || '',
    ItemPublisher: itemPublisher,
    ItemVolume: itemVolume,
    Location: isReCAP ? 'ReCAP' : (locationLabel || ''),
    ReferenceNumber: addSierraCheckDigit(bibUri),
    Site: siteCode,
    SubLocation: isReCAP ? holdingLocationId : '',
    Title: truncate(extendedTitle, 255),
    'Transaction.CustomFields.Custom651': bib651,
    'Transaction.CustomFields.MapsLocationNote': item852 || bib852,
    // Only include SierraLocationCode for Maps items:
    'Transaction.CustomFields.SierraLocationCode': isMaps ? holdingLocationId : ''
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
