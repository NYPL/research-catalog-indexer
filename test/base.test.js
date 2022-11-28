const expect = require('chai').expect

const SierraBase = require('../lib/sierra-models/base')

describe('SierraBase', function () {
  describe('constructor', function () {
    it('initializes NYPL SierraBase based on Sierra marcinjson', function () {
      const record = new SierraBase(require('./fixtures/bib-10001936.json'))
      expect(record.isNyplRecord()).to.eq(true)
      expect(record._isPartnerRecord()).to.eq(false)

      // Get callnumber
      const callNum = record.varField('852', ['h'])
      expect(callNum).to.be.a('array')
      expect(callNum[0].value).to.eq('*ONR 84-743')
    })

    it('initializes partner "SierraBase" based on SCSB marcinjson', function () {
      const record = new SierraBase(require('./fixtures/bib-hl990000453050203941.json'))
      expect(record._isPartnerRecord()).to.eq(true)

      // Get title
      const title = record.varField('245', ['a', 'b', 'c'])
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('ʻOrekh ha-din be-Yiśraʾel : maʻamado, zekhuyotaṿ ṿe-ḥovotaṿ : leḳeṭ dinim ṿe-halakhot / ba-ʻarikhat S. Ginosar.')
    })
  })

  describe('varField', function () {
    it('able to return tagged subfields', function () {
      const record = new SierraBase(require('./fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', null, { tagSubfields: true })
      expect(title).to.be.a('array')
      expect(title[0]).to.deep.equal({
        value: 'Niwtʻer azgayin patmutʻian hamar Ereveli hay kazunkʻ ; Parskastan / Ashkhatasirutʻiamb Galust Shermazaniani.',
        subfieldMap: {
          a: 'Niwtʻer azgayin patmutʻian hamar',
          b: 'Ereveli hay kazunkʻ ; Parskastan /',
          c: 'Ashkhatasirutʻiamb Galust Shermazaniani.'
        }
      })
    })

    it('able to return tagged subfields with certain subfields excluded', function () {
      const record = new SierraBase(require('./fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', null, { tagSubfields: true, excludedSubfields: ['b'] })
      expect(title).to.be.a('array')
      expect(title[0].subfieldMap).to.deep.equal({
        a: 'Niwtʻer azgayin patmutʻian hamar',
        c: 'Ashkhatasirutʻiamb Galust Shermazaniani.'
      })
    })

    it('able to return single string from all subfields', function () {
      const record = new SierraBase(require('./fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245')
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('Niwtʻer azgayin patmutʻian hamar Ereveli hay kazunkʻ ; Parskastan / Ashkhatasirutʻiamb Galust Shermazaniani.')
    })

    it('able to return single string from all subfields, excluding some subfields', function () {
      const record = new SierraBase(require('./fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', null, { excludedSubfields: ['b'] })
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('Niwtʻer azgayin patmutʻian hamar Ashkhatasirutʻiamb Galust Shermazaniani.')
    })

    it('able to return single string from certain subfields', function () {
      const record = new SierraBase(require('./fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', ['a', 'c'])
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('Niwtʻer azgayin patmutʻian hamar Ashkhatasirutʻiamb Galust Shermazaniani.')
    })
  })
})
