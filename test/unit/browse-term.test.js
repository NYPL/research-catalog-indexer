const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs')
const { SQSClient } = require('@aws-sdk/client-sqs')
const { emitBrowseTerms } = require('../../lib/browse-terms')
const SierraBib = require('../../lib/sierra-models/bib')
const EsBib = require('../../lib/es-models/bib')

describe('emitBrowseTerms', () => {
  const generateDoc = () => {
    const record = new SierraBib(require('../fixtures/bib-hl990000453050203941.json'))
    return [new EsBib(record)]
  }

  beforeEach(() => {
    sinon.stub(fs, 'writeFileSync')
    sinon.stub(SQSClient.prototype, 'send').resolves({ MessageId: '123' })
    sinon.stub(Date, 'now').returns(123456789)

    delete process.env.BROWSE_TERM_OUTPUT_DIRECTORY
    delete process.env.MAX_TERMS_PER_MESSAGE
    delete process.env.ENCRYPTED_SQS_BROWSE_TERM_URL
  })

  afterEach(() => {
    if (fs.writeFileSync.restore) fs.writeFileSync.restore()
    if (Date.now.restore) Date.now.restore()
    if (SQSClient.prototype.send.restore) SQSClient.prototype.send.restore()
  })

  describe('Local File Output', () => {
    it('writes subjects to local file system when BROWSE_TERM_OUTPUT_DIRECTORY is present', async () => {
      process.env.BROWSE_TERM_OUTPUT_DIRECTORY = '/tmp'
      const docs = generateDoc()
      await emitBrowseTerms(docs, 'subject')
      expect(fs.writeFileSync.calledOnce).to.equal(true)
      const fsCall = fs.writeFileSync.firstCall
      expect(fsCall.args[0]).to.equal('/tmp/subject-123456789.json')
      const records = JSON.parse(fsCall.args[1])
      const expectedData = {
        Records: [
          {
            body: JSON.stringify({
              termType: 'subject',
              terms: [{ preferredTerm: 'Law -- Israel.' }, { preferredTerm: 'Lawyers -- Israel.' }, { preferredTerm: 'Attorney and client -- Israel.' }]
            })
          }
        ]
      }
      expect(records).to.deep.equal(expectedData)
    })
    it('writes contributors to local file system when BROWSE_TERM_OUTPUT_DIRECTORY is present', async () => {
      process.env.BROWSE_TERM_OUTPUT_DIRECTORY = '/tmp'
      const docs = generateDoc()
      await emitBrowseTerms(docs, 'contributor')
      expect(fs.writeFileSync.calledOnce).to.equal(true)
      const fsCall = fs.writeFileSync.firstCall
      expect(fsCall.args[0]).to.equal('/tmp/contributor-123456789.json')
      const records = JSON.parse(fsCall.args[1])
      const expectedData = {
        Records: [
          {
            body: JSON.stringify({
              termType: 'contributor',
              terms: [{ preferredTerm: 'Israel' }, { preferredTerm: 'Ginosar, Sh. (Shaleṿ), 1902-' }]
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
      const docs = generateDoc()
      await emitBrowseTerms(docs, 'contributor')
      expect(SQSClient.prototype.send.calledOnce).to.equal(true)
      const sqsCall = SQSClient.prototype.send.firstCall
      expect(sqsCall.args[0].input.QueueUrl).to.equal('browse_term_url')
    })

    it('handles batching when exceeding MAX_TERMS_PER_MESSAGE', async () => {
      process.env.ENCRYPTED_SQS_BROWSE_TERM_URL = 'browse_term_url'
      process.env.MAX_TERMS_PER_MESSAGE = 2
      const docs = generateDoc()
      await emitBrowseTerms(docs, 'subject')
      expect(SQSClient.prototype.send.calledTwice).to.equal(true)
    })
  })
})
