const expect = require('chai').expect

const SierraBase = require('../../lib/sierra-models/base')
const SierraBib = require('../../lib/sierra-models/bib')

describe('SierraBase', function () {
  describe('constructor', function () {
    it('initializes NYPL SierraBase based on Sierra marcinjson', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      expect(record.isNyplRecord()).to.eq(true)
      expect(record.isPartnerRecord()).to.eq(false)

      // Get callnumber
      const callNum = record.varField('852', ['h'])
      expect(callNum).to.be.a('array')
      expect(callNum[0].value).to.eq('*ONR 84-743')
    })

    it('initializes partner "SierraBase" based on SCSB marcinjson', function () {
      const record = new SierraBase(require('../fixtures/bib-hl990000453050203941.json'))
      expect(record.isPartnerRecord()).to.eq(true)

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

    it('returns varField top-level content (i.e. not subfields) when subfields are not specified', function () {
      const record = new SierraBase(require('../fixtures/bib-10001936.json'))
      const oclc = record.varField('001')
      expect(oclc).to.deep.equal([
        {
          value: 'NYPG002001377-B'
        }
      ])
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
    it('returns orphan parallel values (no corresponding primary)', () => {
      const record = new SierraBase(require('../fixtures/bib-11606020.json'))
      const [varFieldValue] = record.varField(100, ['a'])
      expect(varFieldValue.parallel).to.deep.equal({
        value: 'ابن الكلبي.',
        subfieldMap: { a: 'ابن الكلبي.' },
        script: 'arabic',
        direction: 'rtl'
      })
      expect(!varFieldValue.value)
    })
    it('returns parallel value attached to correct primary value', () => {
      const record = new SierraBase(require('../fixtures/bib-11606020.json'))
      const varField130 = record.varField(130, ['a'])
      const [{ value, subfieldMap, parallel }] = varField130
      expect(value).to.equal('Toledot Yeshu.')
      expect(subfieldMap).to.deep.equal({
        a: 'Toledot Yeshu.'
      })
      expect(parallel).to.deep.equal({
        value: 'תולדות ישו.',
        script: 'hebrew',
        direction: 'rtl',
        subfieldMap: {
          a: 'תולדות ישו.'
        }
      })
    })
    it('extracts correct text direction when record has multiple parallels with different text directions', function () {
      const record = new SierraBase(require('../fixtures/bib-11606020.json'))

      const title = record.varField('245', ['a', 'b'])
      // This asserts that there is no leading '\u200F' at the start of the
      // title property, confirming a bug fix related to this record, where
      // the extracted 'rtl' text direction of one 880 was incorrectly applied
      // to a different 880 that should have been tagged 'ltr'
      expect(title[0].parallel.value).to.eq('ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.')
      expect(title[0].parallel.script).to.eq('hebrew')
      expect(title[0].parallel.direction).to.eq('ltr')
      expect(title[0].parallel.subfieldMap).to.deep.equal({ a: 'ספר תולדות ישו =', b: 'The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.' })
    })

    it('returns parallel value attached to correct primary value', () => {
      const record = new SierraBase(require('../fixtures/bib-parallels-chaos.json'))
      const varField600 = record.varField(600, ['a', 'b'])

      expect(varField600).to.deep.equal([
        {
          value: '600 primary value a 600 primary value b',
          subfieldMap: {
            a: '600 primary value a',
            b: '600 primary value b'
          },
          parallel: {
            value: '600 parallel value a 600 parallel value b',
            script: 'arabic',
            direction: 'rtl',
            subfieldMap: {
              a: '600 parallel value a',
              b: '600 parallel value b'
            }
          }
        }
      ])
    })

    it('returns orphaned parallel without any primary value in return', () => {
      const record = new SierraBase(require('../fixtures/bib-parallels-chaos.json'))
      const varField100 = record.varField(100, ['a', 'b'])

      expect(varField100).to.deep.equal([
        {
          parallel: {
            value: '100 parallel value a 100 parallel value b',
            script: 'arabic',
            direction: 'rtl',
            subfieldMap: {
              a: '100 parallel value a',
              b: '100 parallel value b'
            }
          }
        }
      ])
    })

    it('respects excludedSubfields for parallel values', () => {
      const record = new SierraBase(require('../fixtures/bib-parallels-chaos.json'))
      // Specifying marc query by subfield exclusion works on parallel:
      expect(record.varField(100, null, { excludedSubfields: ['b'] }).shift().value).to.be.a('undefined')
      expect(record.varField(100, null, { excludedSubfields: ['b'] }).shift().parallel.value).to.eq('100 parallel value a')
    })

    it('orders orphaned parallel last, arbitrarily', () => {
      const record = new SierraBase(require('../fixtures/bib-parallels-chaos.json'))
      const varField200 = record.varField(200, ['a', 'b'])

      expect(varField200[0].value).to.eq('200 primary value a 200 primary value b')
      expect(varField200[0].parallel.value).to.eq('200 parallel value a 200 parallel value b')
      expect(varField200[1].value).to.be.a('undefined')
      expect(varField200[1].parallel.value).to.eq('200 orphaned parallel value a 200 orphaned parallel value b')

      const varField300 = record.varField(300, ['a', 'b'])

      expect(varField300[0].value).to.eq('300 primary value a 300 primary value b')
      expect(varField300[0].parallel.value).to.eq('300 parallel value a 300 parallel value b')
      expect(varField300[1].value).to.be.a('undefined')
      expect(varField300[1].parallel.value).to.eq('300 orphaned parallel value a 300 orphaned parallel value b')
    })

    it('dedupes VarFieldMatches based on primary and parallel values', () => {
      // Contrive a record with 3 varfield 100 entries, two of them effectively dupes
      const record = new SierraBase({
        varFields: [
          // This one stands alone without a parallel:
          {
            marcTag: '100',
            subfields: [
              { tag: 'a', content: '$a content' }
            ]
          },
          // This one has a parallel:
          {
            marcTag: '100',
            subfields: [
              { tag: 'a', content: '$a content' },
              { tag: '6', content: '880-01' }
            ]
          },
          {
            marcTag: '880',
            subfields: [
              { tag: 'a', content: '$a parallel content' },
              { tag: '6', content: '100-01/...' }
            ]
          },
          // This one has different subfields in primary and parallel blocks
          // to the one above, but should be de-deduped because we're only
          // querying for $a
          {
            marcTag: '100',
            subfields: [
              { tag: 'a', content: '$a content' },
              { tag: 'b', content: '$b content' },
              { tag: '6', content: '880-02' }
            ]
          },
          {
            marcTag: '880',
            subfields: [
              { tag: 'a', content: '$a parallel content' },
              { tag: 'b', content: '$b parallel content' },
              { tag: '6', content: '100-02/...' }
            ]
          }
        ]
      })

      const varField100 = record.varField(100, ['a'])
      expect(varField100).to.be.a('array')
      expect(varField100).to.have.lengthOf(2)
      expect(varField100[0].value).to.equal('$a content')
      expect(varField100[0].parallel).to.be.a('undefined')
      expect(varField100[1].value).to.equal('$a content')
      expect(varField100[1].parallel.value).to.equal('$a parallel content')
    })
  })

  describe('varFieldsMulti', () => {
    it('more paths in bib-mappings.json than fields in fixture', () => {
      const bib = new SierraBib(require('../fixtures/bib-11606020.json'))
      // the fixture only has a 791 field for contributorLiteral, but there
      // are five possible tags for that field. The returned array should
      // only have one element.
      const mappings = [
        { marc: '700', subfields: ['a', 'b', 'c', 'q', 'd', 'j'] },
        { marc: '710', excludedSubfields: ['0', '6'] },
        { marc: '711', excludedSubfields: ['0', '6'] },
        { marc: '720', excludedSubfields: ['0', '6'] },
        { marc: '791', excludedSubfields: ['0', '6'] }
      ]
      const varFields = bib.varFieldsMulti(mappings)
      expect(varFields).to.deep.equal([
        {
          value: 'Schiff Collection.',
          subfieldMap: { a: 'Schiff Collection.' }
        }
      ])
    })
  })

  describe('_removeRedundantOrphans', () => {
    it('de-dupes redundant orphaned parallels', () => {
      let matches = [
        { value: 'v1' },
        {
          value: 'v2',
          parallel: {
            value: 'v2 parallel'
          }
        },
        // We expect this one to be removed because it's redundant next to the one above:
        { parallel: { value: 'v2 parallel' } }
      ]
      expect(SierraBase.prototype._uniqueVarFieldMatches(matches)).to.deep.equal(matches.slice(0, 2))

      matches = [
        // We expect this one to be removed because it's redundant given the last one:
        { value: 'v1' },
        {
          value: 'v2',
          parallel: {
            value: 'v2 parallel'
          }
        },
        { value: 'v1', parallel: { value: 'v1 parallel' } }
      ]
      expect(SierraBase.prototype._removeRedundantOrphans(matches)).to.deep.equal(matches.slice(1, 3))
    })
  })

  describe('_uniqueVarFieldMatches', () => {
    it('de-dupes matches with identical primary and parallel values', () => {
      const matches = [
        { value: 'v1' },
        {
          value: 'v2',
          parallel: {
            value: 'v2 parallel'
          }
        },
        // We expect these next two to be removed because they exactly match
        // the first two:
        { value: 'v1' },
        {
          value: 'v2',
          parallel: {
            value: 'v2 parallel'
          }
        }
      ]
      expect(SierraBase.prototype._uniqueVarFieldMatches(matches)).to.deep.equal(matches.slice(0, 2))

      // Add a redundant orphan:
      matches.push({
        parallel: {
          value: 'v2 parallel'
        }
      })
      // Should remove redundant orphan:
      expect(SierraBase.prototype._uniqueVarFieldMatches(matches)).to.deep.equal(matches.slice(0, 2))
    })
  })
})
