const avro = require('avsc')

const logger = require('./logger')
const platformApi = require('./platform-api/requests')

const CACHE = {}

async function _getSchema (schemaName) {
  // schema in cache; just return it as a instant promise
  if (CACHE[schemaName]) {
    logger.info('cached schema', CACHE[schemaName])
    logger.debug(`Already have ${schemaName} schema`)
    return Promise.resolve(CACHE[schemaName])
  }

  // Fetch schema and parse it as an AVSC decoder
  logger.info('schema name', schemaName)
  const { schemaObject } = await platformApi.getSchema(schemaName)
  if (schemaObject) {
    CACHE[schemaName] = avro.parse(schemaObject)
    return CACHE[schemaName]
  } else {
    throw new Error('no schema object returned')
  }
}

const decodeRecordsFromEvent = async (event) => {
  let bibItemOrHolding = null
  logger.info('event', event)
  // Determine whether event has Bibs or Items by checking end of eventSourceARN string:
  if (/\/Bib/.test(event.Records[0].eventSourceARN)) bibItemOrHolding = 'Bib'
  if (/\/Item/.test(event.Records[0].eventSourceARN)) bibItemOrHolding = 'Item'
  if (/\/Holding/.test(event.Records[0].eventSourceARN)) bibItemOrHolding = 'Holding'
  // Fail if the eventSourceARN didn't tell us what we're handling
  if (!bibItemOrHolding) throw new Error('Unrecognized eventSourceARN. Aborting. ' + event.Records[0].eventSourceARN)

  logger.info('Using schema: ' + bibItemOrHolding)
  const schemaType = await _getSchema(bibItemOrHolding)
  // Get array of decoded records:
  const decoded = event.Records.map((record) => {
    const kinesisData = Buffer.from(record.kinesis.data, 'base64')
    return schemaType.fromBuffer(kinesisData)
  })
  logger.debug('Processing ' + bibItemOrHolding + ' records: ', decoded)

  return { type: bibItemOrHolding, records: decoded }
}

module.exports = { decodeRecordsFromEvent, _getSchema }
