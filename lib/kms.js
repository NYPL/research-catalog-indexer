const KMS = require('aws-sdk/clients/kms')

function decrypt (encrypted) {
  return new Promise((resolve, reject) => {
    const kms = new KMS({
      region: process.env.AWS_REGION || 'us-east-1'
    })
    kms.decrypt({ CiphertextBlob: Buffer.from(encrypted, 'base64') }, (err, data) => {
      if (err) return reject(err)

      const decrypted = data.Plaintext.toString('ascii')
      resolve(decrypted)
    })
  })
}

const decryptElasticCreds = async () => {
  if (!process.env.ELASTICSEARCH_CONNECTION_URI) throw new Error('Missing ELASTICSEARCH_CONNECTION_URI env variable; aborting.')

  const encrypted = process.env.ELASTICSEARCH_CONNECTION_URI
  return await decrypt(encrypted)
}

module.exports = { decryptElasticCreds }
