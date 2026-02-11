const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs')
const { SQSClient } = require('@aws-sdk/client-sqs')
const { emitBrowseTerms } = require('../../lib/browse-terms')

describe('emitBrowseTerms', () => {
  const generateDocs = (count, fieldName) => {
    return Array.from({ length: count }, (_, i) => ({
      [fieldName]: () => [`${fieldName}-${i}`]
    }))
  }

  beforeEach(() => {
    sinon.stub(fs, 'writeFileSync')
    sinon.stub(SQSClient.prototype, 'send').resolves({ MessageId: '123' })
    sinon.stub(Date, 'now').returns(123456789)

    delete process.env.BROWSE_TERM_OUTPUT_DIRECTORY
    delete process.env.ENCRYPTED_SQS_BROWSE_TERM_URL
  })

  afterEach(() => {
    if (fs.writeFileSync.restore) fs.writeFileSync.restore()
    if (Date.now.restore) Date.now.restore()
    if (SQSClient.prototype.send.restore) SQSClient.prototype.send.restore()
  })

  describe('Local File Output', () => {
    it('writes to local file system when BROWSE_TERM_OUTPUT_DIRECTORY is present', async () => {
      process.env.BROWSE_TERM_OUTPUT_DIRECTORY = '/tmp'
      const docs = generateDocs(3, 'subjectLiteral')
      await emitBrowseTerms(docs, 'subject', 'subjectLiteral')
      expect(fs.writeFileSync.calledOnce).to.equal(true)
      const fsCall = fs.writeFileSync.firstCall
      expect(fsCall.args[0]).to.equal('/tmp/subject-123456789.json')
      const records = JSON.parse(fsCall.args[1])
      const expectedData = {
        Records: [
          {
            body: JSON.stringify({
              termType: 'subject',
              terms: ['subjectLiteral-0', 'subjectLiteral-1', 'subjectLiteral-2']
            })
          }
        ]
      }
      expect(records).to.deep.equal(expectedData)
    })
  })

  describe('SQS Output', () => {
    it('sends to SQS', async () => {
      process.env.ENCRYPTED_SQS_BROWSE_TERM_URL = 'browse_term_url'
      const docs = generateDocs(1, 'contributorRoleLiteral')
      await emitBrowseTerms(docs, 'contributor', 'contributorRoleLiteral')
      expect(SQSClient.prototype.send.calledOnce).to.equal(true)
      const sqsCall = SQSClient.prototype.send.firstCall
      expect(sqsCall.args[0].input.QueueUrl).to.equal('browse_term_url')
    })

    it('handles batching when exceeding MAX_TERMS_PER_MESSAGE', async () => {
      process.env.ENCRYPTED_SQS_BROWSE_TERM_URL = 'browse_term_url'
      const docs = generateDocs(1001, 'subjectLiteral', 'term')
      await emitBrowseTerms(docs, 'subject', 'subjectLiteral')
      expect(SQSClient.prototype.send.calledTwice).to.equal(true)
    })
  })
})
