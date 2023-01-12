const expect = require('chai').expect

const { primaryValues, parallelValues } = require('../lib/utils/utils')
const SierraBib = require('../lib/sierra-models/bib')
const { BibMappings } = require('../lib/mappings/mappings')

describe('primaryValues', () => {
  it('should get primary values for given mappings from a model', () => {
    const bib = new SierraBib(require('./fixtures/bib-11606020.json'))
    const mappings = BibMappings.get('title', bib)
    expect(primaryValues(mappings, bib)).to.deep.equal(
      ['880-02 Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.',
        '880-02 Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
      ]
    )
  })
})

describe('parallelValues', () => {
  it('should get parallel values for given mappings from a model', () => {
    const bib = new SierraBib(require('./fixtures/bib-11606020.json'))
    const mappings = BibMappings.get('title', bib)
    expect(parallelValues(mappings, bib)).to.deep.equal(
      [
        'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.',
        'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
      ]
    )
  })
})
