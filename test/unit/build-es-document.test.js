const expect = require('chai').expect
const sinon = require('sinon')

const SierraBib = require('../../lib/sierra-models/bib')
const platformApi = require('../../lib/platform-api/requests')
const { transformIntoBibRecords } = require('../../lib/build-es-document')

describe('build-es-document', () => {
  describe('transformIntoBibRecords', () => {
    before(() => {
      // Stub bibsForHoldingsOrItems to return fake bibs:
      sinon.stub(platformApi, 'bibsForHoldingsOrItems')
        .callsFake((type, itemsOrHoldings) => {
          return Promise.resolve(
            itemsOrHoldings
              .map((record) => {
                return new SierraBib({ id: `bib for ${type} ${record.id}` })
              })
          )
        })
    })

    after(() => {
      platformApi.bibsForHoldingsOrItems.restore()
    })

    it('is a no-op if type is Bib', async () => {
      const input = ['fladeedle', 'dee']
      const output = await transformIntoBibRecords('Bib', input)
      expect(output).to.deep.equal(input)
    })

    it('converts array of items into array of SierraBibs', async () => {
      const input = [
        // Two Research items:
        { id: 1, location: { code: 'ma' } },
        { id: 2, location: { code: 'sc' } }
      ]
      const output = await transformIntoBibRecords('Item', input)

      expect(output[0]).to.be.instanceOf(SierraBib)
      expect(output[0]).to.deep.include({
        id: 'bib for Item 1'
      })
      expect(output[1]).to.deep.include({
        id: 'bib for Item 2'
      })
    })

    it('converts array of holdings into array of SierraBibs', async () => {
      const input = [
        // Two fake holdings:
        { id: 1 },
        { id: 2 }
      ]
      const output = await transformIntoBibRecords('Holding', input)

      expect(output[0]).to.be.instanceOf(SierraBib)
      expect(output[0]).to.deep.include({
        id: 'bib for Holding 1'
      })
      expect(output[1]).to.deep.include({
        id: 'bib for Holding 2'
      })
    })
  })
})
