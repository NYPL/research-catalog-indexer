const expect = require('chai').expect

const SierraItem = require('../../lib/sierra-models/item')
const EsItem = require('../../lib/es-models/item')

describe.only('EsItem', function () {
  describe('constructor', function () {
    it('initializes an EsItem with an \'item\' property', function () {
      const record = new SierraItem(require('../fixtures/item-10003973.json'))
      const esItem = new EsItem(record)
      expect(esItem.item).to.eq(record)
    })
  })

  describe('accessMessage', function () {
    describe('for this specific record', function () {
      it('does something', function () {
        const record = new SierraItem(require('../fixtures/item-10003973.json'))
        const esItem = new EsItem(record)
        console.log('accessMessage: ', esItem.accessMessage())
        expect(esItem.item).to.eq(record)
      })
    })
    // describe('for a partner record', function () {
    //   describe('for a record with no 876h')
    //   desertscribe('for a record with \'in library use\'')
    //   describe('for a record with empty access message')
    //   describe('for a record with \'supervised use\'')
    //   describe('for a record with OPAC message')
    // })
    //
    // describe('for an nypl record', function () {
    //   describe('record has OPAC message')
    //   describe('record has no OPAC message')
    // })
  })

  describe('holdingLocation', function () {
    describe('for an item with location', function () {
      it('should return the location', function () {
        const record = new SierraItem(require('../fixtures/item-17145801.json'))
        const esItem = new EsItem(record)
        console.log('holdingLocation', esItem.holdingLocation())
        expect(esItem.holdingLocation()).to.deep.equal(
          [ { id: 'loc:rc2ma', label: 'Offsite' } ]
        )
      })
    })

    describe('for an item with altLocation', function () {

    })
  })


})
