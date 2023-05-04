const { toJson, internal: { _getAllMethods, _publicMethods } } = require('../../lib/to-json')
const { expect } = require('chai')

class Model {
  constructor (obj) {
    Object.keys(obj).forEach((k) => {
      this[k] = obj[k]
    })
  }

  _privateMethod () { return 'meep morp' }

  publicMethod () { return 'I am supposed to be here' }
}

describe('toJson', () => {
  const mod = new Model({ id: 2 })
  describe('_getAllMethods', () => {
    it('returns methods of class client', () => {
      expect(_getAllMethods(mod)).to.deep.equal([
        '_privateMethod',
        'publicMethod'
      ])
    })
  })

  describe('_publicMethods', () => {
    it('filters private methods', () => {
      expect(_publicMethods(mod)).to.deep.equal([
        'publicMethod'
      ])
    })
  })

  describe('toJson', () => {
    it('returns the values of the public methods of object', async () => {
      const JSONifiedMod = await toJson(mod)
      expect(JSONifiedMod).to.deep.equal({ publicMethod: 'I am supposed to be here' })
    })
  })
})
