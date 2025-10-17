const NyplStreamsClient = require('@nypl/nypl-streams-client')
const NyplSourceMapper = require('./utils/nypl-source-mapper')
const logger = require('./logger')

let awsCredentials

/**
 *  Given an array of records, writes corresponding events to IndexDocumentProcessed
 *  stream
 */
const notifyDocumentProcessed = async (records) => {
  if (records.length === 0) return Promise.resolve()

  const nyplSourceMapper = await NyplSourceMapper.instance()

  // Build records to post to stream:
  const indexDocumentProcessedRecords = records.map((record) => {
    console.log(record)
    // Set nyplSource based on uri prefix:
    const { nyplSource, id } = nyplSourceMapper.splitIdentifier(record.uri)

    return {
      id,
      nyplSource,
      nyplType: 'bib'
    }
  })

  const streamName = `IndexDocumentProcessed-${process.env.STREAM_ENVIRONMENT}`

  // Pass records to streams client:
  return client()
    .write(streamName, indexDocumentProcessedRecords, { avroSchemaName: 'IndexDocumentProcessed' })
    .then((res) => {
      logger.info(`Wrote ${res.Records.length} records to ${streamName}`)
    }).catch((e) => {
      logger.error(`Error writing to to ${streamName}`, e)
    })
}

let _client

/**
 *  Get Streams Client instance:
 */
const client = () => {
  if (_client) return _client

  const config = {
    nyplDataApiClientBase: process.env.NYPL_API_BASE_URL,
    logLevel: 'error'
  }
  logger.debug(`Building Kinesis client ${awsCredentials ? 'with' : 'without'} local ini-built credentials`)
  if (awsCredentials) {
    // When running locally, pass ini-built credentials:
    config.awsClientOptions = {
      credentials: awsCredentials
    }
  }
  _client = new NyplStreamsClient(config)
  return _client
}

/**
 *  Set the AWS credentials value to use
 */
const setCredentials = (credentials) => {
  logger.debug('Using local ini-built credentials for Kinesis')
  awsCredentials = credentials
}

module.exports = {
  notifyDocumentProcessed,
  setCredentials,
  client
}
