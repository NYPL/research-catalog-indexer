const expect = require('chai').expect

const { translateDeprecatedLanguageCode } = require('../../lib/utils/languages')

describe('utils/languages', () => {
  describe('translateDeprecatedLanguageCode', () => {
    it('returns preferred code for deprecated code', () => {
      expect(translateDeprecatedLanguageCode('far')).to.equal('fao')
      expect(translateDeprecatedLanguageCode('esk')).to.equal('ypk')
    })

    it('returns given code if not deprecated', () => {
      expect(translateDeprecatedLanguageCode('mal')).to.equal('mal')
    })
  })
})
