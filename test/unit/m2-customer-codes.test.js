const expect = require('chai').expect
const sinon = require('sinon')

const platformApi = require('../../lib/platform-api/requests')
const SierraBib = require('../../lib/sierra-models/bib')
const { attachM2CustomerCodesToBibs } = require('../../lib/utils/m2-customer-codes')

describe('attachM2CustomerCodesToBibs', () => {
  before(() => {
    const m2CustomerCodesApiStub = (barcodes) => {
      if (barcodes.length) return { 123: 'XX', 456: 'YY' }
      else return {}
    }
    // stub m2 service to return m2codes for barcodes
    sinon.stub(platformApi, 'm2CustomerCodesForBarcodes')
      .callsFake(m2CustomerCodesApiStub)
  })

  after(() => {
    platformApi.m2CustomerCodesForBarcodes.restore()
  })

  it('attaches m2 codes with valid location codes', async () => {
    const bibs = [
      new SierraBib({
        _items: [
          { location: { code: 'mal9' }, barcode: '123' },
          { location: { code: 'mal9' }, barcode: '456' }
        ]
      })
    ]
    const bibsWithM2Codes = await attachM2CustomerCodesToBibs(bibs)
    expect(bibsWithM2Codes[0]._items[0]._m2CustomerCode).to.equal('XX')
    expect(bibsWithM2Codes[0]._items[1]._m2CustomerCode).to.equal('YY')
  })

  it('does not attach m2 codes with invalid location codes', async () => {
    const bibs = [
      new SierraBib({
        _items: [
          { location: { code: 'lol' }, barcode: '456' },
          { location: { code: 'lol' }, barcode: '123' }
        ]
      })
    ]
    const bibsWithoutM2Codes = await attachM2CustomerCodesToBibs(bibs)
    expect(bibsWithoutM2Codes[0]._items[0]._m2CustomerCode).to.be.a('undefined')
  })
})
