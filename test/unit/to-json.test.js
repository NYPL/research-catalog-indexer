const expect = require('chai').expect

const { toJson, internal: { _getAllMethods, _publicMethods } } = require('../../lib/to-json')

class Model {
  constructor (obj) {
    Object.keys(obj).forEach((k) => {
      this[k] = obj[k]
    })
  }

  _privateMethod () { return 'meep morp' }

  async asyncPublicMethod () { return Promise.resolve('I am also supposed to be here') }

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
        'asyncPublicMethod',
        'publicMethod'
      ])
    })
  })

  describe('_publicMethods', () => {
    it('filters private methods', () => {
      expect(_publicMethods(mod)).to.deep.equal([
        'asyncPublicMethod',
        'publicMethod'
      ])
    })
  })

  describe('toJson', () => {
    it('returns the values of the public methods of object, whether async or not', async () => {
      const JSONifiedMod = await toJson(mod)
      expect(JSONifiedMod).to.deep.equal({
        asyncPublicMethod: 'I am also supposed to be here',
        publicMethod: 'I am supposed to be here'
      })
    })

    it('builds an object whose keys are sorted alphabetically even if some of the values are built async', async () => {
      const mod = new (class {
        method3 () { return 'method 3' }

        async method2 () { return Promise.resolve('method 2') }

        method1 () { return 'method 1' }
      })()

      const obj = await toJson(mod)
      expect(obj).to.deep.equal({
        method1: 'method 1',
        method2: 'method 2',
        method3: 'method 3'
      })
    })
  })
})
