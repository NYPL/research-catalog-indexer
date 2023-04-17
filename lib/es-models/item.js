const EsBase = require('./base')
const accessMessageMapping = require('@nypl/nypl-core-objects')('by-accessMessages')

class EsItem extends EsBase {
  constructor (sierraItem) {
    super(sierraItem)
    this.item = sierraItem
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

  accessMessage_packed
}
