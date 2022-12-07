const expect = require('chai').expect

const SierraBib = require('../lib/sierra-models/bib')
const EsBib = require('../lib/es-models/bib')

describe('EsBib', function () {
  describe('constructor', function () {
    it('initializes an EsBib with a \'bib\' property', function () {
      const record = new SierraBib(require('./fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.bib).to.eq(record)
    })
  })

  describe('uri', function () {
    it('should return correctly prefixed uri for nypl bib', function () {
      const record = new SierraBib(require('./fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.uri()).to.eq('b10001936')
    })

    it('should return correctly prefixed uri for partner bib', function () {
      const record = new SierraBib(require('./fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.uri()).to.eq('hb990000453050203941')
    })
  })

  describe('title', function () {
    it('should return array of titles', function () {
      const record = new SierraBib(require('./fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.title()).to.deep.equal(
        ['880-02 Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.',
          '880-02 Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })

  describe('parallelTitle', function () {
    it('should return array of parallel titles', function () {
      const record = new SierraBib(require('./fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelTitle()).to.deep.equal(
        [
          'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.',
          'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })

  describe('creatorLiteral', function () {
    it('should return the creator literal', function () {
      const record = new SierraBib(require('./fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.creatorLiteral()).to.deep.equal(['Shermazanian, Galust.'])
    })
  })

  // describe('parallelCreatorLiteral') // still looking for one of these
  // describe('contentsTitle') // still looking for one of these
  describe('contributor_sort', function () {
    it('should return the first contributor literal, truncated to 80 characters and lower case', function () {
      const record = new SierraBib(require('./fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributor_sort()).to.equal('ginosar, sh. (shaleṿ), 1902- ed.')
    })
  })

  describe('contributorLiteral', function () {
    it('should return the contributorLiteral', function () {
      const record = new SierraBib(require('./fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributorLiteral()).to.deep.equal(
        [
          'Ginosar, Sh. (Shaleṿ), 1902- ed.'
        ]
      )
    })
  })

  // describe('parallelContributorLiteral') // still looking for this
  describe('numItems', function () {
    it('should return 0', function () {
      const record = new SierraBib(require('./fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.numItems()).to.equal(0)
    })
  })

  describe('type', function () {
    it('should return \'nypl:Item\'', function () {
      const record = new SierraBib(require('./fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.type()).to.equal('nypl:Item')
    })
  })

  describe('nyplSource', function () {
    it('should return the source for partner items', function () {
      const record = new SierraBib(require('./fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.nyplSource()).to.equal('recap-hl')
    })

    it('should return the source for NYPL items', function () {
      const record = new SierraBib(require('./fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.nyplSource()).to.equal('sierra-nypl')
    })
  })
})
