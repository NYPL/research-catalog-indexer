const expect = require('chai').expect

const { toJson, internal: { _getAllMethods, _publicMethods } } = require('../../lib/to-json')

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
  let mod

  beforeEach(() => {
    mod = new Model({ id: 2 })
  })

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
    it('returns the values of the public methods of object, whether async or not', () => {
      const JSONifiedMod = toJson(mod)
      expect(JSONifiedMod).to.deep.equal({
        publicMethod: 'I am supposed to be here'
      })
    })

    it('builds an object whose keys are sorted alphabetically', () => {
      const mod = new (class {
        method3 () { return 'method 3' }
        method1 () { return 'method 1' }
      })()

      const obj = toJson(mod)
      expect(obj).to.deep.equal({
        method1: 'method 1',
        method3: 'method 3'
      })
    })
  })
})
