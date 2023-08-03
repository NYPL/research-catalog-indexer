const expect = require('chai').expect
const { parse: parseQueryString } = require('querystring')

const { stubNyplSourceMapper } = require('./utils')

const SierraItem = require('../../lib/sierra-models/item')
const EsItem = require('../../lib/es-models/item')
const SierraBib = require('../../lib/sierra-models/bib')
const EsBib = require('../../lib/es-models/bib')

const { aeonUrlForItem } = require('../../lib/utils/aeon-urls')

describe('aeonn-urls', () => {
  beforeEach(() => {
    stubNyplSourceMapper()
  })

  it('returns nothing for item with no Aeon site code', async () => {
    const record = new SierraItem(require('../fixtures/item-10003973.json'))
    const esItem = new EsItem(record)
    const url = await aeonUrlForItem(esItem)
    expect(url).to.eq(null)
  })

  it('returns Aeon URL for item with a valid fieldTag x', async () => {
    const record = new SierraItem(require('../fixtures/item-37528709.json'))
    const esItem = new EsItem(record)

    const url = await aeonUrlForItem(esItem)
    // Note no esBib is associated, so fields are unnaturally light:
    expect(url).to.eq('https://specialcollections.nypl.org/aeon/Aeon.dll?Action=10&Form=30&Site=SCHMIRS&CallNumber=Sc+Visual+DVD-362+Disc+2&ItemInfo1=Use+in+library&ItemNumber=33433124443791&ItemISxN=i375287097&Location=Schomburg+Moving+Images+and+Recorded+Sound')
  })

  it('returns Aeon URL with metadata fields pulled from bib', async () => {
    const esBib = new EsBib(new SierraBib(require('../fixtures/bib-22027953.json')))
    const esItem = new EsItem(new SierraItem(require('../fixtures/item-37528709.json')), esBib)

    const url = await aeonUrlForItem(esItem)
    const [baseUrl, queryString] = url.split('?')

    expect(baseUrl).to.equal('https://specialcollections.nypl.org/aeon/Aeon.dll')
    expect(parseQueryString(queryString)).to.deep.equal({
      Action: '10',
      CallNumber: 'Sc Visual DVD-362 Disc 2',
      Date: '2012',
      Form: '30',
      Location: 'Schomburg Moving Images and Recorded Sound',
      ItemInfo1: 'Use in library',
      ItemInfo3: 'https://catalog.nypl.org/record=b22027953',
      ItemISxN: 'i375287097',
      ItemNumber: '33433124443791',
      ItemPlace: 'New York',
      ItemPublisher: 'Schomburg Center for Research in Black Culture',
      ReferenceNumber: 'b220279536',
      Site: 'SCHMIRS',
      Title: 'Documenting history in your own backyard : a symposium for archiving & preserving hip-hop culture'
    })
  })
})
