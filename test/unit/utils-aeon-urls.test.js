const expect = require('chai').expect
const { parse: parseQueryString } = require('querystring')

const { stubNyplSourceMapper } = require('./utils')

const SierraItem = require('../../lib/sierra-models/item')
const EsItem = require('../../lib/es-models/item')
const SierraBib = require('../../lib/sierra-models/bib')
const EsBib = require('../../lib/es-models/bib')

const { aeonUrlForItem } = require('../../lib/utils/aeon-urls')

describe('aeon-urls', () => {
  beforeEach(() => {
    stubNyplSourceMapper()
  })

  it('returns nothing for item with no Aeon site code', async () => {
    const record = new SierraItem(require('../fixtures/item-10003973.json'))
    const esItem = new EsItem(record)
    const url = await aeonUrlForItem(esItem)
    expect(url).to.eq(null)
  })

  it('returns nothing for unrecognized Aeon site codes', async () => {
    const sierraItem = new SierraItem({
      varFields: [
        {
          fieldTag: 'x',
          content: 'AEON eligible SCHLEMIEL'
        }
      ]
    })
    const esItem = new EsItem(sierraItem)

    const url = await aeonUrlForItem(esItem)
    expect(url).to.eq(null)
  })

  it('returns Aeon URL for item with a valid fieldTag x', async () => {
    const record = new SierraItem(require('../fixtures/item-37528709.json'))
    const esItem = new EsItem(record)

    const url = await aeonUrlForItem(esItem)
    // Note no esBib is associated, so fields are unnaturally light:
    expect(url).to.eq('https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&CallNumber=Sc+Visual+DVD-362&Form=30&Genre=moving+image&ItemInfo1=Use+in+library&ItemISxN=i375287097&ItemNumber=33433124443791&ItemVolume=Disc+2&Location=Schomburg+Moving+Image+and+Recorded+Sound&Site=SCHMIRS')
  })

  it('returns Aeon URL with metadata fields pulled from bib', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    const sierraBib = new SierraBib(require('../fixtures/bib-22027953.json'))
    sierraItem._bibs = [sierraBib]
    const esItem = new EsItem(sierraItem, new EsBib(sierraBib))

    const url = await aeonUrlForItem(esItem)
    const [baseUrl, queryString] = url.split('?')

    expect(baseUrl).to.equal('https://specialcollections.nypl.org/aeon/Aeon.dll')
    expect(parseQueryString(queryString)).to.deep.equal({
      Action: '10',
      CallNumber: 'Sc Visual DVD-362',
      Date: '2012',
      Form: '30',
      Genre: 'moving image',
      Location: 'Schomburg Moving Image and Recorded Sound',
      ItemInfo1: 'Use in library',
      ItemInfo3: 'https://catalog.nypl.org/record=b22027953',
      ItemISxN: 'i375287097',
      ItemNumber: '33433124443791',
      ItemPlace: 'New York',
      ItemPublisher: 'Schomburg Center for Research in Black Culture, 2012.',
      ItemVolume: 'Disc 2',
      ReferenceNumber: 'b220279536',
      Site: 'SCHMIRS',
      Title: 'Documenting history in your own backyard : a symposium for archiving & preserving hip-hop culture'
    })
  })

  it('encodes diacritics', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    const sierraBib = new SierraBib({
      nyplSource: 'sierra-nypl',
      id: '1234',
      varFields: [
        {
          marcTag: '245',
          subfields: [
            { tag: 'a', content: 'Token1' },
            { tag: 'b', content: 'Töken2' },
            { tag: 'k', content: 'Tokén3' },
            { tag: 'f', content: 'Tokeñ4' },
            { tag: 'g', content: 'Token5' }
          ]
        }
      ]
    })
    sierraItem._bibs = [sierraBib]
    const esItem = new EsItem(sierraItem, new EsBib(sierraBib))

    const url = await aeonUrlForItem(esItem)
    expect(url).to.eq('https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&CallNumber=Sc+Visual+DVD-362&Form=30&Genre=moving+image&ItemInfo1=Use+in+library&ItemInfo3=https%3A%2F%2Fcatalog.nypl.org%2Frecord%3Db1234&ItemISxN=i375287097&ItemNumber=33433124443791&ItemVolume=Disc+2&Location=Schomburg+Moving+Image+and+Recorded+Sound&ReferenceNumber=b12348&Site=SCHMIRS&Title=Token1+T%C3%B6ken2+Tok%C3%A9n3+Toke%C3%B14+Token5')

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString).Title).to.equal(
      'Token1 Töken2 Tokén3 Tokeñ4 Token5'
    )
  })

  it('encodes special characters in shelfmarks', async () => {
    const sierraItem = new SierraItem({
      varFields: [
        {
          marcTag: '852',
          subfields: [
            { tag: 'h', content: 'special+ "characters" % & * = #' }
          ]
        },
        {
          fieldTag: 'x',
          content: 'AEON eligible SCHMIRS'
        }
      ]
    })
    const esItem = new EsItem(sierraItem)

    const url = await aeonUrlForItem(esItem)
    expect(url).to.eq('https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&CallNumber=special%2B+%22characters%22+%25+%26+*+%3D+%23&Form=30&Location=Schomburg+Moving+Image+and+Recorded+Sound&Site=SCHMIRS')

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString).CallNumber)
      .to.equal('special+ "characters" % & * = #')
  })

  it('Uses bib 506 for ItemInfo2, truncated to 255', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    // This bib has a 506:
    const sierraBib = new SierraBib(require('../fixtures/bib-19834195.json'))
    sierraItem._bibs = [sierraBib]
    const esItem = new EsItem(sierraItem, new EsBib(sierraBib))

    const url = await aeonUrlForItem(esItem)
    const [, queryString] = url.split('?')
    const useStatement = parseQueryString(queryString).ItemInfo2
    expect(useStatement).to.equal(
      'Collection is open to the public. Library policy on photocopying will apply. Advance notice may be required. Inquiries regarding audio and video materials in the series may be directed to the Billy Rose Theatre Division (theatre@nypl.org). Audio/visual m…'
    )
    expect(useStatement.length).to.equal(255)
  })

  it('uses parallel title when it exists', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    const sierraBib = new SierraBib({
      nyplSource: 'sierra-nypl',
      id: '1234',
      varFields: [
        {
          marcTag: '880',
          subfields: [
            { tag: '6', content: '245-01/(3/r' },
            { tag: 'a', content: 'parallel value 1' },
            { tag: 'b', content: 'parallel value 2' }
          ]
        }
      ]
    })
    sierraItem._bibs = [sierraBib]
    const esItem = new EsItem(sierraItem, new EsBib(sierraBib))

    const url = await aeonUrlForItem(esItem)
    expect(url).to.eq('https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&CallNumber=Sc+Visual+DVD-362&Form=30&Genre=moving+image&ItemInfo1=Use+in+library&ItemInfo3=https%3A%2F%2Fcatalog.nypl.org%2Frecord%3Db1234&ItemISxN=i375287097&ItemNumber=33433124443791&ItemVolume=Disc+2&Location=Schomburg+Moving+Image+and+Recorded+Sound&ReferenceNumber=b12348&Site=SCHMIRS&Title=parallel+value+1+parallel+value+2')
  })

  it('extracts bib 651', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    const sierraBib = new SierraBib(require('../fixtures/bib-15088995.json'))
    sierraItem._bibs = [sierraBib]

    const esItem = new EsItem(sierraItem, new EsBib(sierraBib))

    const url = await aeonUrlForItem(esItem)

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString)['Transaction.CustomFields.Custom651']).to.equal(
      'Brazil Maps.'
    )
  })

  it('extracts MapsLocationNote from item 852', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-19885371.json'))
    const esItem = new EsItem(sierraItem)

    const url = await aeonUrlForItem(esItem)

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString)['Transaction.CustomFields.MapsLocationNote']).to.equal(
      '[Oversize - Filed with Oversize Asia Whole,Part & Local]'
    )
  })

  it('extracts SierraLocationCode for Maps items', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-19885371.json'))
    const esItem = new EsItem(sierraItem)

    const url = await aeonUrlForItem(esItem)

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString)['Transaction.CustomFields.SierraLocationCode']).to.equal(
      'mapp1'
    )
  })

  it('excludes SierraLocationCode for non-Maps items', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    const esItem = new EsItem(sierraItem)

    const url = await aeonUrlForItem(esItem)

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString)['Transaction.CustomFields.SierraLocationCode']).to.be.a('undefined')
  })

  it('includes 260 $b in ItemPublisher', async () => {
    const sierraItem = new SierraItem(require('../fixtures/item-37528709.json'))
    const sierraBib = new SierraBib(require('../fixtures/bib-15088995.json'))
    sierraItem._bibs = [sierraBib]

    const esItem = new EsItem(sierraItem, new EsBib(sierraBib))

    const url = await aeonUrlForItem(esItem)

    const [, queryString] = url.split('?')
    expect(parseQueryString(queryString).ItemPublisher).to.equal(
      'Arte & História, 2000.'
    )
  })
})
