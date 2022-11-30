const NYPLDataApiClient = require('@nypl/nypl-data-api-client')

const kms = require('../kms.js')

let clientPromise = null

/**
 * Initialize a Platform API client from encrypted creds found in process.env
 *
 */
const init = async () => {
  // Create a Promise to decrypt creds and resolve a client:
  if (!clientPromise) {
    const [key, secret] = await Promise.all([
      kms.decrypt(process.env.NYPL_OAUTH_KEY),
      kms.decrypt(process.env.NYPL_OAUTH_SECRET)
    ])

    clientPromise = new NYPLDataApiClient({
      base_url: process.env.NYPL_API_BASE_URL,
      oauth_key: key,
      oauth_secret: secret,
      oauth_url: process.env.NYPL_OAUTH_URL,
      log_level: 'error'
    })
  }

  return clientPromise
}

module.exports = {
  init
}
