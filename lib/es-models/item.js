const accessMessageMapping = require('@nypl/nypl-core-objects')('by-accessMessages')
const sierraLocationMapping = require('@nypl/nypl-core-objects')('by-sierra-location')
const organizationMapping = require('@nypl/nypl-core-objects')('by-organizations')
const catalogItemTypeMapping = require('@nypl/nypl-core-objects')('by-catalog-item-types')

const EsBase = require('./base')
const logger = require('../logger')
const { pack } = require('../utils/packed-transform')
const { coreObjectsMappingByCode } = require('../utils/core-objects-mapping-by-code')
const itemMapping = require('../mappings/item-mapping.json')
const { lookup } = require('../utils/lookup')
const statusMapping = require('@nypl/nypl-core-objects')('by-statuses')
const { parseVolume } = require('../utils/volume-parse')
const parseDate = require('../utils/item-date-parse')
const { arrayToEsRangeObject, enumerationChronologySortFromEsRanges } = require('../utils/es-ranges')
const { uriForRecordIdentifier } = require('../utils/uriForRecordIdentifier')
const { aeonUrlForItem } = require('../utils/aeon-urls')

class EsItem extends EsBase {
  constructor (sierraItem, esBib) {
    super(sierraItem)
    this.item = sierraItem
    this.esBib = esBib
    this.location = null
  }

  // requires utils.coreObjectsMappingByCode
  accessMessage () {
    const accessMessageCode = this._accessMessageCode()

    if (accessMessageCode) {
      // Look up code in accessmessages to make sure it's valid:
      const mapping = coreObjectsMappingByCode(accessMessageMapping, accessMessageCode)
      if (mapping) {
        const accessmessageId = mapping.id.split(':').pop()
        return [{ id: `accessMessage:${accessmessageId}`, label: mapping.label }]
      } else logger.error('unmapped opac message? ' + accessMessageCode)
    }

    return null
  }

  // check pack
  accessMessage_packed () {
    return pack(this.accessMessage())
  }

  async aeonUrl () {
    const aeonUrl = await aeonUrlForItem(this)
    return aeonUrl ? [aeonUrl] : null
  }

  catalogItemType () {
    const itemType = this.item.getItemType()

    if (itemType) {
      const catalogItemType = coreObjectsMappingByCode(catalogItemTypeMapping, String(itemType))
      if (catalogItemType) {
        const catalogItemTypeId = catalogItemType.id.split(':').pop()
        const catalogItemTypeEntity = { id: `catalogItemType:${catalogItemTypeId}`, label: catalogItemType.label }
        return [catalogItemTypeEntity]
      }
    }

    return null
  }

  catalogItemType_packed () {
    return pack(this.catalogItemType())
  }

  dateRange () {
    const fieldtagV = this.item.fieldTag('v')[0]
    if (fieldtagV) {
      const parsedDates = parseDate.checkCache(fieldtagV.value)
      if (parsedDates && parsedDates.length) {
        return parsedDates.map(arrayToEsRangeObject)
      }
    }
  }

  dueDate () {
    const dueDate = this.item.status && this.item.status.duedate
      ? this.item.status.duedate.split('T')[0]
      : null
    if (!dueDate) return null
    return [dueDate]
  }

  enumerationChronology () {
    const fieldTagVs = this.item.fieldTag('v')
    if (fieldTagVs.length && fieldTagVs[0].value) {
      return [fieldTagVs[0].value]
    }

    return null
  }

  /**
   *  Get a custom string that serves as the sortable form of
   *  enumeration-chronolgy
   */
  enumerationChronology_sort () {
    const sortValue = enumerationChronologySortFromEsRanges(this.volumeRange(), this.dateRange())
    return sortValue ? [sortValue] : null
  }

  formatLiteral () {
    const bibMaterialType = this.esBib.materialType()
    if (bibMaterialType && bibMaterialType.length) {
      return [bibMaterialType[0].label]
    }
  }

  // needs sierraLocationMapping and logger
  holdingLocation () {
    const location = this._location()
    if (!location) return null
    const { id, label } = location
    return [{ id, label }]
  }

  holdingLocation_packed () {
    return pack(this.holdingLocation())
  }

  idBarcode () {
    let barcode = null
    const item = this.item
    if (item.barcode) barcode = item.barcode
    else if (item.varField('876', ['p']).length) barcode = item.varField('876', ['p'])[0]
    if (barcode) return [barcode]
  }

  identifier () {
    // Convert identifier entities into urn-style strings:
    const urnPrefixMap = {
      'bf:Barcode': 'barcode',
      'bf:ShelfMark': 'shelfmark'
    }

    return this._identifier()
      .map((identifier) => {
        const prefix = urnPrefixMap[identifier.type] || 'identifier'
        const value = identifier.value
        return `urn:${prefix}:${value}`
      })
  }

  identifierV2 () {
    return this._identifier()
  }

  m2CustomerCode () {
    // Use value attached in general-prefetch, if any
    return this.item._m2CustomerCode ? [this.item._m2CustomerCode] : null
  }

  physicalLocation () {
    const callnum = this._callNum()
    return callnum ? [callnum] : []
  }

  // requires utils.coreObjectsMappingByCode and lookup location-code-to-org-id
  owner () {
    const item = this.item
    // Assign organization ("Content owner")
    if (item.isPartnerRecord()) {
      // If nyplSource is recap-pul, look up owner by code 'PUL'
      const code = item.nyplSource.replace('recap-', '').toUpperCase()
      // Get organization by code (e.g. "PUL", "CUL")
      // which is stored in `code` (skos:notation) in the mapping:
      const org = coreObjectsMappingByCode(organizationMapping, code)
      if (org) {
        const orgId = org.id.split(':').pop()
        return [{ id: `orgs:${orgId}`, label: org.label }]
      }
    } else if (this._location()) {
      // Look up org by location
      const orgId = lookup('lookup-location-code-to-org-id')[this._location().rawId]
      if (organizationMapping[orgId]) {
        const orgLabel = organizationMapping[orgId].label
        return [{ id: `orgs:${orgId}`, label: orgLabel }]
      }
    }

    return null
  }

  owner_packed () {
    return pack(this.owner())
  }

  recapCustomerCode () {
    let literal = null
    const item = this.item
    if (item.isNyplRecord() && item._recapCustomerCode) {
      literal = item._recapCustomerCode
    } else if (!item.isNyplRecord()) {
      literal = item.varField('900', ['b'])[0]?.value
    }

    if (literal) return [literal]
    return null
  }

  requestable () {
    const status = this.status()
    const statusRequestable = !status || !status.length || status[0].id === 'status:a'

    const nyplRecord = this.item.isNyplRecord()

    if (!nyplRecord) return [statusRequestable]

    const location = this._location()
    let locationId = null
    if (location) locationId = location.rawId
    const sierraLocation = sierraLocationMapping[locationId]
    const locationRequestable = Boolean(sierraLocation && sierraLocation.requestable)

    const accessMessageCode = this._accessMessageCode()
    // Look up code in accessmessages to make sure it's valid:
    const mapping = accessMessageCode && coreObjectsMappingByCode(accessMessageMapping, accessMessageCode)
    const accessMessageRequestable = !mapping || mapping.requestable !== false

    let typeRequestable = true
    const itemType = this.item.getItemType()
    let catalogItemType = null
    if (itemType) catalogItemType = coreObjectsMappingByCode(catalogItemTypeMapping, String(itemType))
    if (catalogItemType) typeRequestable = catalogItemType.requestable

    return [statusRequestable && locationRequestable && accessMessageRequestable && typeRequestable]
  }

  // ToDO: getting callnum from bib
  shelfMark (addVolume = true) {
    let callnum = this._callNum()
    // If not found in var field
    if (callnum) {
      if (addVolume) {
        // Pull callnumber suffix from fieldTag v if present
        const callnumSuffix = this.item.fieldTag('v')[0]?.value

        if (callnumSuffix) {
          callnum += ' ' + callnumSuffix
        }
      }

      // Finally store the complete shelfMark data
      return [callnum]
    }
  }

  shelfMark_sort () {
    return this._sortableShelfMark()
  }

  // trim ? coreObjectsMappingByCode
  status () {
    // Availability
    let status = null
    const item = this.item
    // Look for a truthy status.code
    if (item.isNyplRecord() && item.status && item.status.code && item.status.code.trim()) {
      status = { path: 'status' }
      if (item.status.code === '-') {
        // Code '-' matches both Available and Loaned (!!!) so, check duedate
        status.id = item.status.duedate ? 'co' : 'a'
      } else {
        status.code = item.status.code
      }
    } else {
      const statusMatches = item.varField('876', ['j'])
      if (statusMatches.length && statusMatches[0]?.value) {
        // Mainly serving recap, mapp string statuses:
        status = { path: '876 $j' }
        const val = statusMatches[0].value.toLowerCase()
        switch (val) {
          case 'available': status.id = 'a'; break
          case 'not available': status.id = 'na'; break
          case 'loaned': status.id = 'r'; break
        }
      }
    }
    if (status) {
      // We either know the status id or the status code
      // Find the right entry in our status mapping based on which we identified:
      const statusMapped = status.id
        ? statusMapping[status.id]
        : coreObjectsMappingByCode(statusMapping, status.code)
      if (statusMapped) {
        const statusId = statusMapped.id.split(':').pop()
        return [{ id: `status:${statusId}`, label: statusMapped.label.trim() }]
      } else logger.error('could not find status for:', status)
    }
  }

  status_packed () {
    return pack(this.status())
  }

  type () {
    return ['bf:Item']
  }

  uri () {
    return uriForRecordIdentifier(this.item.nyplSource, this.item.id, 'item')
  }

  volumeRange () {
    const fieldtagV = this.item.fieldTag('v')[0]
    if (fieldtagV) {
      const parsedVols = parseVolume(fieldtagV.value)
      if (parsedVols && parsedVols.length) {
        return parsedVols.map(arrayToEsRangeObject)
      }
    }
  }

  _accessMessageCode () {
    let accessMessageCode = null
    const item = this.item
    if (item.isPartnerRecord()) {
      let message = item.varField('876', ['h'])
      if (message && message.length > 0) {
        message = message.pop()?.value

        // If 876 $h is 'IN LIBRARY USE' or [blank]:
        if (message.toLowerCase() === 'in library use' || message.toLowerCase() === '') {
          accessMessageCode = '1'

          // If 876 $h is SUPERVISED USE:
        } else if (message.toLowerCase() === 'supervised use') {
          accessMessageCode = 'u'

          // If 876 $h is set to anything else, try using fixed "OPAC Message"
        } else if (item.fixed('OPAC Message')) {
          accessMessageCode = item.fixed('OPAC Message')
        }
      }

      // If we didn't find the partner access message in 876 $h, default to In Library Use:
      if (!accessMessageCode) {
        accessMessageCode = '1'
      }

      // Otherwise it's ours; look for OPAC Message:
    } else if (item.fixed('OPAC Message')) {
      accessMessageCode = item.fixed('OPAC Message')
    }

    return accessMessageCode
  }

  _aeonSiteCode () {
    return (this.item.fieldTag('x') || [])
      .map(noteContent => noteContent && noteContent.value)
      .filter((noteContent) => noteContent && noteContent.startsWith('AEON eligible'))
      .map((noteContent) => noteContent && noteContent.replace(/^AEON eligible /, ''))
      .shift()
  }

  _callNum () {
    let callnum
    const shelfMarkMarc = itemMapping.callNumber.paths[0].marc
    const shelfMarkSubfields = itemMapping.callNumber.paths[0].subfields
    const item = this.item
    if (item.varField(shelfMarkMarc, ['h'])) {
      callnum = item.varField(shelfMarkMarc, shelfMarkSubfields)[0]
    }
    // If not found in var field
    if (!callnum) callnum = item.callNumber
    // If not yet found, look in 945 $g
    if (!callnum && item.varField('945', ['g']).length > 0) callnum = item.varField('945', ['g'])[0]
    // If not found, default to callnum from bib
    if (!callnum) {
      const bibCallNum = this.esBib && this.esBib._callNum()
      if (bibCallNum && bibCallNum.value) callnum = bibCallNum
    }
    // Sierra seems to put these '|h' prefixes on callnumbers; strip 'em
    if (callnum && typeof callnum === 'object' && callnum.value) {
      callnum = callnum.value
    }
    if (callnum) callnum = callnum.replace(/^\|h/, '')
    return callnum
  }

  _location () {
    if (this.location) return this.location
    let location = null
    const item = this.item
    if (item.location) {
      location = item.location.code
    } else {
      const altLocation = item.varField('852', ['b'])
      if (altLocation && altLocation.length > 0) location = altLocation
    }

    if (location && sierraLocationMapping[location]) {
      const holdingLocationId = `loc:${location}`
      const holdingLocationLabel = sierraLocationMapping[location].label
      this.location = { id: holdingLocationId, label: holdingLocationLabel, rawId: location }
    } else if (location) {
      // If it's an NYPL item, the extracted location should exist in our sierraLocationMapping, so warn:
      if (item.isNyplRecord()) logger.warn(`Location id not recognized for item ${this.item.id}: '${location}'`)
    }

    return this.location
  }

  _identifier () {
    let identifiers = []
    const shelfMark = this.shelfMark()
    if (shelfMark) {
      identifiers = identifiers.concat(shelfMark.map((value) => (
        {
          value,
          type: 'bf:ShelfMark'
        }))
      )
    }
    let barcode = this.idBarcode()
    if (barcode && barcode.length) {
      barcode = { value: barcode[0], type: 'bf:Barcode' }
      identifiers.push(barcode)
    }
    return identifiers
  }
}

module.exports = EsItem
