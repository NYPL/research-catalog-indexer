const sinon = require('sinon')
const nock = require('nock')

const platformApi = require('../../lib/platform-api/client')

const genericGetStub = sinon.stub().resolves({ data: {} })
const nullGetStub = sinon.stub().resolves({})
const errorGetStub = sinon.stub().throws()
// This is a convenience function for stubbing the platformApi.
const stubPlatformApiGetRequest = (get) => sinon.stub(platformApi, 'client').resolves({ get })

let _nyplSourceMapperInterceptor

/**
* Add mock for github hosted nypl-source-mapper file
*/
const stubNyplSourceMapper = (howManyTimes = 1) => {
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

  _nyplSourceMapperInterceptor = nock('https://raw.githubusercontent.com')
    .defaultReplyHeaders({
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true'
    })
    .get(/.*/)
    .times(howManyTimes)
    .reply(200, () => {
      return response
    })
}

/**
* Remove mock from nypl-source-mapper file
*/
const unstubNyplSourceMapper = () => {
  nock.removeInterceptor(_nyplSourceMapperInterceptor)
}

module.exports = {
  genericGetStub,
  nullGetStub,
  errorGetStub,
  stubPlatformApiGetRequest,
  stubNyplSourceMapper,
  unstubNyplSourceMapper
}
