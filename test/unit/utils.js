const sinon = require('sinon')
const nock = require('nock')

const platformApi = require('../../lib/platform-api/client')

const genericGetStub = sinon.stub().resolves({ data: {} })
const nullGetStub = sinon.stub().resolves({})
const errorGetStub = sinon.stub().throws()
// This is a convenience function for stubbing the platformApi.
const stubPlatformApiGetRequest = (get) => sinon.stub(platformApi, 'client').resolves({ get })

const stubNyplSourceMapper = () => {
  const response = {
    'sierra-nypl': {
      organization: 'nyplOrg:0001',
      bibPrefix: 'b',
      holdingPrefix: 'h',
      itemPrefix: 'i'
    },
    'recap-pul': { organization: 'nyplOrg:0003', bibPrefix: 'pb', itemPrefix: 'pi' },
    'recap-cul': { organization: 'nyplOrg:0002', bibPrefix: 'cb', itemPrefix: 'ci' },
    'recap-hl': { organization: 'nyplOrg:0004', bibPrefix: 'hb', itemPrefix: 'hi' }
  }

  nock('https://raw.githubusercontent.com')
    .defaultReplyHeaders({
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true'
    })
    .get('/NYPL/nypl-core/master/mappings/recap-discovery/nypl-source-mapping.json')
    .reply(200, () => {
      return response
    })
}

module.exports = {
  genericGetStub,
  nullGetStub,
  errorGetStub,
  stubPlatformApiGetRequest,
  stubNyplSourceMapper
}
