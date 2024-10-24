const expect = require('chai').expect
const nock = require('nock')

const { stubNyplSourceMapper, unstubNyplSourceMapper } = require('./utils')

const NyplSourceMapper = require('../../lib/utils/nypl-source-mapper')

const SOURCE_MAPPING_URL = 'https://raw.githubusercontent.com/NYPL/nypl-core/master/mappings/recap-discovery/nypl-source-mapping.json'

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

describe('utils/NyplSourceMapper', async function () {
  before(() => NyplSourceMapper.__resetInstance())

  describe('instance', async function () {
    beforeEach(stubNyplSourceMapper)
    afterEach(() => {
      unstubNyplSourceMapper()
      NyplSourceMapper.__resetInstance()
    })

    it('should fetch data from nypl core', async function () {
      const mapping = await NyplSourceMapper.instance()
      expect(mapping.nyplSourceMap).to.nested.include({ 'sierra-nypl.organization': 'nyplOrg:0001' })
    })

    it('should return pre-fetched data if initialized', async function () {
      const mapping = await NyplSourceMapper.instance()
      expect(mapping.nyplSourceMap).to.deep.equal(response)

      // Trigger another instance creation, which will break if another `fetch`
      // call is made, since the nock only specifies .times(1)
      await NyplSourceMapper.instance()
      expect(mapping.nyplSourceMap).to.deep.equal(response)
    })

    it('should reuse existing fetch if one is already active', async function () {
      // Trigger multiple instance creations simultaneously to assert the mock
      // is only used once:
      const [mapping1, mapping2] = await Promise.all([
        NyplSourceMapper.instance(),
        NyplSourceMapper.instance()
      ])
      expect(mapping1.nyplSourceMap).to.deep.equal(response)
      expect(mapping2.nyplSourceMap).to.deep.equal(response)
    })
  })

  describe('splitIdentifier', async () => {
    let sourceMapperInstance

    beforeEach(async () => {
      stubNyplSourceMapper()
      sourceMapperInstance = await NyplSourceMapper.instance()
    })
    afterEach(() => {
      unstubNyplSourceMapper()
      NyplSourceMapper.__resetInstance()
    })

    it('should reject unrecognized identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('fladeedle')
      expect(split).to.be.a('object')
      expect(split.type).to.be.a('undefined')
      expect(split.nyplSource).to.be.a('undefined')
      expect(split.id).to.be.a('undefined')
    })

    it('should split sierra-nypl bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('b12082323')
      expect(split).to.be.a('object')
      expect(split.type).to.be.eq('bib')
      expect(split.nyplSource).to.be.eq('sierra-nypl')
      expect(split.id).to.be.eq('12082323')
    })

    it('should split sierra-nypl item identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('i123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('sierra-nypl')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-pul bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('pb123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('bib')
      expect(split.nyplSource).to.eq('recap-pul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-pul bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('pi123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('recap-pul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-cul bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('cb123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('bib')
      expect(split.nyplSource).to.eq('recap-cul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-cul bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('ci123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('recap-cul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-hl bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('hb123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('bib')
      expect(split.nyplSource).to.eq('recap-hl')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-hl bib identifier', function () {
      const split = sourceMapperInstance.splitIdentifier('hi123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('recap-hl')
      expect(split.id).to.be.eq('123')
    })
  })

  describe('prefix', async function () {
    let sourceMapperInstance

    before(async () => {
      stubNyplSourceMapper()
      sourceMapperInstance = await NyplSourceMapper.instance()
    })
    after(() => {
      unstubNyplSourceMapper()
      NyplSourceMapper.__resetInstance()
    })

    it('should get correct prefix for sierra-nypl', function () {
      const prefix = sourceMapperInstance.prefix('sierra-nypl')
      expect(prefix).to.equal('b')
    })

    it('should get correct prefix for recap-hl', function () {
      const prefix = sourceMapperInstance.prefix('recap-hl')
      expect(prefix).to.equal('hb')
    })

    it('should get correct prefix for recap-pul', function () {
      const prefix = sourceMapperInstance.prefix('recap-pul')
      expect(prefix).to.equal('pb')
    })

    it('should get correct prefix for recap-cul', function () {
      const prefix = sourceMapperInstance.prefix('recap-cul')
      expect(prefix).to.equal('cb')
    })
  })

  describe('nyplSourceMapping error conditions', async function () {
    beforeEach(() => NyplSourceMapper.__resetInstance())
    afterEach(() => {
      unstubNyplSourceMapper()
      NyplSourceMapper.__resetInstance()
    })

    it('should fail if mapping json returns a non-2xx', async () => {
      nock(SOURCE_MAPPING_URL)
        .defaultReplyHeaders({
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true'
        })
        .get(/.*/)
        .times(1)
        .reply(503, () => '{}')

      const call = NyplSourceMapper.instance()
      return expect(call).to.be.rejectedWith(`Error retrieving ${SOURCE_MAPPING_URL} - got status 503`)
    })

    it('should fail if mapping json returns a 200 but is malformed', async () => {
      nock(SOURCE_MAPPING_URL)
        .defaultReplyHeaders({
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true'
        })
        .get(/.*/)
        .times(1)
        .reply(200, () => '{ "oh": "no" }')

      const call = NyplSourceMapper.instance()
      return expect(call).to.be.rejectedWith(`Error parsing data at ${SOURCE_MAPPING_URL}`)
    })
  })
})
