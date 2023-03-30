const expect = require('chai').expect

const SierraBib = require('../../lib/sierra-models/bib')
const EsBib = require('../../lib/es-models/bib')

describe('EsBib', function () {
  describe('constructor', function () {
    it('initializes an EsBib with a \'bib\' property', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.bib).to.eq(record)
    })
  })

  describe('uri', async function () {
    it('should return correctly prefixed uri for nypl bib', async function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      const uri = await esBib.uri()
      expect(uri).to.eq('b10001936')
    })

    it('should return correctly prefixed uri for partner bib', async function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      const uri = await esBib.uri()
      expect(uri).to.eq('hb990000453050203941')
    })
  })

  describe('title', function () {
    it('should return array of titles', function () {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.title()).to.deep.equal(
        ['Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })

  describe('parallelTitle', function () {
    it('should return array of parallel titles', function () {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelTitle()).to.deep.equal(
        [
          'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })

  describe('creatorLiteral', function () {
    it('should return the creator literal', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.creatorLiteral()).to.deep.equal(['Shermazanian, Galust.'])
    })
  })

  describe('parallelCreatorLiteral', function () {
    it('should return the parallel creator literals', function () {
      const record = new SierraBib(require('../fixtures/bib-hl-990137923810203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelCreatorLiteral()).to.deep.equal(
        ['بوريني، حسن احمد.']
      )
    })
  })

  describe('contentsTitle', function () {
    it('should return the contents title values in an array', function () {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      expect(esBib.contentsTitle()).to.deep.equal(
        [
          'The Theban necropolis.',
          'Theban temples.',
          'Memphis (Abû Rawâsh to Dahshûr).',
          'Lower and middle Egypt (Delta and Cairo to Asyût).',
          'Upper Egypt: sites (Deir Rîfa to Aswân, excluding Thebes and the temples of Abydos, Dendera, Esna, Edfu, Kôm Ombo and Philae).',
          'Upper Egypt : chief temples (excluding Thebes) : Abydos, Dendera, Esna, Edfu, Kôm Ombo, and Philae.',
          'Nubia, the deserts, and outside Egypt /',
          'Objects of provenance not known. Royal Statues. private Statues (Predynastic to Dynasty XVII) -- Private Statues (Dynasty XVIII to the Roman Periiod). Statues of Deities -- Indices to parts 1 and 2, Statues -- Stelae (Dynasty XVIII to the Roman Period) 803-044-050 to 803-099-990 /'
        ]
      )
    })
  })

  describe('contributor_sort', function () {
    it('should return the first contributor literal, truncated to 80 characters and lower case', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributor_sort()).to.equal('ginosar, sh. (shaleṿ), 1902-')
    })
  })

  describe('contributorLiteral', function () {
    it('should return the contributorLiteral', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributorLiteral()).to.deep.equal(
        [
          'Ginosar, Sh. (Shaleṿ), 1902-'
        ]
      )
    })
  })

  describe('parallelContributorLiteral', function () {
    it('should return parallel contributor fields', function () {
      const record = new SierraBib(require('../fixtures/bib-parallels-party.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelContributorLiteral()).to.deep.equal(
        ['parallel content for 710$a parallel content for 710$z']
      )
    })
  })

  describe('numItems', function () {
    it('should return 0', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.numItems()).to.equal(0)
    })
  })

  describe('type', function () {
    it('should return \'nypl:Item\'', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.type()).to.equal('nypl:Item')
    })
  })

  describe('nyplSource', function () {
    it('should return the source for partner items', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.nyplSource()).to.equal('recap-hl')
    })

    it('should return the source for NYPL items', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.nyplSource()).to.equal('sierra-nypl')
    })
  })
})
