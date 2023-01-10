const expect = require('chai').expect

const SierraBase = require('../../lib/sierra-models/base')

describe('SierraBase', function () {
  describe('constructor', function () {
    it('initializes NYPL SierraBase based on Sierra marcinjson', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      expect(record.isNyplRecord()).to.eq(true)
      expect(record._isPartnerRecord()).to.eq(false)

      // Get callnumber
      const callNum = record.varField('852', ['h'])
      expect(callNum).to.be.a('array')
      console.log(callNum)
      expect(callNum[0].value).to.eq('*ONR 84-743')
    })

    it('initializes partner "SierraBase" based on SCSB marcinjson', function () {
      const record = new SierraBase(require('../fixtures/bib-hl990000453050203941.json'))
      expect(record._isPartnerRecord()).to.eq(true)

      // Get title
      const title = record.varField('245', ['a', 'b', 'c'])
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('ʻOrekh ha-din be-Yiśraʾel : maʻamado, zekhuyotaṿ ṿe-ḥovotaṿ : leḳeṭ dinim ṿe-halakhot / ba-ʻarikhat S. Ginosar.')
    })
  })

  describe('varField', function () {
    it('able to return tagged subfields', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
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
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', null, { tagSubfields: true, excludedSubfields: ['b'] })
      expect(title).to.be.a('array')
      expect(title[0].subfieldMap).to.deep.equal({
        a: 'Niwtʻer azgayin patmutʻian hamar',
        c: 'Ashkhatasirutʻiamb Galust Shermazaniani.'
      })
    })

    it('able to return single string from all subfields', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245')
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('Niwtʻer azgayin patmutʻian hamar Ereveli hay kazunkʻ ; Parskastan / Ashkhatasirutʻiamb Galust Shermazaniani.')
    })

    it('able to return single string from all subfields, excluding some subfields', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', null, { excludedSubfields: ['b'] })
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('Niwtʻer azgayin patmutʻian hamar Ashkhatasirutʻiamb Galust Shermazaniani.')
    })

    it('able to return single string from certain subfields', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', ['a', 'c'])
      expect(title).to.be.a('array')
      expect(title[0].value).to.eq('Niwtʻer azgayin patmutʻian hamar Ashkhatasirutʻiamb Galust Shermazaniani.')
    })
  })
  describe('parallel', function () {
    it('extracts correct text direction when record has multiple parallels with different text directions', function () {
      const record = new SierraBase(require('../fixtures/bib-11606020.json'))

      const parallelTitle = record.parallel('245', ['a', 'b'])
      expect(parallelTitle).to.be.a('array')
      // This asserts that there is no leading '\u200F' at the start of the
      // title property, confirming a bug fix related to this record, where
      // the extracted 'rtl' text direction of one 880 was incorrectly applied
      // to a different 880 that should have been tagged 'ltr'
      expect(parallelTitle[0].value).to.eq('ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.')
      expect(parallelTitle[0].script).to.eq('(2')
      expect(parallelTitle[0].direction).to.eq('ltr')
      expect(parallelTitle[0].subfieldMap).to.deep.equal({ a: 'ספר תולדות ישו =', b: 'The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.' })
    })
  })
})
