const expect = require('chai').expect
const sinon = require('sinon')

const SierraBib = require('../../lib/sierra-models/bib')
const SierraItem = require('../../lib/sierra-models/item')
const SierraHolding = require('../../lib/sierra-models/holding')
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
      const uri = esBib.uri()
      expect(uri).to.eq('b10001936')
    })

    it('should return correctly prefixed uri for partner bib', async function () {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      const uri = esBib.uri()
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

  describe('collectionIds', function () {
    it('returns collection id(s) that correspond to item holding locations', async () => {
      const bib = new SierraBib(require('../fixtures/bib-11606020.json'))
      bib._items = []
      bib._holdings = []
      // An item from Maps
      bib._items.push(new SierraItem(require('../fixtures/item-14441624.json')))
      expect(await (new EsBib(bib)).collectionIds()).to.deep.equal(['map'])

      // Another item from Maps
      bib._items.push(new SierraItem(require('../fixtures/item-19885371.json')))
      expect(await (new EsBib(bib)).collectionIds()).to.deep.equal(['map'])

      // An item from Moving Image and Sound Division
      bib._items.push(new SierraItem(require('../fixtures/item-37528709.json')))
      expect(await (new EsBib(bib)).collectionIds()).to.deep.equal(['scb', 'map'])
    })
    it('checks fixed field 26 for location on bibs with no items', async () => {
      const resBib = new SierraBib(require('../fixtures/bib-15109087.json'))
      resBib._items = []
      resBib._holdings = []
      // fixed field 26 on this bib has value: "mal "
      expect(await (new EsBib(resBib)).collectionIds()).to.deep.equal(['mal'])

      const scbBib = new SierraBib(require('../fixtures/bib-22027953.json'))
      scbBib._items = []
      scbBib._holdings = []
      // fixed field 26 on this bib has value: "scb "
      expect(await (new EsBib(scbBib)).collectionIds()).to.deep.equal(['scb'])
    })
    it('returns an empty array for partner records', async () => {
      const bib = new SierraBib(require('../fixtures/bib-pul-99122517373506421.json'))
      bib._items = []
      bib._items.push(new SierraItem(require('../fixtures/item-pul-7834127.json')))
      expect(await (new EsBib(bib)).collectionIds()).to.deep.equal([])
    })
  })

  describe('creatorLiteral', function () {
    it('should return the creator literal', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.creatorLiteral()).to.deep.equal(['Shermazanian, Galust'])
    })
  })

  describe('creatorLiteralNormalized', () => {
    it('should reverse creatorLiteral name parts', () => {
      const esBib = new EsBib(new SierraBib(require('../fixtures/bib-10001936.json')))
      expect(esBib.creatorLiteralNormalized()).to.deep.equal(['Galust Shermazanian'])
    })
  })

  describe('creatorLiteralWithoutDates', () => {
    it('should strip dates from creatorLiteral', () => {
      const esBib = new EsBib(new SierraBib(require('../fixtures/bib-15088995.json')))
      expect(esBib.creatorLiteralWithoutDates()).to.deep.equal(['Mendes, Cândiado'])
    })
  })

  describe('creator_sort', () => {
    it('should return the creator transformed for sorting', () => {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.creator_sort()).to.deep.equal(['shermazanian, galust'])
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
    it('creates a range of dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1977',
            lt: '2000'
          },
          raw: '790530u197719uupl uu m||     0    |pol|ncas   ',
          tag: 'u'
        }
      ])
    })
    it('creates a range of dates for type m', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530m197719uupl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1977',
            lt: '2000'
          },
          raw: '790530m197719uupl uu m||     0    |pol|ncas   ',
          tag: 'm'
        }
      ])
    })
    it('creates multiple dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530r19771999pl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1977',
            lt: '1978'
          },
          raw: '790530r19771999pl uu m||     0    |pol|ncas   ',
          tag: 'r'
        },
        {
          range: {
            gte: '1999',
            lt: '2000'
          },
          raw: '790530r19771999pl uu m||     0    |pol|ncas   ',
          tag: 'r'
        }
      ])
    })
    it('creates single dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530s1977uuuupl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1977',
            lt: '1978'
          },
          raw: '790530s1977uuuupl uu m||     0    |pol|ncas   ',
          tag: 's'
        }
      ])
    })
    it('handles dates with 9999', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530s9999uuuupl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '9999',
            lte: '9999'
          },
          raw: '790530s9999uuuupl uu m||     0    |pol|ncas   ',
          tag: 's'
        }
      ])
    })
    it('rejects invalid dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '970604d195019u8ja uu        f0   d0jpn  ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([])
    })
    it('creates detailed dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530e19770605pl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1977-06-05',
            lte: '1977-06-05T23:59:59'
          },
          raw: '790530e19770605pl uu m||     0    |pol|ncas   ',
          tag: 'e'
        }
      ])
    })
    it('handles detailed dates with incomplete date information', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '160906e201610  it a     b    001 0 ita dnam i ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '2016-10-01',
            lt: '2016-11-01'
          },
          raw: '160906e201610  it a     b    001 0 ita dnam i ',
          tag: 'e'
        }
      ])
    })
    it('pads detailed dates correctly', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '170630e201704  it af    b    001 0dita dnam i ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '2017-04-01',
            lt: '2017-05-01'
          },
          raw: '170630e201704  it af    b    001 0dita dnam i ',
          tag: 'e'
        }
      ])
    })
    it('rounds fuzzy dates up', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530u197719--5pl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1977',
            lt: '2000'
          },
          raw: '790530u197719--5pl uu m||     0    |pol|ncas   ',
          tag: 'u'
        }
      ])
    })
    it('rounds fuzzy dates down', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530u19--19uupl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([
        {
          range: {
            gte: '1900',
            lt: '2000'
          },
          raw: '790530u19--19uupl uu m||     0    |pol|ncas   ',
          tag: 'u'
        }
      ])
    })
    it('rejects missing start dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530uuuuu19uupl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([])
    })
    it('rejects impossible date ranges', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530c19991998pl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([])
    })
    it('rejects impossible dates', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      record.varFields = record.varFields.filter(field => field.marcTag !== '008')
      record.varFields.push({
        fieldTag: 'y',
        marcTag: '008',
        ind1: ' ',
        ind2: ' ',
        content: '790530e01021998pl uu m||     0    |pol|ncas   ',
        subfields: null
      })
      const esBib = new EsBib(record)
      expect(esBib.dates()).to.deep.equal([])
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

    it('should include Corporate names in contributorLiteral', () => {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributorLiteral()).to.deep.equal(['Schiff Collection'])
    })

    it('should filter out contributors that are also creators', function () {
      const record = new SierraBib({
        varFields: [
          // Two creatorLiterals:
          { marcTag: '100', subfields: [{ tag: 'a', content: 'Lastname1, firstname1' }] },
          { marcTag: '100', subfields: [{ tag: 'a', content: 'Lastname2, firstname2, 1918-2024' }] },
          // Two [redundant] contributorLiterals:
          { marcTag: '700', subfields: [{ tag: 'a', content: 'Lastname1, firstname1' }] },
          { marcTag: '700', subfields: [{ tag: 'a', content: 'Lastname2, firstname2' }] },
          // And one novel contributorLiteral:
          { marcTag: '700', subfields: [{ tag: 'a', content: 'Lastname3, firstname3' }] }
        ]
      })
      const esBib = new EsBib(record)
      expect(esBib.creatorLiteral()).to.deep.equal([
        'Lastname1, firstname1',
        'Lastname2, firstname2, 1918-2024'
      ])
      expect(esBib.contributorLiteral()).to.deep.equal([
        'Lastname3, firstname3'
      ])
    })

    it('should nullify contributorLiteral if all contributors are redundant', function () {
      const record = new SierraBib({
        varFields: [
          { marcTag: '100', subfields: [{ tag: 'a', content: 'Lastname1, firstname1' }] },
          { marcTag: '700', subfields: [{ tag: 'a', content: 'Lastname1, firstname1' }] }
        ]
      })
      const esBib = new EsBib(record)
      expect(esBib.creatorLiteral()).to.deep.equal([
        'Lastname1, firstname1'
      ])
      expect(esBib.contributorLiteral()).to.deep.equal(null)
    })
  })

  describe('contributorLiteralNormalized', function () {
    it('should reverse contributorLiteral name parts', () => {
      const esBib = new EsBib(new SierraBib(require('../fixtures/bib-11055155.json')))
      expect(esBib.contributorLiteralNormalized()).to.deep.equal([
        'Rosalind Moss',
        'Rosalind L. Moss',
        'Rosalind L. B. Moss',
        'Ethel Burney',
        'Ethel W. Burney',
        'Jaromír Málek',
        'Diana Magee',
        'Elizabeth Miles'
      ])
    })
  })

  describe('contributorLiteralWithoutDates', function () {
    it('should strip dates from contributorLiterals', () => {
      const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(record)
      expect(esBib.contributorLiteralWithoutDates()).to.deep.equal([
        'Ginosar, Sh. (Shaleṿ)'
      ])
    })

    it('should remove contributorLiteralWithoutDates that duplicate creatorLiteralWithoutDates', function () {
      const record = new SierraBib(require('../fixtures/bib-10027451.json'))
      const esBib = new EsBib(record)
      // This bib has a 700 with "Dickens, Charles", but it duplicates a 100,
      // so we don't want to see it repeated in this field:
      expect(esBib.contributorLiteralWithoutDates()).to.deep.equal([
        'Leyris, Pierre'
      ])
    })
  })

  describe('summary', () => {
    it('should return array of the description', function () {
      const record = new SierraBib(require('../fixtures/bib-notes.json'))
      const esBib = new EsBib(record)
      expect(esBib.summary()).to.deep.equal(
        [
          'The Austin Hansen Collection primarily documents the people, places, and events in Harlem during the period from approximately the 1930s to the late 1980s. The Navy photography, produced when Hansen served on Manus Island in the South Pacific during the Second World War (1944-45), includes individual and group portraits of sailors, officers, South Seas inhabitants, and self-portraits.  Also included are views of daily military life and various construction projects.',
          'The Personalities series includes many well-known political, civil rights, labor, entertainment, literary, and sports figures. Among the more notable are Mary McLeod Bethune, Coretta Scott King, Canada Lee, Joe Louis, Adam Clayton Powell, Jr., A. Philip Randolph, Jackie Robinson, and Eleanor Roosevelt.',
          "The Organization series depicts the numerous benevolent, civic, social, fraternal and professional organizations in Harlem.  This includes individual and group portraits of officers and membership; meetings and assemblies; dinners; ceremonies; cotillions; parties; community service events; and miscellaneous events.  Among the organizations represented are the New York Club of the National Association of Negro Business & Professional Women's Clubs, the Virgin Islands Professional League, Club \"75\" Inc., the Harlem Branch of the Young Men's Christian Association, and a large representation of fraternal groups.  The latter includes the Ancient Egyptian Arabic Order Nobles Mystic Shrine (Prince Hall Affiliated), the Prince Hall Grand Lodge (N.Y.), the Improved Benevolent Protective Order of Elks of the World, and the Scottish Rite Masonic order.",
          "Church photography documents clergy, parishioners, confirmation classes, clubs and associations, architectural views, rites and ceremonies, special events, and other activities of the mostly Protestant denominations in the Harlem area.  Included in this series are Abyssinian Baptist Church, Mother A.M.E. Zion, St. Luke's A.M.E., St. Martin's Episcopal, St. Philip's Episcopal, Salem United Methodist, and the Cathedral of St. John the Divine.",
          'The wedding photography records the participants and activities in a variety of weddings that Hansen photographed from the 1940s to the 1980s.  The collection is a mixture of both black and white and color photographs which include portraits of the bride and groom, bridal parties, prenuptial bridal preparations, views of ceremonies, wedding guests, and receptions.  Most notable among this group is the wedding of former New York City mayor David N. Dinkins to Joyce Burrows.',
          'Studio portraits primarily depict residents of the Harlem community and include images of babies, children, couples, and families.  Images consist of individual and group portraits, including head shots, medium close-ups and full-length shots.  Some of the prints have been hand-colored, and several were done on the occasion of graduations, confirmations or first communions, formal occasions, or for modeling portfolios.',
          "The remainder of the collection represents the variety of assignments and projects that Hansen carried out for specific clients, as well as some of the work that he produced for New York's major African American newspapers.  These images include views of accidents and legal photos; architectural views and street scenes; miscellaneous unidentified organization and church functions; interior views of bars and nightclubs; various gospel singers and other musical groups in performance; police and fire department activities, including a series of portraits of the officers of the New York Police Department 32nd Precinct; funerals; parties; local banks and businesses; and events, such as the Joe Louis Day Parade (1946) and the Poor People's Campaign March on Washington, D.C. (1968)."
        ]
      )
    })

    it('should extract parallelSummary', () => {
      const record = new SierraBib(require('../fixtures/bib-23236773.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelSummary()).to.deep.equal([
        '本书内容讲述:如果重绘中国当代文学"后三十年"的地图,这几个枢纽点是不应该被忽视的:1976年,1979年,1985年和1993年.1993年作为1980年代文学的终结点和1990年代文学的开启,具有历史枢纽点的特殊意义.因为只有在1993年的文学变局里,1980年代作为20世纪中国文学又一个"黄金十年"的历史命题才是成立的;而正是在这个枢纽点上,1990年代文学才告诉人们,它告别了当代文学漫长的理想浪漫期,回到了文学本来的面貌当中.'
      ])
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

    it('should use bf:Lccn', () => {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.identifierV2().find((identifier) => identifier.type === 'bf:Lccn').value).to.deep.equal('91060775')
    })

    it('should use bf:Isbn', function () {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.identifierV2().find((identifier) => identifier.type === 'bf:Isbn').value).to.deep.equal('0935661204 (tr)')
    })

    it('should use bf:Lccn', () => {
      const record = new SierraBib(require('../fixtures/bib-11806560.json'))
      const esBib = new EsBib(record)
      expect(esBib.identifierV2().find((identifier) => identifier.type === 'bf:Lccn').value).to.deep.equal('91060775')
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

  describe('formatId', () => {
    it('should return formatId based on recordTypeId logic for partner records', () => {
      const sierraBib = new SierraBib(require('../fixtures/bib-10001936.json'))
      sinon.stub(sierraBib, 'ldr').returns({ recType: 'h' })
      sinon.stub(sierraBib, 'isPartnerRecord').returns(true)
      const esBib = new EsBib(sierraBib)
      const recordTypeSpy = sinon.spy(esBib, 'recordTypeId')
      expect(esBib.formatId()).to.deep.equal('h')
      expect(recordTypeSpy.calledOnce).to.equal(true)
    })
    it('should return fixed field materialType for nypl records', () => {
      const sierraBib = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(sierraBib)
      expect(esBib.formatId()).to.deep.equal('a')
    })
    it('should return trimmed fixed field materialType for nypl records', () => {
      const sierraBib = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(sierraBib)
      sinon.stub(sierraBib, 'fixed').callsFake((field) => {
        return field === 'Material Type' && 'a '
      })
      expect(esBib.formatId()).to.deep.equal('a')
    })
  })

  describe('recordTypeId', () => {
    it('should return recordTypeId based on ldr rectype', () => {
      const sierraBib = new SierraBib({})
      sinon.stub(sierraBib, 'ldr').returns({ recType: 'h' })
      const esBib = new EsBib(sierraBib)
      expect(esBib.recordTypeId()).to.deep.equal('h')
    })
    it('should return null for empty rectype', () => {
      const sierraBib = new SierraBib({})
      sinon.stub(sierraBib, 'ldr').returns({ recType: '' })
      const esBib = new EsBib(sierraBib)
      expect(esBib.materialType()).to.equal(null)
    })
    it('should not break if ldr is undefined', () => {
      const sierraBib = new SierraBib({})
      sinon.stub(sierraBib, 'ldr').returns()
      const esBib = new EsBib(sierraBib)
      expect(esBib.materialType()).to.equal(null)
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
          label: 'Austin Hansen, known primarily as a Harlem studio photographer, has had a career in photography that spans nearly seventy years, from the mid-1920s to the present. Hansen was born in St. Thomas, in the Virgin Islands, on January 28, 1910, where he began his photographic career as a student of Clair Taylor, the Islands\' official photographer.  Among the first images that he produced were depictions of the hurricane damage done to St. Thomas in 1926 which he sold to the Virgin Islands\' government for $4.00.  When Charles Lindburgh stopped in the Virgin Islands after his 1927 transatlantic solo flight, Hansen recorded his visit and later sold these pictures to the New York Amsterdam News for $2.00.',
          type: 'bf:Note',
          noteType: 'Biography'
        },
        {
          label: 'Moving to Harlem in 1928, Hansen worked at various jobs including messenger, elevator operator, and professional drummer in local Harlem nightclubs.  He also continued to pursue a career in professional photography by bringing his camera to gigs and photographing club patrons for a fee.  In 1929, he sold an image to the New York Amsterdam News of an African American woman singer performing for Eleanor Roosevelt at the Essex Hotel, for which Hansen was paid $2.00.  This would begin his long association with the local African American press as a freelance photojournalist.',
          noteType: 'Biography',
          type: 'bf:Note'
        },
        {
          label: 'In the 1930s, Hansen joined the musicians\' union, Local 802, which enabled him to play and travel with larger bands.  He also studied art and started to expand his photographic output with the assistance of his younger brother, Aubrey, who had arrived in New York in 1939.  It was at this time that he began to photograph the Harlem nightclub scene; it also marked the beginning of his photographic record of both the day-to-day occurences in the local community, as well as the activities of notable Harlem residents and distinguished visitors.  During this time he also opened his first studio on West 116th Street in Harlem.  In 1942, Hansen began to do freelance work for the People\'s Voice, the newspaper founded and edited by Adam Clayton Powell, Jr., both as a contributing photographer, and as "The Mystery Photographer" for the Voice\'s promotional campaign.',
          noteType: 'Biography',
          type: 'bf:Note'
        },
        {
          label: 'Hansen was drafted into the Navy during World War II, and served from July 17, 1943 to January 26, 1945.  He was trained as a war photographer and given the rank of Photographer\'s Mate, 2nd class, later serving on Manus Island in the Admiralty Islands in the South Pacific.  In 1945, after his discharge from the Navy, he was employed for over a year as a darkroom technician and photographer for the Office of War Information in New York City.  After the war, Hansen opened a photo studio on Eagle Ave. in the Bronx.  He later owned and operated a studio at 232 W. 135th Street, Harlem, where, for over forty years, he produced an archive of thousands of images depicting Harlem\'s architecture, religious institutions, businesses, professional schools, social and fraternal organizations, events, and weddings, along with a sizable studio portrait collection of families, clergy, political leaders, entertainers, athletes, police, and writers.  As a freelance photographer, Hansen was on assignment for or sold images to such publications as the New York Amsterdam News, the People\'s Voice, the New York Age, the Pittsburgh Courier (New York edition), African Opinion, and the Afro-American.  Austin Hansen died in New York City on January 23, 1996, a few days short of his 86th birthday.',
          noteType: 'Biography',
          type: 'bf:Note'
        },
        {
          label: 'Finding aid',
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
      expect(esBib.parallelNote()).to.deep.equal([
        // This is a parallel for primary note "Title devised by cataloger.",
        // which appears at index 0 in the note array:
        {
          label: 'parallel 500 a',
          noteType: 'Note',
          type: 'bf:Note'
        },
        // Empty placeholder notes:
        null,
        null,
        null,
        null,
        null,
        // This is a parallel for primary note "Austin Hansen, ...", which
        // appears at index 6 in the note array:
        {
          label: 'parallel for 545 a ',
          noteType: 'Biography',
          type: 'bf:Note'
        }
      ])
    })

    it('parallel notes (2)', () => {
      const record = new SierraBib(require('../fixtures/bib-21131507.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelNote()).to.deep.equal([
        {
          label: '"Науково-довідкове видання"--Colophon.',

          noteType: 'Note',
          type: 'bf:Note'
        },
        {
          label: 'At head of title: Національна академія наук Укрӓіни. Національна бібліотека Укрӓіни імені В.І Вернадського. Інститут рукопису.',
          noteType: 'Note',
          type: 'bf:Note'
        }
      ])
    })

    it('excludes notes with 1st indicator 0', () => {
      const record = new SierraBib(require('../fixtures/bib-pul-99122517373506421.json'))
      const esBib = new EsBib(record)
      // This record has a single note with 1st indicator '0', so it is excluded:
      expect(esBib.note()).to.equal(null)
    })
  })

  describe('placeOfPublication', () => {
    it('should return array with placeOfPublication', function () {
      const record = new SierraBib(require('../fixtures/bib-10001936.json'))
      const esBib = new EsBib(record)
      expect(esBib.placeOfPublication()).to.deep.equal(['Ṛostov (Doni Vra)'])
    })

    it('should include data from 752', function () {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      expect(esBib.placeOfPublication()).to.deep.equal([
        'England London',
        'London'
      ])
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

    it('should return toc and parallel toc', () => {
      const record = new SierraBib(require('../fixtures/bib-23722949.json'))
      const esBib = new EsBib(record)
      expect(esBib.tableOfContents()).to.deep.equal([
        'Zustrichnyĭ marsh = Vstrechnyĭ marsh / A. Lazarenko -- Pokhidnyĭ marsh = Pokhodnyĭ marsh / S. Shvart͡s -- Karnavalʹnyĭ valʹs = Karnavalʹnyĭ valʹs / A. Kolomii͡et͡sʹ = A. Kolomiet͡s -- Valʹs z baletu "Mukha-t͡sokotukha" = Valʹs iz baleta "Mukha-t͡sokotukha" / L. Usachov = L. Usachev -- Valʹs na ukraïnsʹki temy = Valʹs na ukrainskie temy / I͡E. I͡Ut͡sevych = E. I͡Ut͡sevich -- Polʹka-rondo / S. Z͡Hdanov = S. Zhdanov -- Molodiz͡hna polʹka = Molodezhnai͡a polʹka / I. Berkovich = I. Berkovych -- Polʹka z͡hart = Polʹka-shutka  / N. Shulʹman -- Mazurka / I. Vilensʹkyĭ = I. Vilenskiĭ -- Chardash / V. Koltun -- Rosiĭsʹkyĭ tanet͡sʹ = Russkiĭ tanet͡s / I. Vilensʹkyĭ = I. Vilenskiĭ -- Ukraïnsʹkyĭ tanet͡sʹ = Ukrainskiĭ tanet͡s / P. Hlushkov ; P. Glushkov -- Kozachok = Kazachek / K. Dominchen -- Kozachok = Kazachek / S. Z͡Hdanov = S. Zhdanov -- Kolomyĭky z baletu "Khustka Dovbusha" = Kolomyĭki iz baleta "Khustka dovbusha" / A. Kos-Anatolʹsʹkyĭ = A. Kos-Anatolʹskiĭ -- Tropoti͡anka / L. Hrinberh = L. Grinberg -- Azerbaĭdz͡hansʹkyĭ tanet͡sʹ = Azerbaĭdzhanskiĭ tanet͡s / H. Sesiashvili = G. Sesiashvili -- Variat͡siï na chesʹku temu = Variat͡sii na cheshskui͡u temu / S. Shvart͡s -- Kytaĭsʹkyĭ tanet͡sʹ = Kitaĭskiĭ tanet͡s / C. Chapkiĭ = S. Chapkiĭ.'
      ])
      // At writing, this bib in production doesn't link the primary and
      // parallel TOC fields properly, leading to an orphaned parallel:
      expect(esBib.parallelTableOfContents()).to.deep.equal([
        '',
        'Зустрічний марш = Встречный марш / А. Лазаренко -- Похідний марш = Походный марш / С. Шварц -- Карнавальний вальс = Карнавальный вальс / А. Коломієць = А. Коломиец -- Вальс з балету "Муха-цокотуха" = Вальс из балета "Муха-цокотуха" / Л. Усачов = Л. Усачев -- Вальс на українські теми = Вальс на украинские темы / Є Юцевич = Е. Юцевич -- Полька-рондо / С. Жданов -- Молодіжна полька = Молодежная полька / І Беркович -- Полька жарт = Полька-шутка / Н. Шульман -- Мазурка / І Віленський = И. Виленский -- Чардаш / В. Колтун -- Російський танець = Русский танец / І Віленський = И. Виленский -- Український танець = Украинский танец / П. Глушков -- Козачок = Казачек / К. Домінчен = К. Доминчен -- Козачок = Казачек  / С. Жданов -- Коломийки з балету "Хустка Довбуша" = Коломыйки из балета "Хустка Довбуша"/ А. Кос-Анатольський = А. Кос-Анатольский -- Тропотянка / Л. Грінберг = Л. Гринберг -- Азербайджанський танець = Азербайджанский танец / Г. Сесіашвілі   Г. Сесиашвили -- Варіації на чеську тему = Вариации на чешскую тему / С. Шварц -- Китайський танець = Китайский танец / С. Чапкій = С. Чапкий.'
      ])
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
    it('should return an array of partOf statements ', () => {
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
    it('should not build subjectLiterals that are suppressed', () => {
      const record = new SierraBib(require('../fixtures/partner-suppressable-subjects.json'))
      const esBib = new EsBib(record)
      expect(esBib.subjectLiteral().length).to.equal(7)
    })
    it('should respect the order that subjects were catalogged in', () => {
      const record = new SierraBib(require('../fixtures/bib-subject-order.json'))
      const esBib = new EsBib(record)
      expect(esBib.subjectLiteral()[0]).to.deep.equal('Motion picture actors and actresses.')
    })
    it('should return an array of subject literals with " " joiner around certain subfields', () => {
      const record = new SierraBib(require('../fixtures/bib-parallels-chaos.json'))
      const esBib = new EsBib(record)
      expect(esBib.subjectLiteral()).to.deep.equal(['600 primary value a 600 primary value b.'])
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
      expect(esBib.parallelSubjectLiteral()).to.deep.equal(['‏600 parallel value a 600 parallel value b.'])
    })
    it('parallelSubjectLiteral shouldn\t have a problem with no parallel', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelSubjectLiteral())
    })
    it('parallelSubjectLiteral shouldn\t have a problem with no parallel', () => {
      const record = new SierraBib(require('../fixtures/bib-10554371.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelSubjectLiteral())
    })
  })

  describe('editionStatement', () => {
    it('extracts editionStatement & parallel', () => {
      const record = new SierraBib(require('../fixtures/bib-11086445.json'))
      const esBib = new EsBib(record)
      expect(esBib.editionStatement()).to.deep.equal([
        'Di 1 ban.'
      ])
      expect(esBib.parallelEditionStatement()).to.deep.equal([
        '第1版.'
      ])
    })
  })

  describe('parallelPublicationStatment', () => {
    it('returns parallel publication statement', () => {
      const record = new SierraBib(require('../fixtures/bib-parallels-late-added.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelPublicationStatement()).to.deep.equal([
        '长沙市 : 湖南人民出版社 : 湖南省新華書店发行, 1984.'
      ])
      expect(esBib.parallelPlaceOfPublication()).to.deep.equal([
        '长沙市'
      ])
      expect(esBib.parallelEditionStatement()).to.deep.equal([
        '第1版.'
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

    it('ignores 337 with no content (i.e. just parallel content)', () => {
      const record = new SierraBib({
        nyplSource: 'recap-pul',
        varFields: [
          {
            marcTag: '880',
            subfields: [
              { tag: '6', content: '337-01/(3/r' },
              { tag: 'a', content: 'some parallel content' },
              { tag: 'b', content: 'some other parallel content' }
            ]
          }
        ]
      })
      expect((new EsBib(record)).mediaType()).to.deep.equal([{
        id: 'mediatypes:n',
        label: 'unmediated'
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

    it('parses 338 for partner record with only parallel content', () => {
      const record = new SierraBib({
        nyplSource: 'recap-pul',
        varFields: [
          {
            marcTag: '880',
            subfields: [
              { tag: '6', content: '338-01/(3/r' },
              { tag: 'a', content: 'some parallel content' },
              { tag: 'b', content: 'some other parallel content' }
            ]
          }
        ]
      })
      expect((new EsBib(record)).carrierType()).to.deep.equal([{
        id: 'carriertypes:nc',
        label: 'volume'
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

    it('should return preferred language code if deprecated code found', () => {
      const record = new SierraBib({
        varFields: [
          {
            marcTag: '008',
            // max is a deprecated code:
            content: '                                   max'
          }
        ]
      })
      expect((new EsBib(record)).language()).to.deep.equal([
        { id: 'lang:glv', label: 'Manx' }
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

  describe('genreForm', () => {
    it('formats genreForm with " - " joiner', () => {
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-notes.json')))
      // Note that these are not plain hyphens; These are en-dashes
      // ( https://www.compart.com/en/unicode/U+2013 )
      expect(bib.genreForm()).to.deep.equal([
        'Portrait photographs – 1930-1989.',
        'Group portraits – 1930-1989.',
        'Cityscape photographs – 1930-1989.',
        'Legal photographs – 1930-1989.',
        'Fashion photographs – 1930-1989.',
        'Photographic prints – 1930-1989.',
        'Gelatin silver prints – 1930-1989.',
        'Dye coupler prints – 1940-1989.',
        'Panoramic photographs – 1940-1989.',
        'Hand coloring.'
      ])
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
      sierraBib._holdings = []
      bib = new EsBib(sierraBib)
    })

    it('items() returns array of items', async () => {
      const items = await bib.items()
      expect(items).to.be.a('array')
      expect(items).to.have.lengthOf(2)
      expect(items[0].idBarcode()).to.deep.equal(['33433107664710'])
    })

    it('numItemsTotal()', async () => {
      const itemsCount = await bib.numItemsTotal()
      expect(itemsCount).to.deep.equal([2])
    })

    it('numCheckinCardItems()', async () => {
      const numCheckinCards = await bib.numCheckinCardItems()
      expect(numCheckinCards).to.deep.equal([0])
    })

    it('numItemVolumesParsed()', async () => {
      const numParsed = await bib.numItemVolumesParsed()
      expect(numParsed).to.deep.equal([1])
    })

    it('sorts by shelfMark_sort()', async () => {
      let items = await bib.items()
      let uris = await Promise.all(items.map((i) => i.uri()))
      expect(uris[0]).to.equal('i10003973')
      expect(uris[1]).to.equal('i17145801')

      // Reverse the items stored in the bib:
      bib.bib._items.reverse()
      items = await bib.items()
      uris = await Promise.all(items.map((i) => i.uri()))
      // Verify order has been reversed:
      expect(bib.bib._items[0].id).to.equal('17145801')
      expect(bib.bib._items[1].id).to.equal('10003973')
      // Verify they're still returned ordered by shelfMark:
      expect(uris[0]).to.equal('i10003973')
      expect(uris[1]).to.equal('i17145801')
    })
  })

  describe('items with offsite checkInCards', () => {
    let bib

    beforeEach(() => {
      const sierraBib = new SierraBib(require('../fixtures/bib-10001936.json'))
      // Adopt some random items:
      sierraBib._items = [
        new SierraItem(require('../fixtures/item-10003973.json')),
        new SierraItem(require('../fixtures/item-17145801.json'))
      ]

      // Add holdings with Offsite location to check that they are filtered out
      const holding = require('../fixtures/holding-1032862.json')
      holding.location.code = 'rcmg8'

      // Add a holding with no location to make sure it doesn't cause an error
      const holding2 = JSON.parse(JSON.stringify(holding))
      holding2.location = null

      sierraBib._holdings = [
        new SierraHolding(holding),
        new SierraHolding(holding2)
      ]
      bib = new EsBib(sierraBib)
    })

    it('filters out checkInCards with offsite locations', async () => {
      const items = await bib.items()
      expect(items).to.be.a('array')
      expect(items).to.have.lengthOf(4)
    })
  })

  describe('addedAuthorTitle', function () {
    it('should return array of author titles', function () {
      const record = new SierraBib(require('../fixtures/bib-14576049.json'))
      const esBib = new EsBib(record)
      expect(esBib.addedAuthorTitle()).to.deep.equal(['Peter Pan.'])
    })

    it('extracts added author title', () => {
      const record = new SierraBib(require('../fixtures/bib-21989304.json'))
      const esBib = new EsBib(record)
      expect(esBib.addedAuthorTitle()).to.deep.equal([
        'Dvenadt͡satʹ.'
      ])
    })

    it('extracts parallel added author title', () => {
      const record = new SierraBib(require('../fixtures/bib-21989304.json'))
      const esBib = new EsBib(record)
      expect(esBib.parallelAddedAuthorTitle()).to.deep.equal([
        // Although this appears to be the right parallel for the primary
        // (above), the $6 doesn't link them correctly, hence orphaned:
        '',
        'Двенадцать'
      ])
    })
  })

  describe('popularity', () => {
    let bib

    beforeEach(() => {
      const sierraBib = new SierraBib(require('../fixtures/bib-10001936.json'))
      // Adopt some random items:
      sierraBib._items = [
        new SierraItem(require('../fixtures/item-10003973.json')),
        new SierraItem(require('../fixtures/item-17145801.json'))
      ]
      sierraBib._holdings = []
      bib = new EsBib(sierraBib)
    })

    it('should derive popularity from item checkouts', async () => {
      expect(await bib.popularity()).to.deep.equal(4)
    })
  })

  describe('buildingLocationIds', () => {
    it('builds array of plain, distinct building ids from item locations', async () => {
      const bib = new SierraBib(require('../fixtures/bib-10001936.json'))
      bib._items = []
      bib._holdings = []
      // Adopt a RC items:
      bib._items.push(new SierraItem(require('../fixtures/item-10003973.json')))
      expect(await (new EsBib(bib)).buildingLocationIds()).to.deep.equal(['rc'])

      // Adopt another RC items:
      bib._items.push(new SierraItem(require('../fixtures/item-17145801.json')))
      expect(await (new EsBib(bib)).buildingLocationIds()).to.deep.equal(['rc'])

      // Adopt a Maps items:
      bib._items.push(new SierraItem(require('../fixtures/item-14441624.json')))
      expect(await (new EsBib(bib)).buildingLocationIds()).to.deep.equal(['ma', 'rc'])

      // Replace with a single SC item:
      bib._items = [new SierraItem(require('../fixtures/item-37528709.json'))]
      expect(await (new EsBib(bib)).buildingLocationIds()).to.deep.equal(['sc'])
    })

    it('returns just "rc" if partner bib', async () => {
      const bib = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
      const esBib = new EsBib(bib)
      expect(await (esBib.buildingLocationIds())).to.deep.equal(['rc'])
    })
  })

  describe('series', () => {
    it('extracts series', async () => {
      const bib = new SierraBib({
        varFields: [
          {
            marcTag: '490',
            subfields: [
              { tag: 'a', content: 'subfield a content' },
              { tag: 'b', content: 'subfield b content' }
            ]
          },
          {
            marcTag: '810',
            subfields: [
              { tag: 'a', content: 'subfield a content' },
              { tag: 'z', content: 'subfield z content' },
              { tag: '6', content: 'subfield z content' }
            ]
          }
        ]
      })
      const esBib = new EsBib(bib)

      expect(await (esBib.series())).to.deep.equal([
        // Only expect subfield a for 490:
        'subfield a content',
        // Expect all subfields (except 6) for 810:
        'subfield a content subfield z content'
      ])
    })

    it('extracts parallelSeries', () => {
      const bib = new SierraBib(require('../fixtures/bib-23236773.json'))
      const esBib = new EsBib(bib)
      expect(esBib.parallelSeries()).to.deep.equal([
        '当代文学史研究丛书'
      ])
    })
  })

  describe('physicalDescription', () => {
    it('extracts physicalDescription content', async () => {
      const bib = new SierraBib({
        varFields: [
          {
            marcTag: '300',
            subfields: [
              { tag: 'a', content: 'subfield_a' },
              { tag: 'b', content: 'subfield_b' },
              { tag: 'c', content: 'subfield_c' },
              { tag: 'd', content: 'subfield_d' },
              { tag: 'e', content: 'subfield_e' }
            ]
          }
        ]
      })
      const esBib = new EsBib(bib)

      expect(await (esBib.physicalDescription())).to.deep.equal([
        // Expect all subfields (except d) for 300:
        'subfield_a : subfield_b ; subfield_c + subfield_e'
      ])
    })
  })

  describe('physicalDescriptionWithSuffixes', () => {
    it('extracts physicalDescription content', async () => {
      const bib = new SierraBib({
        varFields: [
          {
            marcTag: '300',
            subfields: [
              { tag: 'a', content: '1 map :' },
              { tag: 'b', content: 'both sides, color ;' },
              { tag: 'c', content: '128 x 96 cm, on sheet 68 x 98 cm +' },
              { tag: 'e', content: '1 index (31 p. ; 19 cm)' }
            ]
          }
        ]
      })
      const esBib = new EsBib(bib)

      expect(await (esBib.physicalDescription())).to.deep.equal([
        '1 map : both sides, color ; 128 x 96 cm, on sheet 68 x 98 cm + 1 index (31 p. ; 19 cm)'
      ])
    })
  })

  describe('physicalDescriptionSubset1', () => {
    it('extracts physicalDescription content', async () => {
      const bib = new SierraBib({
        varFields: [
          {
            marcTag: '300',
            subfields: [
              { tag: 'a', content: '1 score (16 p.) ;' },
              { tag: 'c', content: '29 cm' }
            ]
          }
        ]
      })
      const esBib = new EsBib(bib)

      expect(await (esBib.physicalDescription())).to.deep.equal([
        '1 score (16 p.) ; 29 cm'
      ])
    })
  })

  describe('physicalDescriptionSubset2', () => {
    it('extracts physicalDescription content', async () => {
      const bib = new SierraBib({
        varFields: [
          {
            marcTag: '300',
            subfields: [
              { tag: 'a', content: '1 computer disk ;' },
              { tag: 'c', content: '3 1/2 in. +' },
              { tag: 'e', content: 'reference manual' }
            ]
          }
        ]
      })
      const esBib = new EsBib(bib)

      expect(await (esBib.physicalDescription())).to.deep.equal([
        '1 computer disk ; 3 1/2 in. + reference manual'
      ])
    })
  })
})
