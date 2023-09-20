const expect = require('chai').expect

const SierraHolding = require('../../lib/sierra-models/holding')
const EsCheckinCardItem = require('../../lib/es-models/checkin-card-item')
const EsBib = require('../../lib/es-models/bib')

describe('EsCheckinCardItem', function () {
  const holding = new SierraHolding(require('../fixtures/holding-1032862.json'))
  const checkinCardItems = EsCheckinCardItem.fromSierraHolding(holding)

  describe('accessMessage', () => {
    it('returns static access message', () => {
      expect(checkinCardItems[0].accessMessage()).to.deep.equal([
        { id: 'accessMessage:1', label: 'Use in library' }
      ])
    })
  })

  describe('accessMessage_packed', () => {
    it('returns packed access message', () => {
      expect(checkinCardItems[0].accessMessage_packed()).to.deep.equal([
        'accessMessage:1||Use in library'
      ])
    })
  })

  describe('dateRange', () => {
    it('parses dates from start_date and null end_date', () => {
      // First checkin card item has start_date 'Mar. 2012, so:
      expect(checkinCardItems[0].dateRange()).to.deep.equal([
        { gte: '2012-03-01', lte: '2012-03-01' }
      ])
      // Second checkin card item has start_date 'Jan. 2012, so:
      expect(checkinCardItems[1].dateRange()).to.deep.equal([
        { gte: '2012-01-01', lte: '2012-01-01' }
      ])
    })

    it('parses dates from start_date and non-null end_date', () => {
      const fakeHolding = {
        checkInCards: [
          { start_date: 'Jun. 2023', end_date: 'Sep. 2024' }
        ]
      }
      const items = EsCheckinCardItem.fromSierraHolding(fakeHolding)
      expect(items[0].dateRange()).to.deep.equal([
        { gte: '2023-06-01', lte: '2024-09-01' }
      ])
    })

    it('returns checkin card item enumeration', () => {
      const holding = new SierraHolding(require('../fixtures/holding-1044923.json'))
      const items = EsCheckinCardItem.fromSierraHolding(holding)
      // First item has null enumeration.enumeration
      // and start_date "Jul. 10, 1999" (and null end_date), so:
      expect(items[0].dateRange()).to.deep.equal([
        { gte: '1999-07-10', lte: '1999-07-10' }
      ])
    })
  })

  describe('enumerationChronology', () => {
    const holding = new SierraHolding(require('../fixtures/holding-1044923.json'))
    const items = EsCheckinCardItem.fromSierraHolding(holding)
    it('returns checkin card item enumeration', () => {
      // First item has null enumeration.enumeration
      // and start_date "Jul. 10, 1999" (and null end_date), so:
      expect(items[0].enumerationChronology()).to.deep.equal([
        'Jul. 10, 1999'
      ])

      // Last item has enumeration.enumeration == "Vol. 30 No. 8"
      // and start_date "Feb. 24, 2001" and null end_date, so:
      expect(items[items.length - 1].enumerationChronology()).to.deep.equal([
        'Vol. 30 No. 8 (Feb. 24, 2001)'
      ])
    })
  })

  describe('enumerationChronology_sort', () => {
    it('returns padded sortable date string if no volume present', () => {
      expect(checkinCardItems[0].enumerationChronology_sort()).to.deep.equal([
        '          -2012-03-01'
      ])
      expect(checkinCardItems[1].enumerationChronology_sort()).to.deep.equal([
        '          -2012-01-01'
      ])
    })

    it('returns padded sortable volume-date string when both vol and date present', () => {
      const holding = new SierraHolding(require('../fixtures/holding-1044923.json'))
      const items = EsCheckinCardItem.fromSierraHolding(holding)
      // First item has null enumeration.enumeration
      // and start_date "Jul. 10, 1999" (and null end_date), so:
      expect(items[0].enumerationChronology_sort()).to.deep.equal([
        '          -1999-07-10'
      ])

      // Last item has enumeration.enumeration == "Vol. 30 No. 8"
      // and start_date "Feb. 24, 2001" and null end_date, so:
      expect(items[items.length - 1].enumerationChronology_sort()).to.deep.equal([
        '        30-2001-02-24'
      ])
    })
  })

  describe('formatLiteral', () => {
    it('returns holding format from 843 $a', () => {
      expect(checkinCardItems[0].formatLiteral()).to.deep.equal([
        'PRINT'
      ])
    })

    it('returns parent bib material type label as holding format when holding lacks 843', () => {
      // Create a holding from which to extract checkin card items:
      const holding = new SierraHolding(require('../fixtures/holding-1044923.json'))
      // Create a esBib instance with a "Text" materialType:
      const esBib = new EsBib(new SierraHolding(require('../fixtures/bib-10554371.json')))
      const items = EsCheckinCardItem.fromSierraHolding(holding, esBib)
      // Because the holding record doesn't have a 843, we expect checkin card
      // items to derive formatLiteral from the esBib.materialType:
      expect(items[0].formatLiteral()).to.deep.equal([
        'Text'
      ])
    })
  })

  describe('holdingLocation', () => {
    it('returns holding record holdingLocation', () => {
      const fakeHolding = { location: { code: 'scf' }, checkInCards: [{ }] }
      const items = EsCheckinCardItem.fromSierraHolding(fakeHolding)
      expect(items[0].holdingLocation()).to.deep.equal([
        { id: 'loc:scf', label: 'Schomburg Center - Research & Reference' }
      ])
    })
  })

  describe('holdingLocation_packed', () => {
    it('returns holding record holdingLocation', () => {
      const fakeHolding = { location: { code: 'scf' }, checkInCards: [{ }] }
      const items = EsCheckinCardItem.fromSierraHolding(fakeHolding)
      expect(items[0].holdingLocation_packed()).to.deep.equal([
        'loc:scf||Schomburg Center - Research & Reference'
      ])
    })
  })

  describe('identifierV2', () => {
    it('returns identifier array with shelfMark', () => {
      expect(checkinCardItems[0].identifierV2()).to.deep.equal([
        { value: 'Sc Ser.-M .N489', type: 'bf:ShelfMark' }
      ])
    })
  })

  describe('shelfMark', () => {
    it('returns relevant shelfMark', () => {
      expect(checkinCardItems[0].shelfMark()).to.deep.equal([
        'Sc Ser.-M .N489'
      ])
    })
  })

  describe('shelfMark_sort', () => {
    it('returns sortable form of shelfMark when available', async () => {
      const v = await checkinCardItems[0].shelfMark_sort()
      expect(v).to.equal('aSc Ser.-M .N000489')
    })

    it('returns sortable form of uri when no shelfmark available', async () => {
      const fakeHolding = {
        id: '1234',
        checkInCards: [{}, {}]
      }
      const items = EsCheckinCardItem.fromSierraHolding(new SierraHolding(fakeHolding))
      const v0 = await items[0].shelfMark_sort()
      const v1 = await items[1].shelfMark_sort()
      expect(v0).to.equal('bi-h1234-0')
      expect(v1).to.equal('bi-h1234-1')
    })
  })

  describe('status', () => {
    it('returns relevant translated status', () => {
      const fakeHolding = {
        checkInCards: [
          { status: { code: 'A' } },
          { status: { code: 'B' } },
          { status: { code: 'M' } }
        ]
      }
      const items = EsCheckinCardItem.fromSierraHolding(fakeHolding)
      // Status "A" checkin-card item is Available:
      expect(items[0].status()).to.deep.equal([
        { id: 'status:a', label: 'Available' } // (sic)
      ])
      // Status "B" checkin-card item is Not available:
      expect(items[1].status()).to.deep.equal([
        { id: 'status:na', label: 'Not available' }
      ])
      // Status "M" checkin-card item is Missing:
      expect(items[2].status()).to.deep.equal([
        { id: 'status:m', label: 'Missing' }
      ])
    })
  })

  describe('status_packed', () => {
    it('returns relevant translated status', () => {
      const fakeHolding = {
        checkInCards: [
          { status: { code: 'A' } },
          { status: { code: 'B' } }
        ]
      }
      const items = EsCheckinCardItem.fromSierraHolding(fakeHolding)
      expect(items[0].status_packed()).to.deep.equal([
        'status:a||Available'
      ])
      expect(items[1].status_packed()).to.deep.equal([
        'status:na||Not available'
      ])
    })
  })

  describe('type', () => {
    it('returns static CheckinCardItem type', () => {
      expect(checkinCardItems[0].type()).to.deep.equal([
        'nypl:CheckinCardItem'
      ])
    })
  })

  describe('volumeRange', () => {
    it('returns null if no checkin card enumeration', () => {
      expect(checkinCardItems[0].volumeRange()).to.equal(null)
    })

    it('returns range if checkin card enumeration', () => {
      const holding = new SierraHolding(require('../fixtures/holding-1044923.json'))
      const items = EsCheckinCardItem.fromSierraHolding(holding)
      // Last item has enumeration.enumeration "Vol. 30 No. 8", so:
      expect(items[items.length - 1].volumeRange()).to.deep.equal([
        { gte: 30, lte: 30 }
      ])
    })
  })

  describe('fromSierraHolding', () => {
    it('should build a EsCheckinCardItem for each holding checkin card item', () => {
      expect(checkinCardItems).to.have.lengthOf(2)
    })

    it('should reflect checkin card index through uri()', () => {
      expect(checkinCardItems[0].uri()).to.equal('i-h1032862-0')
      expect(checkinCardItems[1].uri()).to.equal('i-h1032862-1')
    })
  })
})
