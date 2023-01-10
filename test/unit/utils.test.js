const expect = require('chai').expect

const {
  prefilterBibs,
  prefilterItems
} = require('../../lib/utils')

describe('prefilterBibs', async function () {
  const mockBibs = [
    { nyplSource: 'recap-pul', title: 'a' },
    { nyplSource: 'sierra-nypl', title: 'b' },
    { nyplSource: 'sierra-nypl', locations: [{ code: 'none' }], title: 'c' },
    { nyplSource: 'sierra-nypl', locations: [{ code: 'os' }], title: 'd' },
    { nyplSource: 'sierra-nypl', locations: [{ code: 'maor2' }], title: 'e' },
    { nyplSource: 'sierra-nypl', locations: [{ code: 'mpa0w' }], title: 'f' },
    { nyplSource: 'sierra-nypl', locations: [{ code: 'myar1' }], title: 'g' }
  ]

  const filteredMockbibs = await prefilterBibs(mockBibs)

  it('should retain partner items', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'a')).to.equal(true)
  })

  it('should retain bibs with missing locations', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'b')).to.equal(true)
  })

  it('should retain bibs with location none', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'c')).to.equal(true)
  })

  it('should retain bibs with location \'os\'', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'd')).to.equal(true)
  })

  it('should retain bibs with research collection types', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'e')).to.equal(true)
  })

  it('should remove bibs with only branch collection types', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'f')).to.equal(false)
  })

  it('should retain bibs with mixed collection types', async function () {
    expect(!!filteredMockbibs.find(bib => bib.title === 'g')).to.equal(true)
  })
})

describe('prefilterItems', async function () {
  const mockItems = [
    { nyplSource: 'recap-cul', uri: 1 },
    { nyplSource: 'sierra-nypl', uri: 2, fixedFields: { fake: { value: 1000, label: 'Item Type' } } },
    { nyplSource: 'sierra-nypl', uri: 3, fixedFields: { fake: { value: 0, label: 'Item Type' } } },
    { nyplSource: 'sierra-nypl', uri: 4, fixedFields: { fake: { value: 132, label: 'Item Type' } } },
    { nyplSource: 'sierra-nypl', uri: 5, fixedFields: { fake: { value: 101, label: 'Item Type' } } }
  ]

  const filteredMockItems = await prefilterItems(mockItems)

  it('should retain partner items', async function () {
    expect(!!filteredMockItems.find(item => item.uri === 1)).to.equal(true)
  })

  it('should retain items without recognized item types', async function () {
    expect(!!filteredMockItems.find(item => item.uri === 2)).to.equal(true)
  })

  it('should retain items with research collection types', async function () {
    expect(!!filteredMockItems.find(item => item.uri === 3)).to.equal(true)
  })

  it('should retain items with mixed collection types', async function () {
    expect(!!filteredMockItems.find(item => item.uri === 4)).to.equal(true)
  })

  it('should remove items with circulating collection types', async function () {
    expect(!!filteredMockItems.find(item => item.uri === 5)).to.equal(false)
  })
})
