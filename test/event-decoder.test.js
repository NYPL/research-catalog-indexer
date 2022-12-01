const eventDecoder = require('../lib/event-decoder')
const sinon = require('sinon')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect

describe('eventDecoder', () => {
  const [bibEvent, itemEvent, holdingEvent, errorEvent] = ['Bib', 'Item', 'Holding', 'spaghet'].map((type) => ({ Records: [{ kinesis: { data: { [type]: {} } }, eventSourceARN: type }] }))

  before(() => {
    sinon.stub(eventDecoder, '_getSchema').resolves({
      fromBuffer: (data) => ({ id: '12345678' })
    })
  })
  it('decodes a bib event', async () => {
    expect(eventDecoder.decodeRecordsFromEvent(bibEvent)).to.eventually.equal([{ type: 'Bib', records: [{ id: '12345678' }] }])
  })
  it('decodes a holding event', () => {
    expect(eventDecoder.decodeRecordsFromEvent(holdingEvent)).to.eventually.equal([{ type: 'Holding', records: [{ id: '12345678' }] }])
  })
  it('decodes an item event', () => {
    expect(eventDecoder.decodeRecordsFromEvent(itemEvent)).to.eventually.equal([{ type: 'Item', records: [{ id: '12345678' }] }])
  })
  it('throws on invalid schema', () => {
    expect(eventDecoder.decodeRecordsFromEvent(errorEvent)).to.eventually.throw('Unrecognized eventSourceARN. Aborting. ' + errorEvent.Records[0].eventSourceARN)
  })
})
