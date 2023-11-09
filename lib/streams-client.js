const NyplStreamsClient = require('@nypl/nypl-streams-client')
const NyplSourceMapper = require('./utils/nypl-source-mapper')
const logger = require('./logger')

/**
 *  Given an array of records, writes corresponding events to IndexDocumentProcessed
 *  stream
 */
const notifyDocumentProcessed = async (records) => {
  if (records.length === 0) return Promise.resolve()

  const nyplSourceMapper = await NyplSourceMapper.instance()

  // Build records to post to stream:
  const indexDocumentProcessedRecords = records.map((record) => {
    // Set nyplSource based on uri prefix:
    const { nyplSource, id } = nyplSourceMapper.splitIdentifier(record.uri)

    return {
      id,
      nyplSource,
      nyplType: 'bib'
    }
  })

  const client = new NyplStreamsClient({ nyplDataApiClientBase: process.env.NYPL_API_BASE_URL, logLevel: 'error' })
  const streamName = `IndexDocumentProcessed-${process.env.STREAM_ENVIRONMENT}`

  // Pass records to streams client:
  return client
    .write(streamName, indexDocumentProcessedRecords, { avroSchemaName: 'IndexDocumentProcessed' })
    .then((res) => {
      logger.info(`Wrote ${res.Records.length} records to ${streamName}`)
    }).catch((e) => {
      logger.error(`Error writing to to ${streamName}`, e)
    })
}

module.exports = {
  notifyDocumentProcessed
}
