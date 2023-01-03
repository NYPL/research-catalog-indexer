// const SierraBib = require('../../lib/sierra-models/bib')
const recapFuncs = require('../../lib/scsb/requests')
const { nyplScsbMultiItemBib, nyplPlatformMultiItemBib, nyplScsbSingleItemBib, nyplPlatformSingleItemBib, partnerPlatformBib, nyplOnsiteBib } = require('../fixtures/attach-recap-code')
const sinon = require('sinon')
const ScsbClient = require('../../lib/scsb/client')
const { expect } = require('chai')

describe('SCSB requests', () => {
  const bib = {
    id: '15830171',
    isNypl: () => true,
    isInRecap: () => true
  }
  describe('createRecapCodeMap', () => {
    afterEach(() => {
      ScsbClient.client.restore()
    })
    it('returns a hash mapping itemIds to recap codes - multiple items', async () => {
      sinon.stub(ScsbClient, 'client').callsFake(() => Promise.resolve({ search: () => nyplScsbMultiItemBib }))
      const hashMap = await recapFuncs.private._createRecapCodeMap(bib)
      expect(hashMap).to.deep.equal({ 1: 'A', 2: 'B', 3: 'C' })
    })
    it('returns a hash mapping itemId to recap codes - single items', async () => {
      sinon.stub(ScsbClient, 'client').callsFake(() => Promise.resolve({ search: () => nyplScsbSingleItemBib }))
      const hashMap = await recapFuncs.private._createRecapCodeMap(bib)
      expect(hashMap).to.deep.equal({ 12235900: 'NA' })
    })
    it('sends bibId with correct check digit', async () => {
      const scsbClientStub = sinon.stub(ScsbClient, 'client')
      const scsbSearchSpy = sinon.spy(scsbClientStub.search)
      scsbClientStub.callsFake(() => Promise.resolve({
        search: scsbSearchSpy
      }))
      await recapFuncs.private._createRecapCodeMap(bib)
      expect(scsbSearchSpy.calledWith({ deleted: false, fieldValue: '.b158301717', fieldName: 'OwningInstitutionBibId', owningInstitutions: ['NYPL'] })).to.equal(true)
    })
  })

  describe('attachRecapCustomerCodes', () => {
    it('adds recap codes to the correct item - multiple items', async () => {
      sinon.stub(ScsbClient, 'client').callsFake(() => Promise.resolve({ search: () => nyplScsbMultiItemBib }))
      const attachedBib = await recapFuncs.attachRecapCustomerCodes(nyplPlatformMultiItemBib)
      expect(attachedBib.items[0].recapCustomerCode).to.equal('A')
      expect(attachedBib.items[1].recapCustomerCode).to.equal('B')
      expect(attachedBib.items[2].recapCustomerCode).to.equal('C')
      expect(attachedBib.items[3].recapCustomerCode).to.equal(undefined)
      ScsbClient.client.restore()
    })
    it('adds recap codes to the correct item - single item', async () => {
      sinon.stub(ScsbClient, 'client').callsFake(() => Promise.resolve({ search: () => nyplScsbSingleItemBib }))
      const attachedBib = await recapFuncs.attachRecapCustomerCodes(nyplPlatformSingleItemBib)
      expect(attachedBib.items[0].recapCustomerCode).to.equal('NA')
      ScsbClient.client.restore()
    })
    it('does nothing to partner bibs', async () => {
      const attachedBib = await recapFuncs.attachRecapCustomerCodes(partnerPlatformBib)
      expect(attachedBib).to.equal(partnerPlatformBib)
    })
    it('does nothing to non-recap bibs', async () => {
      const attachedBib = await recapFuncs.attachRecapCustomerCodes(nyplOnsiteBib)
      expect(attachedBib).to.equal(nyplOnsiteBib)
    })
  })
})
