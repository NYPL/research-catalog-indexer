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

  describe('toPlainObject', () => {
    it('should return a plainobject representation of a descendent instance', () => {
      class Foo extends EsBase {
        bar () {
          return 'bar value'
        }
      }
      const doc = new Foo().toPlainObject({
        bar: 'index mapping'
      })
      expect(doc).to.deep.equal({
        bar: 'bar value'
      })
    })

    it('should return a plainobject representation of descendent children', () => {
      class FakeItem extends EsBase {
        constructor (id) {
          super()
          this.id = id
        }

        holdingLocation () {
          return `loc:${this.id}`
        }
      }

      class FakeBib extends EsBase {
        title () {
          return 'book'
        }

        numItems () {
          return this.items().length
        }

        items () {
          return [
            new FakeItem(1),
            new FakeItem(2)
          ]
        }
      }
      const doc = new FakeBib().toPlainObject({ title: 'mapping', numItems: 'mapping', items: { properties: { holdingLocation: 'mapping', uri: '123' } } })
      expect(doc).to.deep.equal({
        title: 'book',
        numItems: 2,
        items: [
          {
            holdingLocation: 'loc:1'
          },
          {
            holdingLocation: 'loc:2'
          }
        ]
      })
    })
  })
})
