const expect = require('chai').expect
const sinon = require('sinon')
const NyplStreamsClient = require('@nypl/nypl-streams-client')

const streamsClient = require('../../lib/streams-client')

describe('streams-client', () => {
  describe('notifyDocumentProcessed', () => {
    let stubbedStreamsClientWrite

    beforeEach(() => {
      stubbedStreamsClientWrite = sinon.stub(NyplStreamsClient.prototype, 'write').callsFake((stream, records, options) => {
        return Promise.resolve({
          Records: Array(records.length)
        })
      })
    })

    afterEach(() => {
      NyplStreamsClient.prototype.write.restore()
    })

    it('calls nypl-streams-client write method with events', async () => {
      const records = [
        { uri: 'b1234' },
        { uri: 'cb9876' },
        { uri: 'hb5678' }
      ]
      await streamsClient.notifyDocumentProcessed(records)

      expect(stubbedStreamsClientWrite.callCount).to.eq(1)
      expect(stubbedStreamsClientWrite.getCall(0).args).to.deep.equal([
        'IndexDocumentProcessed-test',
        [
          { id: '1234', nyplSource: 'sierra-nypl', nyplType: 'bib' },
          { id: '9876', nyplSource: 'recap-cul', nyplType: 'bib' },
          { id: '5678', nyplSource: 'recap-hl', nyplType: 'bib' }
        ],
        { avroSchemaName: 'IndexDocumentProcessed' }
      ])
    })
  })
})
