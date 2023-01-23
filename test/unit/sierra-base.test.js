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
    xit('initializes NYPL bib with lots of parallel values', function () {
      // const record = new SierraBase(require('../fixtures/bib-11606020.json'))

      expect(false)
    })
    xit('initializes NYPL bib orphan parallel values', function () {
      // const record = new SierraBase(require('../fixtures/bib-11606020.json'))

      expect(false)
    })
  })

  describe('varField', function () {
    it('able to return tagged subfields', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      // Get title using all subfields
      const title = record.varField('245', null, { tagSubfields: true })
      expect(title).to.be.a('array')
      expect(title[0]).to.deep.equal({
        parallel: [],
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
    it.only('returns parallel values with no primary values', () => {
      const record = new SierraBase(require('../fixtures/bib-11606020.json'))
      const [varFieldValue] = record.varField(100, ['a'])
      expect(varFieldValue.parallel.value).to.equal()
      expect(varFieldValue.parallel.script).to.equal()
      expect(varFieldValue.parallel.subfieldMap).to.equal()
      expect(!varFieldValue.value)
    })
    it('returns parallel value attached to correct primary value', () => {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      const [{ value, subfieldMap, parallel }] = record.varField(130, ['a'])
      expect(value).to.equal('Toledot Yeshu.')
      expect(subfieldMap).to.deep.equal({
        a: 'Toledot Yeshu.'
      })
      expect(parallel).to.deep.equal({
        value: 'תולדות ישו.',
        script: '(2',
        direction: 'RTL',
        subfieldMap: {
          a: 'תולדות ישו.'
        }
      })
    })
  })
  describe('varFieldsMulti', () => {
    // these tests will check on the order that orphan parallels and primaries are returned in
  })

  // })
  describe('parallel', function () {
    it('parallel objects have value prop', () => {

    })
    it('parallel objects have subfieldMap prop', () => {

    })
    it('parallel objects have script and direction prop', () => {

    })
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
