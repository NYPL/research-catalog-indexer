const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-as-promised'))
const esClient = require('../../lib/elastic-search/client')

const sinon = require('sinon')

const mappingCheck = require('../../scripts/mapping-check')

describe('scripts/mapping-check', () => {
  const fakeMappings = {
    prop1: {
      type: 'keyword'
    },
    prop2: {
      type: 'date'
    },
    prop3: {
      type: 'text'
    }
  }

  const fakeMappings2 = {
    // Unchanged mapping:
    prop2: {
      type: 'date'
    },
    // Changed mapping:
    prop3: {
      type: 'keyword'
    },
    // New mapping:
    prop4: {
      type: 'keyword'
    }
  }

  beforeEach(() => {
    const getMapping = ({ index }) => {
      return {
        body: {
          [index]: {
            mappings: {
              resource: { properties: fakeMappings }
            }
          }
        }
      }
    }

    sinon.stub(esClient, 'client').resolves({ indices: { getMapping } })
  })

  afterEach(() => {
    esClient.client.restore()
  })

  describe('getMapping', () => {
    it('gets a mapping', async () => {
      const mapping = await mappingCheck.getMapping('some-index')
      expect(mapping).to.deep.equal(fakeMappings)
    })
  })

  describe('mappingsDiff', () => {
    it('identifies differences', async () => {
      expect(mappingCheck.mappingsDiff(fakeMappings, fakeMappings2)).to.deep.equal({
        // Expect prop1 to be reported as local-only:
        localOnlyMappings: [
          { local: { type: 'keyword' }, property: 'prop1' }
        ],
        // Expect prop4 to be reported as a new remote mapping:
        remoteOnlyMappings: [
          { property: 'prop4', remote: { type: 'keyword' } }
        ],
        // Expect prop3 to appear as "unequal":
        unequalMappings: [
          {
            local: { type: 'text' },
            property: 'prop3',
            remote: { type: 'keyword' }
          }
        ]
      })
    })
  })

  describe('run', () => {
    const output = []

    beforeEach(() => {
      sinon.stub(global.console, 'log').callsFake((...args) => {
        output.push(args)
      })

      sinon.stub(mappingCheck, 'currentSchema').callsFake(() => fakeMappings2)
    })

    afterEach(() => {
      global.console.log.restore()
      mappingCheck.currentSchema.restore()
    })

    it('reports on diffs', async () => {
      await mappingCheck.run()

      expect(output).to.have.lengthOf.above(15)
      expect(output[0][0]).to.eq('Running mapping-check on index-name')
      expect(output.find((log) => log[0].includes('Mis-mapped Properties'))).to.be.a('array')
      expect(output.find((log) => log[0].includes('Missing (local-only) Propertie'))).to.be.a('array')
    })
  })
})
