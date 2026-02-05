const expect = require('chai').expect
const { combineLigaturePairs } = require('../../lib/utils/combine-ligature-pairs')

describe('combineLigaturePairs', () => {
  it('should replace a single FE20 + FE21 pair with U+0361', () => {
    const input = 'Dvenadt︠s︡at'
    const expected = 'Dvenadt͡sat'
    expect(combineLigaturePairs(input)).to.equal(expected)
  })
  it('should replace multiple FE20 + FE21 pairs in a string', () => {
    const input = 'a\uFE20b\uFE21 c\uFE20d\uFE21'
    const expected = 'a\u0361b c\u0361d'
    expect(combineLigaturePairs(input)).to.equal(expected)
  })

  it('should return the string unchanged if no FE20 + FE21 pairs', () => {
    const input = 'hello world'
    const expected = 'hello world'
    expect(combineLigaturePairs(input)).to.equal(expected)
  })

  it('should return empty string when input is empty', () => {
    expect(combineLigaturePairs('')).to.equal('')
  })

  it('should return null when input is null', () => {
    expect(combineLigaturePairs(null)).to.equal(null)
  })

  it('should not replace incomplete sequences', () => {
    const input1 = 'a\uFE20b' // missing FE21
    const input2 = '/b\uFE21' // missing FE20
    expect(combineLigaturePairs(input1)).to.equal(input1)
    expect(combineLigaturePairs(input2)).to.equal(input2)
  })

  it('should handle strings with other characters correctly', () => {
    const input = 'x\uFE20y\uFE21z'
    const expected = 'x\u0361yz'
    expect(combineLigaturePairs(input)).to.equal(expected)
  })
})
