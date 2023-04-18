const EsBase = require('./base')
const accessMessageMapping = require('@nypl/nypl-core-objects')('by-accessMessages')
const sierraLocationMapping = require('@nypl/nypl-core-objects')('by-sierra-location')
const organizationMapping = require('@nypl/nypl-core-objects')('by-organizations')
const { pack } = require('../utils/packed-transform')

class EsItem extends EsBase {
  constructor (sierraItem) {
    super(sierraItem)
    this.item = sierraItem
    this.location = null
  }

  // requires utils.coreObjectsMappingByCode
  accessMessage () {
    let accessMessageCode = null
    const item = this.item
    if (item._isPartnerRecord()) {
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
        } else if (object.fixed('OPAC Message')) {
          accessMessageCode = object.fixed('OPAC Message')
        }
      }

      // If we didn't find the partner access message in 876 $h, default to In Library Use:
      if (!accessMessageCode) {
        accessMessageCode = '1'
      }

      // Otherwise it's ours; look for OPAC Message:
    } else if (object.fixed('OPAC Message')) {
      accessMessageCode = object.fixed('OPAC Message')
    }

    if (accessMessageCode) {
      // Look up code in accessmessages to make sure it's valid:
      const mapping = utils.coreObjectsMappingByCode(accessMessageMapping, accessMessageCode)
      if (mapping) {
        const accessmessageId = mapping.id.split(':').pop()
        return { id: `accessMessage:${accessmessageId}`, label: mapping.label }
      } else log.error('unmapped opac message? ' + accessMessage.code)
    }

    return null
  }

  accessMessage_packed () {
    return pack(this.accessMessage())
  }

  enumerationChronology () {
    return {
      literal: this.item.fieldTag('v')[0]
    }
  }

// needs sierraLocationMapping and logger
  holdingLocation () {
    if (this.location) return this.location
    let location = null
    const item = this.item
    if (item.location) {
      location = object.location.code
    }
    else {
      const altLocation = item.varField('852', ['b']
      if (altLocation) && altLocation.length > 0) location = altLocation
    }

    if (location && sierraLocationMapping[location]) {
      const holdingLocationId = `loc:${location.value}`
      const holdingLocationLabel = sierraLocationMapping[location].label
      this.location = { id: holdingLocationId, label: holdingLocationLabel }
    } else if (location) {
      // If it's an NYPL item, the extracted location should exist in our sierraLocationMapping, so warn:
      if (item.isNyplRecord()) log.warn('Location id not recognize: ', + location)
    }

    return this.location
  }

  holdingLocation_packed () {
    pack(this.holdingLocation())
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
        return { id: `orgs:${orgId}`, label: org.label }
      }
    } else if (this.holdingLocation()) {
      // Look up org by location
      const orgId = lookup('location-code-to-org-id', this.location)
      if (organizationMapping[orgId]) {
        const orgLabel = organizationMapping[orgId].label
        return { id: `orgs:${orgId}`, label: orgLabel}
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

    if (literal) return { literal }
    return null
  }
}
