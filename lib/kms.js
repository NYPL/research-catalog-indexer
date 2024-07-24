const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms')
const logger = require('./logger')

let awsCredentials

/**
*  Save AWS credentials value
*/
const setCredentials = (credentials) => {
  awsCredentials = credentials
}

const decrypt = async (encrypted) => {
  let client
  let response
  const config = {
    region: process.env.AWS_REGION || 'us-east-1'
  }
  // Use credentials if given (local invocations). Otherwise rely on
  // environment (deployed code):
  if (awsCredentials) {
    config.credentials = awsCredentials
  }
  try {
    client = new KMSClient(config)
  } catch (e) {
    logger.error('Error instantiating KMS client: ', e.message)
  }
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(encrypted, 'base64')
  })
  try {
    response = await client.send(command)
  } catch (e) {
    logger.error('Error sending decrypt command:', e.message)
  }
  if (!response?.Plaintext) {
    logger.error(`Error decrypting ${encrypted}`)
  }
  const decoded = Buffer.from(response.Plaintext, 'binary')
    .toString('utf8')
  return decoded
}

module.exports = { decrypt, setCredentials }
