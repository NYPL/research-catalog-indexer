const { firstValue, addSierraCheckDigit } = require('../utils')

const LOCATION_LABEL_MAP = {
  LPADN: 'ReCAP',
  LPADNAMI: 'ReCAP',
  LPAMR: 'ReCAP',
  LPAMRAMI: 'ReCAP',
  LPARF: 'LPA Reserve Film and Video Collection Special Collections material',
  LPATF: 'Library for the Performing Arts Theatre on Film and Tape Archive',
  LPATH: 'ReCAP',
  SASBG: 'Schwarzman Rare Book Division',
  SASBGSB: 'Berg Collection',
  SASJD: 'Dorot Jewish Division',
  SASMP: 'Schwarzman Map Division',
  SASMS: 'Schwarzman Manuscripts and Archives Division',
  SASPF: 'Schwarzman Pforzheimer Collection',
  SASPH: 'Wallach Prints and Photographs Division',
  SASPR: 'Wallach Prints and Photographs Division',
  SASRB: 'Schwarzman Rare Book Division',
  SCHMIRS: 'Schomburg Moving Images and Recorded Sound',
  SCHRB: 'Schomburg Center'
}

const aeonUrlForItem = async (esItem) => {
  if (!esItem._aeonSiteCode()) return null

  const aeonBaseUrl = process.env.AEON_BASE_URL || 'https://specialcollections.nypl.org'
  const catalogBaseUrl = process.env.CATALOG_BASE_URL || 'https://catalog.nypl.org/record='

  const baseUrl = aeonBaseUrl + '/aeon/Aeon.dll?'

  const bibUri = await esItem.esBib?.uri()
  const itemUri = await esItem.uri()
  const accessMessageLabel = (firstValue(esItem.accessMessage()) || {}).label
  const sierraBib = esItem.item.bibs() && esItem.item.bibs().length ? esItem.item.bibs()[0] : null
  const materialTypeLabel = sierraBib?.materialType?.value
  // Get edition from 250 $a if it exists:
  const edition = sierraBib?.varField('250', 'a')
    .map((match) => match.value)
    .pop()
  const locationLabel = LOCATION_LABEL_MAP[esItem._aeonSiteCode()]

  const props = {
    Action: 10,
    Form: 30,
    Title: firstValue(esItem.esBib?.title()),
    Site: esItem._aeonSiteCode(),
    CallNumber: firstValue(esItem.shelfMark()) || '',
    Author: firstValue(esItem.esBib?.creatorLiteral()) || '',
    ItemPlace: firstValue(esItem.esBib?.placeOfPublication()) || '',
    ItemPublisher: firstValue(esItem.esBib?.publisherLiteral()) || '',
    Date: firstValue(esItem.esBib?.createdString()) || '',
    ItemEdition: edition || '',
    ItemInfo3: bibUri ? `${catalogBaseUrl}${bibUri}` : '',
    ReferenceNumber: addSierraCheckDigit(bibUri),
    ItemInfo1: accessMessageLabel || '',
    ItemNumber: firstValue(esItem.idBarcode()) || '',
    ItemISxN: addSierraCheckDigit(itemUri),
    Genre: materialTypeLabel || '',
    Location: locationLabel || ''
  }
  const nonEmptyProps = Object.keys(props).reduce((h, k) => {
    if (props[k]) h[k] = props[k]
    return h
  }, {})

  return baseUrl + new URLSearchParams(nonEmptyProps).toString()
}

module.exports = {
  aeonUrlForItem
}
