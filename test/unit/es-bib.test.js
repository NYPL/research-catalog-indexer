const expect = require('chai').expect
const sinon = require('sinon')

const SierraBib = require('../../lib/sierra-models/bib')
const SierraItem = require('../../lib/sierra-models/item')
const EsBib = require('../../lib/es-models/bib')

describe('EsBib', function () {
  describe('constructor', function () {
    it('initializes an EsBib with a \'bib\' property', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.bib).to.eq(record)
    })
  })

  describe('serialPublicationDates', function () {
    it('returns an array with serialPublicationDates', function () {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.serialPublicationDates()).to.deep.eq(['1-'])
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
        ['sefer toldot yeshu  the gospel according to the jews called toldoth jesu  the gener...'.substring(0, 80)]
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
      expect(esBib.creator_sort()).to.deep.equal(['shermazanian, galust.'])
    })
  })

  describe('dates', () => {
    it('_dateCreated returns date by publishYear', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib._dateCreatedString()).to.deep.equal('1977')
    })
    it('_dateCreatedString returns date by 008', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib._dateCreatedString()).to.deep.equal('1977')
    })
    it('createdString returns date as string by 008', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib.createdString()).to.deep.equal(['1977'])
    })
    it('dateStartYear returns _dateCreatedString value', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib.dateStartYear()).to.deep.equal([1977])
    })
    it('created returns _dateCreatedString value', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      delete record.publishYear
      const esBib = new EsBib(record)
      expect(esBib.createdYear()).to.deep.equal([1977])
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
      const _this = { stub: () => [Array(90).fill('A').join(''), 'another'] }
      expect(EsBib.prototype._sortify('stub', _this)).to.deep.equal([Array(80).fill('a').join('')])
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
          'Nubia, the deserts, and outside Egypt',
          'Objects of provenance not known. Royal Statues. private Statues (Predynastic to Dynasty XVII) -- Private Statues (Dynasty XVIII to the Roman Periiod). Statues of Deities -- Indices to parts 1 and 2, Statues -- Stelae (Dynasty XVIII to the Roman Period) 803-044-050 to 803-099-990'
        ]
      )
    })
  })

  describe('contributor_sort', function () {
    it('should return the first contributor literal, truncated to 80 characters and lower case', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributor_sort()).to.deep.equal(['ginosar, sh. (shaleṿ), 1902-'])
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

  describe('description', () => {
    it('should return array of the description', function () {
      const record = new SierraBib(require('../fixtures/bib-notes.json'))
      const esBib = new EsBib(record)
      expect(esBib.description()).to.deep.equal(
        [
          'The Austin Hansen Collection primarily documents the people, places, and events in Harlem during the period from approximately the 1930s to the late 1980s.'
        ]
      )
    })
  })

  describe('identifier', () => {
    it('should return array of identifiers', () => {
      const record = new SierraBib(require('../fixtures/bib-identifiers.json'))
      const esBib = new EsBib(record)
      expect(esBib.identifier()).to.deep.equal([
        'urn:shelfmark:ReCAP 16-64126',
        'urn:bnum:21071947',
        'urn:isbn:9782810703753 (pbk.)',
        'urn:oclc:953527732',
        'urn:identifier:(OCoLC)953527732'
      ])
    })
  })

  describe('identifierV2', () => {
    it('should return array of identifiers', () => {
      const record = new SierraBib(require('../fixtures/bib-identifiers.json'))
      const esBib = new EsBib(record)

      expect(esBib.identifierV2()).to.deep.equal([
        {
          value: 'ReCAP 16-64126',
          type: 'bf:ShelfMark'
        },
        {
          value: '21071947',
          type: 'nypl:Bnumber'
        },
        {
          value: '9782810703753 (pbk.)',
          type: 'bf:Isbn'
        },
        {
          value: '953527732',
          type: 'nypl:Oclc'
        },
        {
          value: '(OCoLC)953527732',
          type: 'bf:Identifier'
        }
      ])
    })
  })

  describe('idIsbn', () => {
    it('should return array containing isbn without colon', function () {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.idIsbn()).to.deep.equal(['0935661204 (tr)'])
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
      expect(esBib.idIssn()).to.deep.equal(['0208-4058'])
    })
  })

  describe('idLccn', () => {
    it('should return array containing lccn', () => {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.idLccn()).to.deep.equal(['91060775'])
    })
  })

  describe('idOclc', () => {
    it('should extact prefixed OCLC numbers from 035', () => {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      // This is also a test of uniqueness since the OCLC in this fixture is
      // stored in both the 035 and 001:
      expect(esBib.idOclc()).to.deep.equal(['2362202'])
    })

    it('should extract OCLC numbers from 001', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.idOclc()).to.deep.equal(['NYPG002001377-B'])
    })
  })

  describe('issuance', () => {
    it('should return array containing issuance object', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.issuance()).to.deep.equal([{ id: 'urn:biblevel:m', label: 'monograph/item' }])
    })
    it('should pack properly', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.issuance_packed()).to.deep.equal(['urn:biblevel:m||monograph/item'])
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

  describe('lccClassification', function () {
    it('should return array of lccClassification', function () {
      const record = new SierraBib(require('../fixtures/bib-11055155.json'))
      const esBib = new EsBib(record)
      expect(esBib.lccClassification()).to.deep.equal(
        ['Z7064 .P84', 'PJ1097 .P67 1927']
      )
    })
  })

  describe('materialType', () => {
    it('should return materialType based on ldr rectype', () => {
      const sierraBib = new SierraBib({})
      sinon.stub(sierraBib, 'ldr').returns({ recType: 'h' })
      const esBib = new EsBib(sierraBib)
      expect(esBib.materialType()).to.deep.equal([{ id: 'resourcetypes:txt', label: 'Text' }])
    })
    it('should return null for rectype not present in lookup', () => {
      const sierraBib = new SierraBib({})
      sinon.stub(sierraBib, 'ldr').returns({ recType: 'lol' })
      const esBib = new EsBib(sierraBib)
      expect(esBib.materialType()).to.equal(null)
    })
    it('materialType_packed returns packed', () => {
      const sierraBib = new SierraBib({})
      sinon.stub(sierraBib, 'ldr').returns({ recType: 'h' })
      const esBib = new EsBib(sierraBib)
      expect(esBib.materialType_packed()).to.deep.equal(['resourcetypes:txt||Text'])
    })
  })

  describe('note', () => {
    it('should return array of primary note values', () => {
      const record = new SierraBib(require('../fixtures/bib-notes.json'))
      const esBib = new EsBib(record)
      expect(esBib.note()).to.deep.equal([
        {
          label: 'Title devised by cataloger.',
          type: 'bf:Note',
          noteType: 'Note'
        },
        {
          label: "Many items have photographer's handstamp on verso; some items have studio blindstamp on recto.",
          type: 'bf:Note',
          noteType: 'Note'
        },
        {
          label: 'Some photographs have captions on verso or recto.',
          type: 'bf:Note',
          noteType: 'Note'
        },
        {
          label: 'Some photographs are airbrushed; some are cropped; some have cropping marks.',
          type: 'bf:Note',
          noteType: 'Note'
        },
        {
          label: 'Collection is under copyright; permission of the copyright holder is required for duplication.',
          type: 'bf:Note',
          noteType: 'Terms of Use'
        },
        {
          label: 'Photo negatives are closed to research.',
          type: 'bf:Note',
          noteType: 'Terms of Use'
        },
        {
          label: 'Austin Hansen, known primarily as a Harlem studio photographer, has had a career in photography that spans nearly seventy years, from the mid-1920s to the present.',
          type: 'bf:Note',
          noteType: 'Biography'
        },
        {
          label: 'Finding aid:',
          type: 'bf:Note',
          noteType: 'Indexes/Finding Aids'
        },
        {
          label: "Hansen's Harlem. New York : New York Public Library, 1989.",
          type: 'bf:Note',
          noteType: 'Publications'
        },
        {
          label: 'Exhibited: "Hansen\'s Harlem," an exhibition at the Schomburg Center for Research in Black Culture, 1989.',
          type: 'bf:Note',
          noteType: 'Exhibitions'
        }
      ])
    })
    it('parallel notes', () => {
      const record = new SierraBib(require('../fixtures/bib-notes.json'))
      const esBib = new EsBib(record)
      expect(esBib._parallelNotesAsDisplayFields()).to.deep.equal([
        // This is a parallel for primary note "Title devised by cataloger.",
        // which appears at index 0 in the note array:
        { value: 'parallel 500 a', index: 0, fieldName: 'note' },
        // This is a parallel for primary note "Austin Hansen, ...", which
        // appears at index 6 in the note array:
        { value: 'parallel for 545 a ', index: 6, fieldName: 'note' }
      ])
    })
  })
  describe('placeOfPublication', () => {
    it('should return array with placeOfPublication', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.placeOfPublication()).to.deep.equal(['Ṛostov (Doni Vra)'])
    })
  })

  describe('publicationStatement', () => {
    it('should return array with publicationStatement', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.publicationStatement()).to.deep.equal(['Ṛostov (Doni Vra) : Tparan Hovhannu Tēr-Abrahamian, 1890 [i.e. 1891]'])
    })
  })

  describe('publisherLiteral', () => {
    const record = new SierraBib(require('../fixtures/bib-10001936.json'))
    const esBib = new EsBib(record)
    it('should return array with publisherLiteral', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.publisherLiteral()).to.deep.equal(['Tparan Hovhannu Tēr-Abrahamian'])
    })
    it('parallelPublisherLiteral', () => {
      expect(esBib.parallelPublisherLiteral()).to.deep.equal(['parallel for Tparan Hovhannu Tēr-Abrahamian'])
    })
  })

  describe('seriesStatement', () => {
    const record = new SierraBib(require('../fixtures/bib-parallels-party.json'))
    const esBib = new EsBib(record)
    it('should return array with seriesStatement', function () {
      expect(esBib.seriesStatement()).to.deep.equal(['content for 440$a', 'content for 440$a (2)', 'content for 490$a', 'content for 800$a'])
    })
    it('parallelSeriesStatement', () => {
      expect(esBib.parallelSeriesStatement()).to.deep.equal(['parallel content for 440$a', 'parallel content for 440$a (2)', '', 'parallel content for 800$a'])
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

  describe('titleDisplay', () => {
    it('should return display titles', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.titleDisplay()).to.deep.equal(
        ['Niwtʻer azgayin patmutʻian hamar Ereveli hay kazunkʻ ; Parskastan / Ashkhatasirutʻiamb Galust Shermazaniani.']
      )
    })
  })

  describe('uniformTitle', () => {
    const record = new SierraBib(require('../fixtures/bib-11606020.json'))
    const esBib = new EsBib(record)
    it('should return display titles', function () {
      expect(esBib.uniformTitle()).to.deep.equal(
        ['Toledot Yeshu.']
      )
    })
    it('parallelUniformTitle', () => {
      expect(esBib.parallelUniformTitle()).to.deep.equal(
        ['‏תולדות ישו.']
      )
    })
  })

  describe('type', function () {
    it('should return \'nypl:Item\'', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.type()).to.deep.equal(['nypl:Item'])
    })
    it('should return \'nypl:Collection\'', function () {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.type()).to.deep.equal(['nypl:Item'])
    })
  })

  describe('nyplSource', function () {
    it('should return the source for partner items', function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.nyplSource()).to.deep.equal(['recap-hl'])
    })

    it('should return the source for NYPL items', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.nyplSource()).to.deep.equal(['sierra-nypl'])
    })
  })

  describe('partOf', () => {
    it('should return an array of subject literals ', () => {
      const record = new SierraBib(require('../fixtures/bib-10554618.json'))
      const esBib = new EsBib(record)
      expect(esBib.partOf()).to.deep.equal(['The Devon historian, no. 5 (1972), p. 16-[22]'])
    })
  })

  describe('shelfMark', () => {
    it('should return shelfmark ', () => {
      const record = new SierraBib(require('../fixtures/bib-11655934.json'))
      const esBib = new EsBib(record)
      expect(esBib.shelfMark()).to.deep.equal(['*ZAN-10228 no. 1'])
    })
  })

  describe('subjectLiteral', () => {
    it('should return an array of subject literals with " " joiner around certain subfields', () => {
      const record = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      const esBib = new EsBib(record)
      expect(esBib.subjectLiteral()).to.deep.equal(['600 primary value a 600 primary value b'])
    })

    it('should return an array of subject literals with " -- " joiner around other subfields', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.subjectLiteral()).to.deep.equal(['Armenians -- Iran -- History.'])
    })

    it('subjectLiteral_exploded', () => {
      const record = new EsBib(new SierraBib({}))
      sinon.stub(record, 'subjectLiteral').returns(['Arabian Peninsula -- Religion -- Ancient History.'])
      expect(record.subjectLiteral_exploded()).to.deep.equal(['Arabian Peninsula', 'Arabian Peninsula -- Religion', 'Arabian Peninsula -- Religion -- Ancient History'])
    })

    it('subjectLiteral_exploded de-dedupes', () => {
      const record = new EsBib(new SierraBib({}))
      // When subjectLiteral contains two subjects with a common root:
      sinon.stub(record, 'subjectLiteral').returns([
        'Social security -- Law and legislation -- Uruguay',
        'Social security -- Latin America'
      ])
      // Expect the root subject to only occur once:
      expect(record.subjectLiteral_exploded()).to.deep.equal([
        'Social security',
        'Social security -- Law and legislation',
        'Social security -- Law and legislation -- Uruguay',
        'Social security -- Latin America'
      ])
    })

    it('should return parallelSubjectLiteral values', () => {
      const record = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelSubjectLiteral()).to.deep.equal(['‏600 parallel value a 600 parallel value b'])
    })
  })

  describe('parallelDisplayField', () => {
    it('returns parallel display fields', () => {
      const record = new SierraBib(require('../fixtures/bib-parallel-display-fields.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelDisplayField()).to.deep.equal([
        {
          fieldName: 'publicationStatement',
          index: 0,
          value: '长沙市 : 湖南人民出版社 : 湖南省新華書店发行, 1984.'
        },
        { fieldName: 'placeOfPublication', index: 0, value: '长沙市' },
        { fieldName: 'editionStatement', index: 0, value: '第1版.' }
      ])
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

  describe('mediaType', () => {
    it('defaults to unmediated', () => {
      const record = new SierraBib({})
      expect((new EsBib(record)).mediaType()).to.deep.equal([{
        id: 'mediatypes:n',
        label: 'unmediated'
      }])
    })

    it('uses mediaTypes:h for microforms', () => {
      const record = new SierraBib({
        fixedFields: [
          {
            label: 'Material Type',
            value: 'h',
            display: 'MICROFORM'
          }
        ]
      })
      expect((new EsBib(record)).mediaType()).to.deep.equal([{
        id: 'mediatypes:h',
        label: 'microform'
      }])
    })

    it('uses mediaTypes:c for e-audiobooks', () => {
      const record = new SierraBib({
        fixedFields: [
          {
            label: 'Material Type',
            value: 'n',
            display: 'E-Audiobook'
          }
        ]
      })
      expect((new EsBib(record)).mediaType()).to.deep.equal([{
        id: 'mediatypes:c',
        label: 'computer'
      }])
    })

    it('trusts varfield 007 for partner record', () => {
      const record = new SierraBib({
        nyplSource: 'recap-pul',
        varFields: [
          {
            marcTag: '007',
            content: 'e...someothercontent'
          }
        ]
      })
      expect((new EsBib(record)).mediaType()).to.deep.equal([{
        id: 'mediatypes:e',
        label: 'stereographic'
      }])
    })

    it('trusts varfield 337 for partner record', () => {
      const record = new SierraBib({
        nyplSource: 'recap-pul',
        varFields: [
          {
            marcTag: '337',
            subfields: [
              { tag: 'a', content: 'some label' },
              { tag: 'b', content: 'some-id' }
            ]
          }
        ]
      })
      expect((new EsBib(record)).mediaType()).to.deep.equal([{
        id: 'mediatypes:some-id',
        label: 'some label'
      }])
    })
  })

  describe('mediaType_packed', () => {
    it('packs mediaType values', () => {
      const record = new SierraBib({})
      expect((new EsBib(record)).mediaType_packed()).to.deep.equal([
        'mediatypes:n||unmediated'
      ])
    })
  })

  describe('carrierType', () => {
    it('defaults to unmediated', () => {
      const record = new SierraBib({})
      expect((new EsBib(record)).carrierType()).to.deep.equal([{
        id: 'carriertypes:nc',
        label: 'volume'
      }])
    })

    it('uses 007[0,1] for Material Type h', () => {
      const record = new SierraBib({
        fixedFields: [
          {
            label: 'Material Type',
            value: 'h',
            display: 'MICROFORM'
          }
        ],
        varFields: [
          {
            marcTag: '007',
            content: 'ce...someothercontent'
          }
        ]
      })
      expect((new EsBib(record)).carrierType()).to.deep.equal([{
        id: 'carriertypes:ce',
        label: 'computer disc cartridge'
      }])
    })

    it('uses 007[0,1] for Material Type m', () => {
      const record = new SierraBib({
        fixedFields: [
          {
            label: 'Material Type',
            value: 'm'
          }
        ],
        varFields: [
          {
            marcTag: '007',
            content: '-o...someothercontent'
          }
        ]
      })
      expect((new EsBib(record)).carrierType()).to.deep.equal([{
        id: 'carriertypes:cd',
        label: 'computer disc'
      }])
    })

    it('trusts varfield 007 for partner record', () => {
      const record = new SierraBib({
        nyplSource: 'recap-pul',
        varFields: [
          {
            marcTag: '007',
            content: 'cb...someothercontent'
          }
        ]
      })
      expect((new EsBib(record)).carrierType()).to.deep.equal([{
        id: 'carriertypes:cb',
        label: 'computer chip cartridge'
      }])
    })

    it('trusts varfield 338 for partner record', () => {
      const record = new SierraBib({
        nyplSource: 'recap-pul',
        varFields: [
          {
            marcTag: '338',
            subfields: [
              { tag: 'a', content: 'some label' },
              { tag: 'b', content: 'some-id' }
            ]
          }
        ]
      })
      expect((new EsBib(record)).carrierType()).to.deep.equal([{
        id: 'carriertypes:some-id',
        label: 'some label'
      }])
    })
  })

  describe('carrierType_packed', () => {
    it('packs carrierType values', () => {
      const record = new SierraBib({})
      expect((new EsBib(record)).carrierType_packed()).to.deep.equal([
        'carriertypes:nc||volume'
      ])
    })
  })

  describe('language', () => {
    it('should return language from leader 008', () => {
      const record = new SierraBib({
        varFields: [
          {
            marcTag: '008',
            content: '                                   rum'
          }
        ]
      })
      expect((new EsBib(record)).language()).to.deep.equal([
        { id: 'lang:rum', label: 'Romanian' }
      ])
      expect((new EsBib(record)).language_packed()).to.deep.equal([
        'lang:rum||Romanian'
      ])
    })

    it('should return language from 041 $a if not found in leader', () => {
      const record = new SierraBib({
        varFields: [
          {
            marcTag: '008',
            content: '                                      '
          },
          {
            marcTag: '041',
            subfields: [
              { tag: 'a', content: 'san' }
            ]
          }
        ]
      })
      expect((new EsBib(record)).language()).to.deep.equal([
        { id: 'lang:san', label: 'Sanskrit' }
      ])
    })
  })
  describe('electronic resource properties', () => {
    let supplementaryContentRecord
    let electronicResourcesRecord
    before(() => {
      supplementaryContentRecord = new EsBib(new SierraBib(require('../fixtures/bib-11807709.json')))
      electronicResourcesRecord = new EsBib(new SierraBib(require('../fixtures/bib-electronic-resources.json')))
    })
    it('supplementaryContent', () => {
      expect(supplementaryContentRecord.supplementaryContent()).to.deep.equal([
        {
          label: 'Contents',
          url: 'http://www.gbv.de/dms/bowker/toc/9780312096663.pdf'
        }
      ])
      expect(electronicResourcesRecord.supplementaryContent()).to.equal(null)
    })
    it('supplementaryContent returns null when there are none present', () => {
      expect(electronicResourcesRecord.supplementaryContent()).to.equal(null)
    })
    it('_aeonUrls', () => {
      const record = new SierraBib(require('../fixtures/bib-aeon.json'))
      expect((new EsBib(record)._aeonUrls())).to.deep.equal([
        'https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&Form=30&Title=Vladimir+Nabokov+papers,&Site=SASBG&CallNumber=&Author=Nabokov,+Vladimir+Vladimirovich,&ItemInfo3=https://catalog.nypl.org/record=b16787052&ReferenceNumber=b16787052x&ItemInfo2=AVAILABLE&Genre=Microform&Location=Berg+Collection'
      ])
    })
    it('_aeonUrls returns null if there are no electronic resources', () => {
      const record = new SierraBib({
        varFields: [{
          fieldTag: 'y',
          marcTag: '856',
          ind1: '4',
          ind2: '2',
          content: null,
          subfields: [
            {
              tag: 'u',
              content: 'http://www.gbv.de/dms/bowker/toc/9780312096663.pdf'
            },
            {
              tag: '3',
              content: 'Contents'
            }
          ]
        }]
      })
      expect((new EsBib(record))._aeonUrls()).to.equal(null)
    })

    it('_aeonUrls returns null if there are electronic resources but no aeon links', () => {
      expect(electronicResourcesRecord._aeonUrls()).to.equal(null)
    })

    it('electronicResources', () => {
      expect(electronicResourcesRecord.electronicResources()).to.deep.equal([
        {
          label: 'Available from home with a valid library card',
          url: 'http://TM9QT7LG9G.search.serialssolutions.com/?V=1.0&L=TM9QT7LG9G&S=JCs&C=TC_029357836&T=marc&tab=BOOKS'
        },
        {
          label: 'Available onsite at NYPL',
          url: 'http://WU9FB9WH4A.search.serialssolutions.com/?V=1.0&L=WU9FB9WH4A&S=JCs&C=TC_029357836&T=marc&tab=BOOKS'
        }
      ])
      expect(supplementaryContentRecord.electronicResources()).to.equal(null)
    })
    it('numElectronicResources', () => {
      expect(electronicResourcesRecord.numElectronicResources()).to.deep.equal([2])
      expect(supplementaryContentRecord.numElectronicResources()).to.deep.equal([0])
    })
    it('electronic resources, aeonlinks, and supplementary content', () => {
      const record = new SierraBib({
        varFields: [
          // electronic resource
          {
            fieldTag: 'y',
            marcTag: '856',
            ind1: '4',
            ind2: '0',
            content: null,
            subfields: [
              {
                tag: 'z',
                content: 'Available from home with a valid library card'
              },
              {
                tag: 'u',
                content: 'http://TM9QT7LG9G.search.serialssolutions.com/?V=1.0&L=TM9QT7LG9G&S=JCs&C=TC_029357836&T=marc&tab=BOOKS'
              }
            ]
          },
          // electronic resource
          {
            fieldTag: 'y',
            marcTag: '856',
            ind1: '4',
            ind2: '0',
            content: null,
            subfields: [
              {
                tag: 'z',
                content: 'Available onsite at NYPL'
              },
              {
                tag: 'u',
                content: 'http://WU9FB9WH4A.search.serialssolutions.com/?V=1.0&L=WU9FB9WH4A&S=JCs&C=TC_029357836&T=marc&tab=BOOKS'
              }
            ]
          },
          // supplementary content
          {
            fieldTag: 'y',
            marcTag: '856',
            ind1: '4',
            ind2: '2',
            content: null,
            subfields: [
              {
                tag: 'u',
                content: 'http://www.gbv.de/dms/bowker/toc/9780312096663.pdf'
              },
              {
                tag: '3',
                content: 'Contents'
              }
            ]
          },
          // aeonUrl
          {
            fieldTag: 'y',
            marcTag: '856',
            ind1: '4',
            ind2: '0',
            content: null,
            subfields: [
              {
                tag: 'u',
                content: 'https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&Form=30&Title=Vladimir+Nabokov+papers,&Site=SASBG&CallNumber=&Author=Nabokov,+Vladimir+Vladimirovich,&ItemInfo3=https://catalog.nypl.org/record=b16787052&ReferenceNumber=b16787052x&ItemInfo2=AVAILABLE&Genre=Microform&Location=Berg+Collection'
              },
              {
                tag: 'z',
                content: 'Request access to this item in the Berg Collection'
              }
            ]
          }
        ]
      })
      const esRecord = new EsBib(record)
      expect(esRecord.supplementaryContent().length).to.equal(1)
      expect(esRecord.numElectronicResources()).to.deep.equal([2])
      expect(esRecord._aeonUrls().length).to.equal(1)
    })
  })

  describe('_extractElectronicResources', () => {
    it('returns null when supplementary content is not present', () => {
      const record = new EsBib(new SierraBib(require('../fixtures/bib-aeon.json')))
      expect(record._extractElectronicResourcesFromBibMarc('supplementary content')).to.equal(null)
    })
  })

  describe('dateEnd', () => {
    it('dateEndString should return null for no year', () => {
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-10001936')))
      expect(bib.dateEndString()).to.equal(null)
    })
    it('dateEndString should return array with year', () => {
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-11606020.json')))
      expect(bib.dateEndString()).to.deep.equal(['2000'])
    })
    it('dateEndYear should return null for no year', () => {
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-10001936')))
      expect(bib.dateEndYear()).to.equal(null)
    })
    it('dateEndYear should return year as int', () => {
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-11606020.json')))
      expect(bib.dateEndYear()).to.deep.equal([2000])
    })
  })

  describe('items', () => {
    let bib

    beforeEach(() => {
      const sierraBib = new SierraBib(require('../fixtures/bib-10001936.json'))
      // Adopt some random items:
      sierraBib._items = [
        new SierraItem(require('../fixtures/item-10003973.json')),
        new SierraItem(require('../fixtures/item-17145801.json'))
      ]
      bib = new EsBib(sierraBib)
    })

    it('items() returns array of items', () => {
      expect(bib.items()).to.be.a('array')
      expect(bib.items()).to.have.lengthOf(2)
      expect(bib.items()[0].idBarcode()).to.deep.equal(['33433107664710'])
    })

    it('numItemsTotal()', () => {
      expect(bib.numItemsTotal()).to.deep.equal([2])
    })

    it('numCheckinCardItems()', () => {
      expect(bib.numCheckinCardItems()).to.deep.equal([0])
    })

    it('numItemVolumesParsed()', () => {
      expect(bib.numItemVolumesParsed()).to.deep.equal([1])
    })
  })
})
