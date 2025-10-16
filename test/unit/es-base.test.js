const { expect } = require('chai')

const EsBase = require('../../lib/es-models/base')
const EsBib = require('../../lib/es-models/bib')
const SierraBib = require('../../lib/sierra-models/bib')

describe('EsBase', function () {
  describe('_valueToIndexFromBasicMapping', () => {
    it('should return an array of primary values', () => {
      const field = 'title'
      const primary = true
      const bib = new EsBib(new SierraBib(require('../fixtures/bib-11606020.json')))
      expect(bib._valueToIndexFromBasicMapping(field, primary)).to.deep.equal(['Sefer Toldot Yeshu = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
      ])
    })
    it('should return array of parallel titles', function () {
      const record = new SierraBib(require('../fixtures/bib-11606020.json'))
      const esBib = new EsBib(record)
      const primary = false
      const field = 'title'
      expect(esBib._valueToIndexFromBasicMapping(field, primary)).to.deep.equal(
        [
          'ספר תולדות ישו = The gospel according to the Jews, called Toldoth Jesu : the generations of Jesus, now first translated from the Hebrew.'
        ]
      )
    })
  })

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

      class Foo2 extends EsBase {
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
      const doc = await (new Foo2()).toJson()
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
