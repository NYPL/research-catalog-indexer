const NYPLDataApiClient = require('@nypl/nypl-data-api-client')
const kms = require('../kms.js')

let clientPromise = null

/**
 * Initialize a Platform API client from encrypted creds found in process.env
 *
 */
const client = async () => {
  // If there is no active (or resolved) decrypt call..
  if (!clientPromise) {
    // Fire off the set of decrypt calls we need and save a reference to them:
    const kmsCreds = Promise.all([
      kms.decrypt(process.env.NYPL_OAUTH_KEY),
      kms.decrypt(process.env.NYPL_OAUTH_SECRET)
    ])
    const [key, secret] = await kmsCreds

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
  client
}
