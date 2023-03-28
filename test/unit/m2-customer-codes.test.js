const expect = require('chai').expect
const sinon = require('sinon')
const platformApi = require('../../lib/platform-api/requests')
const { attachM2CustomerCodes } = require('../../lib/utils/m2-customer-codes')

describe('attachM2CustomerCodes', () => {
  before(() => {
    const m2CustomerCodesApiStub = () => ({ 123: 'XX', 456: 'YY' })
    // stub m2 service to return m2codes for barcodes
    sinon.stub(platformApi, 'm2CustomerCodesForBarcodes')
      .callsFake(m2CustomerCodesApiStub)
  })
  after(() => {
    platformApi.m2CustomerCodesForBarcodes.restore()
  })
  it('attaches m2 codes', async () => {
    const bib = { items: () => [{ location: { code: 'mal9' }, barcode: '123' }, { location: { code: 'mal9' }, barcode: '456' }] }
    const bibWithM2Codes = await attachM2CustomerCodes(bib)
    expect(bibWithM2Codes._items.map(item => item.m2CustomerCode)).to.deep.equal(['XX', 'YY'])
  })
})
