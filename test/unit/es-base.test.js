const { expect } = require('chai')

const EsBase = require('../../lib/es-models/base')

describe('EsBase', function () {
  describe('toJson', () => {
    it('should return a plainobject representation of a descendent instance', async () => {
      class Foo extends EsBase {
        bar () {
          return 'bar value'
        }
      }
      const doc = await (new Foo()).toJson()
      expect(doc).to.deep.equal({
        bar: 'bar value'
      })
    })

    it('should return a plainobject representation of descendent children', async () => {
      class FooChild extends EsBase {
        constructor (id) {
          super()
          this.id = id
        }

        fooChildMethod () {
          return `fooChildMethod ${this.id} value`
        }
      }

      class Foo extends EsBase {
        fooMethod () {
          return 'fooMethod value'
        }

        singleChild () {
          return new FooChild(0)
        }

        children () {
          return [
            new FooChild(1),
            new FooChild(2)
          ]
        }
      }
      const doc = await (new Foo()).toJson()
      expect(doc).to.deep.equal({
        fooMethod: 'fooMethod value',
        singleChild: {
          fooChildMethod: 'fooChildMethod 0 value'
        },
        children: [
          {
            fooChildMethod: 'fooChildMethod 1 value'
          },
          {
            fooChildMethod: 'fooChildMethod 2 value'
          }
        ]
      })
    })
  })
})
