const expect = require('chai').expect

const utils = require('../../lib/utils')

describe('utils', () => {
  describe('leftPad', function () {
    it('left pads to specified length', function () {
      expect(utils.leftPad('', 8)).to.equal('00000000')
      expect(utils.leftPad('', 2)).to.equal('00')
      expect(utils.leftPad('what', 8)).to.equal('0000what')
    })

    it('left pads with specified char', function () {
      expect(utils.leftPad('', 8, ' ')).to.equal('        ')
      expect(utils.leftPad('what', 8, ' ')).to.equal('    what')
      expect(utils.leftPad('what', 8, '*')).to.equal('****what')
    })

    it('stringifies non-string inputs', function () {
      expect(utils.leftPad(undefined, 3, ' ')).to.equal('   ')
      expect(utils.leftPad(null, 3, ' ')).to.equal('   ')
      expect(utils.leftPad(10, 3, ' ')).to.equal(' 10')
      expect(utils.leftPad(true, 5, ' ')).to.equal(' true')
    })
  })

  describe('unique', () => {
    it('unique-ifies a simple array', () => {
      expect(utils.unique(['1', '2', '1'])).to.deep.equal(['1', '2'])
      expect(utils.unique(['1', '2', '1', '2', '3'])).to.deep.equal(['1', '2', '3'])
    })
  })
})
