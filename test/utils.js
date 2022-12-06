const sinon = require('sinon')

const platformApi = require('../lib/platform-api/client')
const genericGetStub = sinon.stub().resolves({ data: {} })
const nullGetStub = sinon.stub().resolves({})
const stubPlatformApiInstance = (get) => sinon.stub(platformApi, 'instance').resolves({ get })

module.exports = {
  genericGetStub,
  nullGetStub,
  stubPlatformApiInstance
}
