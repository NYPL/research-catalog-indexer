const EsBase = require('./base')
const accessMessageMapping = require('@nypl/nypl-core-objects')('by-accessMessages')
const sierraLocationMapping = require('@nypl/nypl-core-objects')('by-sierra-location')
const organizationMapping = require('@nypl/nypl-core-objects')('by-organizations')
const catalogItemTypeMapping = require('@nypl/nypl-core-objects')('by-catalog-item-types')
const { pack } = require('../utils/packed-transform')
const { coreObjectsMappingByCode } = require('../utils/core-objects-mapping-by-code')
const itemMapping = require('../mappings/item-mapping.json')
const { primaryValues, parallelValues } = require('../utils/primary-and-parallel-values')
const  { ItemMappings } = require('../mappings/mappings')
const { lookup } = require('../utils/lookup')
const statusMapping = require('@nypl/nypl-core-objects')('by-statuses')

class EsItem extends EsBase {
  constructor (sierraItem) {
    super(sierraItem)
    this.item = sierraItem
    this.location = null
  }

  _accessMessageCode () {
    let accessMessageCode = null
    const item = this.item
    if (item.isPartnerRecord()) {
      let message = item.varField('876', ['h'])
      if (message && message.length > 0) {
        message = message.pop()

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

  // requires utils.coreObjectsMappingByCode
  accessMessage () {
    const accessMessageCode = this._accessMessageCode()

    if (accessMessageCode) {
      // Look up code in accessmessages to make sure it's valid:
      const mapping = coreObjectsMappingByCode(accessMessageMapping, accessMessageCode)
      if (mapping) {
        const accessmessageId = mapping.id.split(':').pop()
        return [{ id: `accessMessage:${accessmessageId}`, label: mapping.label }]
      } else log.error('unmapped opac message? ' + accessMessage.code)
    }

    return null
  }

  // check pack
  accessMessage_packed () {
    return pack(this.accessMessage())
  }

  catalogItemType () {
    const itemType = this.item.getItemType()

    if (itemType) {
      const catalogItemType = coreObjectsMappingByCode(catalogItemTypeMapping, String(itemType))
      if (catalogItemType) {
        const catalogItemTypeId = catalogItemType.id.split(':').pop()
        const catalogItemTypeEntity = { id: `catalogItemType:${catalogItemTypeId}`, label: catalogItemType.label }
        if (catalogItemType.requestable) catalogItemTypeEntity.requestable = catalogItemType.requestable
        return [catalogItemTypeEntity]
      }
    }

    return null
  }

  catalogItemType_packed () {
    return pack(this.catalogItemType())
  }

  enumerationChronology () {
    if (this.item.fieldTag('v') && this.item.fieldTag('v').length) {
      return [this.item.fieldTag('v')[0].value]
    }

    return null
  }

  _location () {
    if (this.location) return this.location
    let location = null
    const item = this.item
    if (item.location) {
      location = item.location.code
    }
    else {
      const altLocation = item.varField('852', ['b'])
      if (altLocation && altLocation.length > 0) location = altLocation
    }

    if (location && sierraLocationMapping[location]) {
      const holdingLocationId = `loc:${location}`
      const holdingLocationLabel = sierraLocationMapping[location].label
      this.location = { id: holdingLocationId, label: holdingLocationLabel, rawId: location }
    } else if (location) {
      // If it's an NYPL item, the extracted location should exist in our sierraLocationMapping, so warn:
      if (item.isNyplRecord()) log.warn('Location id not recognize: ', + location)
    }

    return this.location
  }

// needs sierraLocationMapping and logger
  holdingLocation () {
    const { id, label } = this._location()
    return [{ id, label }]
  }

  holdingLocation_packed () {
    return pack(this.holdingLocation())
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
      const org = utils.coreObjectsMappingByCode(organizationMapping, code)
      if (org) {
        const orgId = org.id.split(':').pop()
        return [{ id: `orgs:${orgId}`, label: org.label }]
      }
    } else if (this._location()) {
      // Look up org by location
      const orgId = lookup('lookup-location-code-to-org-id')[this._location().rawId]
      if (organizationMapping[orgId]) {
        const orgLabel = organizationMapping[orgId].label
        return [{ id: `orgs:${orgId}`, label: orgLabel}]
      }
    }

    return null
  }

  owner_packed () {
    return pack(this.owner())
  }

  recapCustomerCode () {
    const literal = null
    const item = this.item
    if (item.isNyplRecord() && item.recapCustomerCode) { literal = item.recapCustomerCode }
    else if (!item.isNyplRecord()) {
      literal = item.varField('900', ['b'])[0]
    }

    if (literal) return [ literal ]
    return null
  }

  requestable () {
    const requestableRationale = {}

    // calculate requestability of status
    const status = this.status()
    if (status) {
      requestableRationale.status = status.id === 'status:a'
    } else {
      requestableRationale.status = true
    }

    if (this.item.isNyplRecord()) {
      // calculate requestability of holding location for nypl items
      let locationRequestable = false
      const locationId = this._location() && this._location().rawId
      if (locationId) {
        locationRequestable = sierraLocationMapping[locationId] ? sierraLocationMapping[locationId].requestable : false
      }
      requestableRationale.loc = locationRequestable

      // calculate access message requestability
      let accessMessageRequestable = null
      const accessMessageCode = this._accessMessageCode()
      if (accessMessageCode) {
        // Look up code in accessmessages to make sure it's valid:
        const mapping = utils.coreObjectsMappingByCode(accessMessageMapping, accessMessageCode)
        if (mapping) {
          // Save the mapped `requestable` property for later `requestable` computation:
          accessMessageRequestable = mapping.requestable
        } else log.error('unmapped opac message? ' + accessMessageCode)
      }
      requestableRationale.opac = accessMessageRequestable !== false

      // calculate item type requestability
      const catalogItemType = this.catalogItemType()
      requestableRationale.type = !catalogItemType || catalogItemType.requestable
    }

    // Item is requestable if all conditions are true:
     return Object.keys(requestableRationale).reduce((requestable, condition) => requestable && requestableRationale[condition], true)

  }

  requestable () {
    const status = this.status()
    const statusRequestable = !status || status === 'status:'

    const nyplRecord = this.item.isNyplRecord()

    if (!nyplRecord) return statusRequestable

    const location = this._location()
    const locationId = location && location.rawId
    const sierraLocation = sierraLocationMapping[locationId]
    const locationRequestable = sierraLocationMapping && sierraLocationMapping.requestable

    const accessMessageCode = this._accessMessageCode()
    // Look up code in accessmessages to make sure it's valid:
    const mapping = accessMessageCode && utils.coreObjectsMappingByCode(accessMessageMapping, accessMessageCode)
    const accessMessageRequestable = !mapping || mapping.requestable !== false

    const catalogItemType = this.catalogItemType()
    const typeRequestable = !catalogItemType || catalogItemType.requestable

    return statusRequestable && locationRequestable && accessMessageRequestable && typeRequestable
  }

  _callNum () {
    let callnum
    let shelfMarkMarc = itemMapping.callNumber.paths[0].marc
    let shelfMarkSubfields = itemMapping.callNumber.paths[0].subfields
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
      const bibCallNum = getBibCallNum(bib)
      if (bibCallNum && bibCallNum.value) callnum = bibCallNum
    }
    // Sierra seems to put these '|h' prefixes on callnumbers; strip 'em
    if (callnum && typeof callnum == 'object' && callnum.value) {
      callnum = callnum.value
    }
    if (callnum) callnum = callnum.replace(/^\|h/, '')
    return callnum
  }

  // ToDO: getting callnum from bib
  shelfMark () {
    let callnum = this._callNum()
    // If not found in var field
    if (callnum) {
      // Pull callnumber suffix from fieldTag v if present
      var callnumSuffix = this.item.fieldTag('v')

      if (callnumSuffix && callnumSuffix.length) {
        callnum += ' ' + callnumSuffix[0].value
      }

      // Finally store the complete shelfMark data
      return [ callnum ]
    }
  }

  physicalLocation () {
    return [this._callNum()]
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
    } else if (item.varField('876', ['j']).length > 0) {
      // Mainly serving recap, mapp string statuses:
      status = { path: '876 $j' }
      let val = item.varField('876', ['j'])[0].toLowerCase()
      switch (val) {
        case 'available': status.id = 'a'; break
        case 'not available': status.id = 'na'; break
        case 'loaned': status.id = 'r'; break
      }
    }
    if (status) {
      // We either know the status id or the status code
      // Find the right entry in our status mapping based on which we identified:
      const statusMapped = status.id ? statusMapping[status.id]
        : utils.coreObjectsMappingByCode(statusMapping, status.code)
      if (statusMapped) {
        const statusId = statusMapped.id.split(':').pop()
        return [{ id: `status:${statusId}`, label: statusMapped.label.trim() }]
      } else logger.error('could not find status for:', status)
    }
  }

 // does match just mean == ?
  aeonUrl () {
    const baseAeonUrl = this.item.bibs
      .map((bib) => bib._aeonUrl())
      .filter((url) => url)
      .pop()

    if (!baseAeonUrl) return null

    const aeonUrl = baseAeonUrl
      .replace(/Site=[^&]+/, 'Site=' + this._aeonSiteCode())

    return [ aeonUrl ]
  }

  _aeonSiteCode () {
    return (this.item.fieldTag('x') || [])
      .filter((noteContent) => noteContent.startsWith('AEON eligible'))
      .map((noteContent) => noteContent.replace(/^AEON eligible /, ''))
      .shift()
  }

  idBarcode () {
    let barcode = null
    const item = this.item
    if (item.barcode) barcode = item.barcode
    else if (item.varField('876', ['p']).length) barcode = item.varField('876', ['p'])[0]
    if (barcode) return [barcode]
  }

  _identifier () {
    let identifiers = []
    let shelfMark = this.shelfMark()
    if (shelfMark) {
      identifiers = identifiers.concat(shelfMark.map((value) => ({
        value, type: 'bf:ShelfMark' }))
      )
    }
    let barcode = this.idBarcode()
    if (barcode && barcode.length) {
      barcode = { value: barcode[0], type: 'bf:Barcode' }
      identifiers.push(barcode)
    }
    return identifiers
  }

  identifierV2 () {
    return this._identifier()
  }

  identifier () {
    // Convert identifier entities into urn-style strings:
    const urnPrefixMap = {
      'bf:Barcode': 'barcode',
    }

    return this._identifier()
      .map((identifier) => {
        const prefix = urnPrefixMap[identifier.type] || 'identifier'
        const value = identifier.value
        return `urn:${prefix}:${value}`
      })
  }

  uri () {
    return `i${this.item.id}`
  }

  _barcode () {

  }

  type () {
    return [{id: 'bf:Item'}]
  }

}

module.exports = EsItem
