const expect = require('chai').expect

const SierraBib = require('../../lib/sierra-models/bib')
const EsBib = require('../../lib/es-models/bib')

describe.only('EsBib', function () {
  describe('_valueToIndexFromBasicMapping', () => {
    it('should return an array of primary values', () => {
      const field = 'title'
      const primary = true
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-11606020.json')))
      expect(bib._valueToIndexFromBasicMapping(field, primary)).to.deep.equal(['Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
      ])
    })
    it('should return array of parallel titles', function () {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      const primary = false
      const field = 'title'
      expect(esBib._valueToIndexFromBasicMapping(field, primary)).to.deep.equal(
        [
          'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })
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

  describe('title_sort', () => {
    it('should return title transformed for sorting', function () {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.title_sort()).to.deep.equal(
        ['sefer toldot yeshu  the gospel according to the jews called toldoth jesu  the generations of jesus now first translated from the hebrew']
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

  describe('creator_sort', () => {
    it('should return the creator transformed for sorting', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.creator_sort()).to.deep.equal('shermazanian, galust.')
    })
  })

  describe('dates', () => {
    it('_dateCreated returns date by publishYear', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      console.log(esBib._dateCreated())
      expect(esBib._dateCreated()).to.deep.equal(1977)
    })
    it('_dateCreated returns date by 008', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib._dateCreated()).to.deep.equal(1977)
    })
    it('dateStartYear returns _dateCreated value', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib.dateStartYear()).to.deep.equal(1977)
    })
    it('created returns _dateCreated value', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib.created()).to.deep.equal(1977)
    })
  })

  describe('dimensions', () => {
    it('should return dimensions', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.dimensions()).to.deep.equal(['21 cm.'])
    })
  })

  describe('donor', () => {
    it('should return donor', () => {
      const record = new SierraBib(require('../fixtures/bib-11655934.json'))
      const esBib = new EsBib(record)
      expect(esBib.donor()).to.deep.equal(['National Endowment for the Humanities Preservation Grant 2, 1992/1994.'])
    })
  })

  describe('extent', () => {
    it('should return array containing extent', () => {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      expect(esBib.extent()).to.deep.equal(['volumes : maps, plans ;'])
    })
  })

  describe('formerTitle', () => {
    it('should return array with former title', () => {
      const record = new SierraBib(require('../fixtures/bib-11655934.json'))
      const esBib = new EsBib(record)
      expect(esBib.formerTitle()).to.deep.equal(['Reports of Regents and of the President -1896'])
    })
  })

  describe('genreForm', () => {
    it('should return array with genre form', () => {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      expect(esBib.genreForm()).to.deep.equal(['Bibliography.'])
    })
  })

  describe('_sortify', () => {
    it('should return the first value of the array, truncated, and lower cased', () => {
      const _this = { stub: () => [Array.from(90).map(() => 'A').join(), 'another'] }
      expect(EsBib.prototype._sortify('stub', _this)).to.equal(Array.from(80).map(() => 'a').join())
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
    it('should return array of the contributorLiteral', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributorLiteral()).to.deep.equal(
        [
          'Ginosar, Sh. (Shaleṿ), 1902-'
        ]
      )
    })
  })

  describe('identifier', () => {
    it('should return array of identifiers', () => {
      const record = new SierraBib(require('../fixtures/bib-identifiers.json'))
      const esBib = new EsBib(record)
      expect(esBib.identifier()).to.deep.equal(['9782810703753 (pbk.)', '9782810703753', '(OCoLC)953527732'])
    })
  })

  describe('identifierV2', () => {
    it('should return array of identifiers', () => {
      const record = new SierraBib(require('../fixtures/bib-identifiers.json'))
      const esBib = new EsBib(record)
      expect(esBib.identifierV2()).to.deep.equal([{ value: '9782810703753 (pbk.)', name: 'idIsbn' }, { value: '9782810703753', name: 'idIsbn_clean' }, { value: '(OCoLC)953527732', name: 'idOclc' }])
    })
  })

  describe('idIsbn', () => {
    it('should return array containing isbn without colon', function () {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      console.log(esBib.idIsbn())
      expect(esBib.idIsbn()).to.deep.equal([{ id: '0935661204 (tr)', type: 'bf:isbn' }])
    })
  })

  describe('idIsbn_clean', () => {
    it('should return array containing isbn without extra characters', function () {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.idIsbn_clean()).to.deep.equal(['0935661204'])
    })
  })

  describe('idIssn', () => {
    it('should return array containing issn', function () {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.idIssn()).to.deep.equal([{ id: '0208-4058', type: 'bf:issn' }])
    })
  })

  describe('idLccn', () => {
    it('should return array containing lccn', () => {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.idLccn()).to.deep.equal([{ id: '91060775', type: 'bf:lccn' }])
    })
  })

  describe('idOclc', () => {
    it('should return array containing oclc numbers', () => {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      expect(esBib.idOclc()).to.deep.equal([{ id: '(OCoLC)2362202', type: 'bf:oclc' }])
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

  describe('note', () => {
    it('should return array of notes', () => {
      const record = new SierraBib(require('../fixtures/bib-notes.json'))
      const esBib = new EsBib(record)
      expect(esBib.note()).to.deep.equal([
        {
          label: 'Title devised by cataloger.',
          type: 'bf:note',
          noteType: 'Note'
        },
        {
          label: "Many items have photographer's handstamp on verso; some items have studio blindstamp on recto.",
          type: 'bf:note',
          noteType: 'Note'
        },
        {
          label: 'Some photographs have captions on verso or recto.',
          type: 'bf:note',
          noteType: 'Note'
        },
        {
          label: 'Some photographs are airbrushed; some are cropped; some have cropping marks.',
          type: 'bf:note',
          noteType: 'Note'
        },
        {
          label: 'Collection is under copyright; permission of the copyright holder is required for duplication.',
          type: 'bf:note',
          noteType: 'Terms of Use'
        },
        {
          label: 'Photo negatives are closed to research.',
          type: 'bf:note',
          noteType: 'Terms of Use'
        },
        {
          label: 'Austin Hansen, known primarily as a Harlem studio photographer, has had a career in photography that spans nearly seventy years, from the mid-1920s to the present.',
          type: 'bf:note',
          noteType: 'Biography'
        },
        {
          label: 'Finding aid:',
          type: 'bf:note',
          noteType: 'Indexes/Finding Aids'
        },
        {
          label: "Hansen's Harlem. New York : New York Public Library, 1989.",
          type: 'bf:note',
          noteType: 'Publications'
        },
        {
          label: 'Exhibited: "Hansen\'s Harlem," an exhibition at the Schomburg Center for Research in Black Culture, 1989.',
          type: 'bf:note',
          noteType: 'Exhibitions'
        }
      ])
    })
    it('parallel notes', () => {
      const record = new SierraBib(require('../fixtures/bib-notes.json'))
      const esBib = new EsBib(record)
      expect(esBib.note(false)).to.deep.equal([
        { label: 'parallel 500 a', type: 'bf:note', noteType: 'Note' },
        {
          label: 'parallel for 545 a ',
          type: 'bf:note',
          noteType: 'Biography'
        }
      ])
    })
  })

  describe('tableOfContents', () => {
    it('should return table of contents', function () {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      expect(esBib.tableOfContents()).to.deep.equal(
        [
          '[v. ] 1 The Theban necropolis.',
          '[v. ] 2. Theban temples.',
          '[v. ] 3. Memphis (Abû Rawâsh to Dahshûr).',
          '[v. ] 4. Lower and middle Egypt (Delta and Cairo to Asyût).',
          '[v. ] 5. Upper Egypt: sites (Deir Rîfa to Aswân, excluding Thebes and the temples of Abydos, Dendera, Esna, Edfu, Kôm Ombo and Philae).',
          '[v. ] 6. Upper Egypt : chief temples (excluding Thebes) : Abydos, Dendera, Esna, Edfu, Kôm Ombo, and Philae.',
          '[v. ] 7. Nubia, the deserts, and outside Egypt / by Bertha Porter and Rosalind L.B. Moss; assisted by Ethel W. Burney.',
          '[v. ] 8. Objects of provenance not known. pt. 1. Royal Statues. private Statues (Predynastic to Dynasty XVII) -- pt. 2. Private Statues (Dynasty XVIII to the Roman Periiod). Statues of Deities -- [pt. 3] Indices to parts 1 and 2, Statues -- pt. 4. Stelae (Dynasty XVIII to the Roman Period) 803-044-050 to 803-099-990 / by Jaromir Malek, assisted by Diana Magee and Elizabeth Miles.'
        ]
      )
    })
  })

  describe('titleAlt', () => {
    it('should return alternative titles', function () {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.titleAlt()).to.deep.equal(
        ['Slavica']
      )
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

  describe('partOf', () => {
    it('should return an array of subject literals ', () => {
      const record = new SierraBib(require('../fixtures/bib-10554618.json'))
      const esBib = new EsBib(record)
      expect(esBib.partOf()).to.deep.equal(['The Devon historian, no. 5 (1972), p. 16-[22]'])
    })
  })

  describe.only('shelfMark', () => {
    it('should return shelfmark ', () => {
      const record = new SierraBib(require('../fixtures/bib-11655934.json'))
      const esBib = new EsBib(record)
      expect(esBib.shelfMark()).to.deep.equal(['The Devon historian, no. 5 (1972), p. 16-[22]'])
    })
  })

  describe('subjectLiteral', () => {
    it('should return an array of subject literals ', () => {
      const record = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      const esBib = new EsBib(record)
      expect(esBib.subjectLiteral()).to.deep.equal(['600 primary value a 600 primary value b'])
    })
  })
  describe('parallelDisplayField', () => {
    it('returns parallel display fields', () => {
      const record = new SierraBib(require('../fixtures/bib-parallel-display-fields.json'))
      const esBib = new EsBib(record)
      console.log(esBib.parallelDisplayField())
      expect(esBib.parallelDisplayField()).to.deep.equal(['600 primary value a 600 primary value b'])
    })
  })
  describe('updatedAt', () => {
    it('returns a new date', () => {
      const whenIWroteThisCode = 1680896312585
      const record = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      const esBib = new EsBib(record)
      expect(esBib.updatedAt()).to.be.above(whenIWroteThisCode)
    })
  })
})
