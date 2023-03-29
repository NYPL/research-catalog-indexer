const expect = require('chai').expect
const nock = require('nock')
const NyplSourceMapper = require('../../lib/utils/nypl-source-mapper')

describe('NyplSourceMapper', async function () {
  describe('nyplSourceMapping', async function () {
    const sourceMapper = new NyplSourceMapper()
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
    let callCount = 0

    before(() => {
      nock('https://raw.githubusercontent.com/NYPL/nypl-core/master/mappings/recap-discovery/nypl-source-mapping.json')
        .defaultReplyHeaders({
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true'
        })
        .get(/.*/)
        .reply(200, () => {
          callCount += 1
          return response
        })
    })

    it('should fetch data from nypl core if not initialized', async function () {
      const mapping = await sourceMapper.nyplSourceMapping()
      expect(mapping).to.deep.equal(response)
      expect(callCount).to.equal(1)
    })

    it('should return pre-fetched data if initialized', async function () {
      const mapping = await sourceMapper.nyplSourceMapping()
      expect(mapping).to.deep.equal(response)
      expect(callCount).to.equal(1)
    })
  })

  describe('splitIdentifier', async function () {
    const sourceMapper = new NyplSourceMapper()
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

    before(() => {
      nock('https://raw.githubusercontent.com/NYPL/nypl-core/master/mappings/recap-discovery/nypl-source-mapping.json')
        .defaultReplyHeaders({
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true'
        })
        .get(/.*/)
        .reply(200, () => {
          return response
        })
    })

    it('should reject unrecognized identifier', async function () {
      const split = await sourceMapper.splitIdentifier('fladeedle')
      expect(split).to.be.a('object')
      expect(split.type).to.be.a('undefined')
      expect(split.nyplSource).to.be.a('undefined')
      expect(split.id).to.be.a('undefined')
    })

    it('should split sierra-nypl bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('b12082323')
      expect(split).to.be.a('object')
      expect(split.type).to.be.eq('bib')
      expect(split.nyplSource).to.be.eq('sierra-nypl')
      expect(split.id).to.be.eq('12082323')
    })

    it('should split sierra-nypl item identifier', async function () {
      const split = await sourceMapper.splitIdentifier('i123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('sierra-nypl')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-pul bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('pb123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('bib')
      expect(split.nyplSource).to.eq('recap-pul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-pul bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('pi123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('recap-pul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-cul bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('cb123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('bib')
      expect(split.nyplSource).to.eq('recap-cul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-cul bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('ci123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('recap-cul')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-hl bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('hb123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('bib')
      expect(split.nyplSource).to.eq('recap-hl')
      expect(split.id).to.be.eq('123')
    })

    it('should split recap-hl bib identifier', async function () {
      const split = await sourceMapper.splitIdentifier('hi123')
      expect(split).to.be.a('object')
      expect(split.type).to.eq('item')
      expect(split.nyplSource).to.eq('recap-hl')
      expect(split.id).to.be.eq('123')
    })
  })

  describe('prefix', async function () {
    const sourceMapper = new NyplSourceMapper()
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

    before(() => {
      nock('https://raw.githubusercontent.com/NYPL/nypl-core/master/mappings/recap-discovery/nypl-source-mapping.json')
        .defaultReplyHeaders({
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true'
        })
        .get(/.*/)
        .reply(200, () => {
          return response
        })
    })

    it('should get correct prefix for sierra-nypl', async function () {
      const prefix = await sourceMapper.prefix('sierra-nypl')
      expect(prefix).to.equal('b')
    })

    it('should get correct prefix for recap-hl', async function () {
      const prefix = await sourceMapper.prefix('recap-hl')
      expect(prefix).to.equal('hb')
    })

    it('should get correct prefix for recap-pul', async function () {
      const prefix = await sourceMapper.prefix('recap-pul')
      expect(prefix).to.equal('pb')
    })

    it('should get correct prefix for recap-cul', async function () {
      const prefix = await sourceMapper.prefix('recap-cul')
      expect(prefix).to.equal('cb')
    })
  })
})
