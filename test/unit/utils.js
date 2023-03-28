const sinon = require('sinon')

const platformApi = require('../../lib/platform-api/client')

const genericGetStub = sinon.stub().resolves({ data: {} })
const nullGetStub = sinon.stub().resolves({})
const errorGetStub = sinon.stub().throws()
// This is a convenience function for stubbing the platformApi.
const stubPlatformApiclient = (get) => sinon.stub(platformApi, 'client').resolves({ get })

module.exports = {
  genericGetStub,
  nullGetStub,
  errorGetStub,
  stubPlatformApiclient
}
