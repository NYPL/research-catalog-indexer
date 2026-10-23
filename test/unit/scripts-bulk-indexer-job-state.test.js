const chai = require('chai')
const fs = require('fs')
const sinon = require('sinon')
const expect = chai.expect

const { JobState } = require('../../scripts/bulk-indexer/job-state')

describe('scripts/bulk-indexer/job-state', () => {
  let writer
  let statefile

  beforeEach(() => {
    writer = sinon.stub(fs, 'writeFileSync').callsFake(() => true)
    sinon.stub(fs, 'existsSync').callsFake(() => !!statefile)
    sinon.stub(fs, 'readFileSync').callsFake(() => JSON.stringify(statefile))
  })

  afterEach(() => {
    fs.writeFileSync.restore()
    if (fs.existsSync.restore) fs.existsSync.restore()
    if (fs.readFileSync.restore) fs.readFileSync.restore()
    statefile = null
  })

  describe('JobState.fromParams', () => {
    it('factory creates an instance', () => {
      const params = { type: 'bib', hasMarc: '123', k1: 'v1', k2: 'v2' }
      const inst = JobState.fromParams(params)

      expect(inst.data.params).to.deep.equal(params)
      expect(inst.basePath).to.equal('bibs-with-marc-123')
    })
  })

  it('filePath reflects params', () => {
    const params = { type: 'bib', hasMarc: '123', k1: 'v1', k2: 'v2' }
    const inst = JobState.fromParams(params)
    expect(inst.filePath()).to.equal('bibs-with-marc-123-status.json')
  })

  describe('loadState', () => {
    it('loads state from disk', () => {
      statefile = { status: 'preparing', params: { type: 'bib', hasMarc: '123', k1: 'v1' } }

      const params = { type: 'bib', hasMarc: '123' }
      const inst = JobState.fromParams(params)

      // Expect it has loaded the extra k1 param from disk:
      expect(inst.data.params.k1).to.equal('v1')
    })

    it('writes state to disk', () => {
      const params = { type: 'bib', hasMarc: '123' }
      JobState.fromParams(params)

      // Where written?
      expect(writer.getCall(0).args[0]).to.equal('bibs-with-marc-123-status.json')

      // What written?
      const dataWritten = JSON.parse(writer.getCall(0).args[1])
      expect(dataWritten).to.deep.include({
        params: {
          type: 'bib',
          hasMarc: '123'
        }
      })
    })
  })

  describe('updateStatus', () => {
    it('updates status', () => {
      const inst = JobState.fromParams({})
      inst.updateStatus('working')

      expect(inst.status()).to.equal('working')
    })

    it('adds log', () => {
      const inst = JobState.fromParams({})
      inst.updateStatus('working', 'Updated')

      expect(inst.status()).to.equal('working')
      expect(inst.data.messages[0].message).to.equal('Updated')
    })
  })
})
