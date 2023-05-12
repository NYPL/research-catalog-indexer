const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms')
const logger = require('./logger')

const decrypt = async (encrypted) => {
  try {
    const client = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    })
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encrypted, 'base64')
    })
    const response = await client.send(command)
    const decoded = Buffer.from(response.Plaintext, 'binary')
      .toString('utf8')
    return decoded
  } catch (e) {
    logger.error('Error instantiating KMS client: ', e)
  }
}

module.exports = { decrypt }
