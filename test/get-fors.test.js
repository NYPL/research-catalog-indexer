const { getSchema } = require('../lib/clients/platform-api/get-fors')
const platformApi = require('../lib/platform-api/client')
const sinon = require('sinon')
const { expect } = require('chai')

describe('platform api methods', () => {
  let platformInstance
  let getStub
  describe('getSchema', () => {
    before((=> {

    }))
    after(() => {

    })
    it('makes a get request', () => {
      getSchema('bib')
      expect(platformInstance)
    })
  })

  describe('bibById', () => {
    it('makes a get request', () => {

    })
    it('returns null when there is no bib for that id', () => {

    })
    it('returns a bib')
  })

  describe('bibsForItems', () => {
    it('calls makes ES query via bibIdentifiersForHoldings', () => {
    })
  })

  describe('bibIdentifiersForHoldings', () => {
    it('returns array of {source,id} objects', () => {

    })
  })
})
