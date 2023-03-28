const { expect } = require('chai')
const { client } = require('../../lib/platform-api/client')

describe('platform api client', () => {
  let apiClient
  it('creates a client if there is not one', async () => {
    apiClient = await client()
    expect(client).to.be.an('object')
  })
  it('returns existing client', async () => {
    before(() => {
      apiClient = client()
    })
    const secondClient = await client()
    expect(secondClient).to.equal(apiClient)
  })
})
