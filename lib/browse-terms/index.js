const logger = require('../logger')
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs')
const kms = require('../kms')
const fs = require('fs')

/**
 * Callback method to map over browse term objects
 * @param {{preferredTerm: string, variant?: string}[]} batch
 * @returns PseudoSQSEvent[]
 */
const convertBatchToEventForLocalBti = (batch) => {
  return {
    Records: batch.map((subject) => ({
      body: JSON.stringify(subject)
    }))
  }
}

const createSQSEvent = (bulkBrowseTerms, url) => {
  return new SendMessageCommand({
    QueueUrl: url,
    MessageBody: JSON.stringify(bulkBrowseTerms)
  })
}

const emitBrowseTerms = async (esDocuments, termType) => {
  const uniqueTerms = []
  esDocuments.flatMap(doc => doc.browseTermData[termType]).forEach(browseTerm => {
    uniqueTerms.push({
      preferredTerm: termType === 'subject' ? browseTerm.label : browseTerm.name,
      variant: browseTerm.variant
    })
  })
  const bulkBrowseTerms = []
  const maxMessages = process.env.MAX_TERMS_PER_MESSAGE ? process.env.MAX_TERMS_PER_MESSAGE : 500
  for (let i = 0; i < uniqueTerms.length; i += maxMessages) {
    const chunk = uniqueTerms.slice(i, i + maxMessages)
    bulkBrowseTerms.push({
      termType,
      terms: chunk
    })
  }

  if (bulkBrowseTerms.length === 0) {
    logger.info(`emitBrowseTerms: No browse terms to emit for ${termType}`)
    return
  }
  try {
    if (process.env.BROWSE_TERM_OUTPUT_DIRECTORY) {
      const batchedEvents = convertBatchToEventForLocalBti(bulkBrowseTerms)
      const timestamp = Date.now()
      const eventFile = `${process.env.BROWSE_TERM_OUTPUT_DIRECTORY}/${termType}-${timestamp}.json`
      logger.info(`Emitting ${uniqueTerms.length} ${termType} browse terms across ${bulkBrowseTerms.length} messages to local path ${eventFile}`)
      fs.writeFileSync(eventFile, JSON.stringify(batchedEvents, null, 2))
    } else {
      if (!process.env.ENCRYPTED_SQS_BROWSE_TERM_URL) {
        logger.warn(`Missing SQS stream. Cannot write browse terms for ${termType}`)
        return
      }

      const sqsUrl = await kms.decrypt(process.env.ENCRYPTED_SQS_BROWSE_TERM_URL)
      logger.info(`Emitting ${uniqueTerms.length} ${termType} browse terms across ${bulkBrowseTerms.length} messages to SQS ${sqsUrl}`)
      const sqsClient = new SQSClient({})
      const responses = await Promise.allSettled(bulkBrowseTerms.map(async (bulkBrowseTerm) => await sqsClient.send(createSQSEvent(bulkBrowseTerm, sqsUrl))))
      parseBatchCommandResponses(responses)
    }
  } catch (e) {
    logger.error(`emitBrowseTerms error:\n ${e}`)
  }
}

const parseBatchCommandResponses = (responses) => {
  const success = responses.filter(({ status }) => status === 'fulfilled')
  const error = responses.filter(({ status }) => status === 'rejected')
  const destination = process.env.BTI_INDEX_PATH ? 'local bti' : 'SQS'
  logger.info(`emitBrowseTermsToSqs: ${success.length} batches of subjects successfully sent to ${destination}`)
  if (error.length) logger.info(`emitBrowseTermsToSqs: ${error.length} batches of subjects failed to send to ${destination}}`)
}

module.exports = {
  emitBrowseTerms
}
