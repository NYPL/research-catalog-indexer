const { expect } = require('chai')
const { instance } = require('../lib/platform-api/client')

describe('platform api client', () => {
  let client
  it('creates a client if there is not one', async () => {
    client = await instance()
    expect(client).to.be.an('object')
  })
  it('returns existing client', async () => {
    before(() => {
      client = instance()
    })
    const secondClient = await instance()
    expect(secondClient).to.equal(client)
  })
})
