const expect = require('chai').expect

const SierraItem = require('../../lib/sierra-models/item')
const EsItem = require('../../lib/es-models/item')

describe('EsItem', function () {
  describe('constructor', function () {
    it('initializes an EsItem with an \'item\' property', function () {
      const record = new SierraItem(require('../fixtures/item-10003973.json'))
      const esItem = new EsItem(record)
      expect(esItem.item).to.eq(record)
    })
  })

  describe('accessMessage', function () {
    // describe('for a partner record', function () {
    //   describe('for a record with no 876h')
    //   desertscribe('for a record with \'in library use\'')
    //   describe('for a record with empty access message')
    //   describe('for a record with \'supervised use\'')
    //   describe('for a record with OPAC message')
    // })
    //
    describe('for an nypl record', function () {
      describe('record has OPAC message', function () {
        it('should return the correct values', function () {
          const record = new SierraItem(require('../fixtures/item-17145801.json'))
          const esItem = new EsItem(record)
          expect(esItem.accessMessage()).to.deep.eq([{ id: 'accessMessage:u', label: 'Supervised use' }])
        })
      })
      // describe('record has no OPAC message')
    })
  })

  describe('accessMessage_packed', function () {
    describe('for an nypl record', function () {
      describe('record has OPAC message', function () {
        it('should return the correct values', function () {
          const record = new SierraItem(require('../fixtures/item-17145801.json'))
          const esItem = new EsItem(record)
          expect(esItem.accessMessage_packed()).to.deep.eq(
            [
              'accessMessage:u||Supervised use'
            ]
          )
        })
      })
    })
  })

  describe('catalogItemType', function () {
    it('should return mapped item type if present', function () {
      const record = new SierraItem(require('../fixtures/item-17145801.json'))
      const esItem = new EsItem(record)
      expect(esItem.catalogItemType()).to.deep.equal(
        [{ id: 'catalogItemType:33', label: 'google project, serial' }]
      )
    })

    it('should return null if no item type')
    it('should return null if item type not found')
    it('should return requestable in case property is set')
  })

  describe('catalogItemType_packed', function () {
    it('should return mapped item type if present', function () {
      const record = new SierraItem(require('../fixtures/item-17145801.json'))
      const esItem = new EsItem(record)
      expect(esItem.catalogItemType_packed()).to.deep.equal(
        [
          'catalogItemType:33||google project, serial'
        ]
      )
    })
  })

  describe('enumerationChronology', function () {
    it('should return enumeration chronology', function () {
      const record = new SierraItem(require('../fixtures/item-17145801.json'))
      const esItem = new EsItem(record)
      expect(esItem.enumerationChronology()).to.deep.equal(
        ['no. 12 (1784)']
      )
    })

    it('should return null in case no enumeration chronology is present')
  })

  describe('holdingLocation', function () {
    describe('for an item with location', function () {
      it('should return the location', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.holdingLocation()).to.deep.equal(
          [{ id: 'loc:rc2ma', label: 'Offsite' }]
        )
      })
    })

    describe('for an item with altLocation', function () {

    })

    describe('for an item with unmapped location', function () {

    })
  })

  describe('holdingLocation_packed', function () {
    describe('for an item with location', function () {
      it('should return the location', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.holdingLocation_packed()).to.deep.equal(
          ['loc:rc2ma||Offsite']
        )
      })
    })
  })

  describe('idBarcode', function () {
    describe('for an item with barcode', function () {
      it('should return the barcode', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.idBarcode()).to.deep.equal(['33433081745998'])
      })
    })

    describe('for an item with 876p', function () {

    })

    describe('for an item with missing barcode', function () {})
  })

  describe('identifier', function () {
    describe('for an item with barcode and callnum', function () {
      it('should return the prefixed barcode and callnum', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.identifier()).to.deep.equal([
          'urn:shelfmark:*DM (Esprit des Journaux, françois et etrangers) no. 12 (1784)',
          'urn:barcode:33433081745998'
        ])
      })
    })
  })

  describe('identifierV2', function () {
    describe('for an nypl item with shelfmark and barcode', function () {
      it('should return the barcode and shelfmark entities', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.identifierV2()).to.deep.equal(
          [
            {
              value: '*DM (Esprit des Journaux, françois et etrangers) no. 12 (1784)',
              type: 'bf:ShelfMark'
            },
            {
              type: 'bf:Barcode',
              value: '33433081745998'
            }
          ]
        )
      })
    })
  })

  describe('shelfMark', function () {
    describe('for an item with callNumber', function () {
      it('should return the call number', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.shelfMark()).to.deep.equal(
          [
            '*DM (Esprit des Journaux, françois et etrangers) no. 12 (1784)'
          ]
        )
      })
    })
  })

  describe('shelfMark_sort', function () {
    describe('for an item with callNumber', function () {
      it('should return the call number', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.shelfMark_sort()).to.equal(
          'a*DM (Esprit des Journaux, françois et etrangers) no. 000012 (1784)'
        )
      })
    })
  })

  describe('owner', function () {
    describe('nypl item with location', function () {
      it('should return the properly mapped owner', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.owner()).to.deep.equal(
          [
            {
              id: 'orgs:1000',
              label: 'Stephen A. Schwarzman Building'
            }
          ]
        )
      })
    })

    describe('for a partner record', function () {

    })
  })

  describe('owner_packed', function () {
    describe('nypl item with location', function () {
      it('should return the properly mapped owner', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.owner_packed()).to.deep.equal(
          [
            'orgs:1000||Stephen A. Schwarzman Building'
          ]
        )
      })
    })
  })

  describe('physicalLocation', function () {
    describe('nypl item with location', function () {
      const record = new SierraItem(require('../fixtures/item-17145801.json'))
      const esItem = new EsItem(record)
      expect(esItem.physicalLocation()).to.deep.equal(
        [
          '*DM (Esprit des Journaux, françois et etrangers)'
        ]
      )
    })
  })

  describe('recapCustomerCode', function () {
    describe('nypl record with recapCustomerCode', function () {
      it('should return the recapCustomerCode', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        record._recapCustomerCode = 'NA'
        const esItem = new EsItem(record)
        expect(esItem.recapCustomerCode()).to.deep.equal(['NA'])
      })
    })
  })

  describe('requestable', function () {
    // ToDo: requestable partner, non-requestable partner, nypl without
    // requestable status, nypl without reqestable location, nypl
    // without requestable accessMessage code, ...
    describe('requestable nypl record', function () {
      it('should be requestable', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.requestable()).to.deep.equal([true])
      })
    })
  })

  describe('status', function () {
    describe('nypl item with status', function () {
      it('should return the properly mapped status entity', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        expect(esItem.status()).to.deep.equal(
          [
            {
              id: 'status:a',
              label: 'Available'
            }
          ]
        )
      })
    })

    describe('item with varField 876j', function () {

    })
  })

  describe('type', function () {
    it('should return [{id: \'bf:Item\'}]', function () {
      const record = new SierraItem(require('../fixtures/item-17145801.json'))
      const esItem = new EsItem(record)
      expect(esItem.type()).to.deep.equal(['bf:Item'])
    })
  })

  describe('uri', function () {
    it('should return the id', async function () {
      const record = new SierraItem(require('../fixtures/item-17145801.json'))
      const esItem = new EsItem(record)
      const uri = await esItem.uri()
      expect(uri).to.equal('i17145801')
    })

    it('should return the right prefixed id if partner', async function () {
      const record = new SierraItem(require('../fixtures/item-pul-7834127.json'))
      const esItem = new EsItem(record)
      const uri = await esItem.uri()
      expect(uri).to.equal('pi7834127')
    })
  })
})
