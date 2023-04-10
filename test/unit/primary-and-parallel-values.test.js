const { expect } = require('chai')

const { primaryValues, parallelValues } = require('../../lib/utils/primary-and-parallel-values')
const SierraBib = require('../../lib/sierra-models/bib')
const { BibMappings } = require('../../lib/mappings/mappings')

describe('primary and parallel values', () => {
  let bib
  before(() => {
    bib = new SierraBib(require('../fixtures/bib-11606020.json'))
  })
  describe('primaryValues', () => {
    it('should get primary values for given mappings from a model', () => {
      const mappings = BibMappings.get('title', bib)
      expect(primaryValues(bib.varFieldsMulti(mappings))).to.deep.equal(
        ['Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
    it('should return empty array when field is not on bib', () => {
      const mappings = BibMappings.get('seriesStatement', bib)
      expect(primaryValues(bib.varFieldsMulti(mappings))).to.deep.equal([])
    })
    it('should return empty string array for orphaned parallel with no .value', () => {
      const mappings = BibMappings.get('creatorLiteral', bib)
      expect(primaryValues(bib.varFieldsMulti(mappings))).to.deep.equal([''])
    })
    it('orphaned parallel subfields and primary subfields with parallels', () => {
      // This bib has a single primary 200 with a linked parallel and one orphaned parallel:
      bib = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      const mappings = [{ marc: '200', subfields: ['a', 'b'] }]
      expect(primaryValues(bib.varFieldsMulti(mappings))).to.deep.equal([
        '200 primary value a 200 primary value b',
        ''
      ])
    })
  })

  describe('parallelValues', () => {
    let bib
    before(() => {
      bib = new SierraBib(require('../fixtures/bib-11606020.json'))
    })
    it('should get parallel values for given mappings from a model', () => {
      const mappings = BibMappings.get('title', bib)
      expect(parallelValues(bib.varFieldsMulti(mappings))).to.deep.equal(
        [
          'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
    it('should return an empty string when no parallel value', () => {
      const mappings = BibMappings.get('contributorLiteral', bib)
      expect(parallelValues(bib.varFieldsMulti(mappings))).to.deep.equal([''])
    })

    it('should navigate parallel chaos', () => {
      bib = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      let mappings

      // This bib has a single primary 600 with a linked parallel that is tagged RTL
      mappings = BibMappings.get('subjectLiteral', bib)
      expect(parallelValues(bib.varFieldsMulti(mappings))).to.deep.equal(['\u200F600 parallel value a 600 parallel value b'])

      // This bib has a single orphaned parallel for marc 100 that is tagged RTL
      mappings = BibMappings.get('creatorLiteral', bib)
      expect(parallelValues(bib.varFieldsMulti(mappings))).to.deep.equal(['\u200F100 parallel value a 100 parallel value b'])

      // Note that we're ordering the orphaned parallel last even though its $u
      // has a subfield 6 number ('02') that is less than the non-orphaned
      // parallel's subfield 6 number ('03'). Ideeally we would present lower-
      // number values before higher value numbers, but orphaned parallels are
      // rare enough that just including their value at the end of the array is
      // sufficient for now.
      mappings = [{ marc: '200', subfields: ['a', 'b'] }]
      expect(parallelValues(bib.varFieldsMulti(mappings))).to.deep.equal([
        '\u200F200 parallel value a 200 parallel value b',
        '\u200F200 orphaned parallel value a 200 orphaned parallel value b'
      ])
    })

    it('should append \'\u200F\' to parallel.value if direction is rtl', () => {
    })
  })
})
