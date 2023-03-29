const { expect } = require('chai')

const { primaryValues, parallelValues } = require('../../lib/utils/primary-and-parallel-values')
const SierraBib = require('../../lib/sierra-models/bib')
const { BibMappings } = require('../../lib/mappings/mappings')

describe('primary and parallel values', () => {
  describe('primaryValues', () => {
    it('should get primary values for given mappings from a model', () => {
      const bib = new SierraBib(require('../fixtures/bib-11606020.json'))
      const mappings = BibMappings.get('title', bib)
      expect(primaryValues(bib.varFieldsMulti(mappings))).to.deep.equal(
        ['880-02 Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.',
          '880-02 Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })

  describe.only('parallelValues', () => {
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
    it('should append \'\u200F\' to parallel.value if direction is rtl', () => {
    })
  })
})
