const expect = require('chai').expect

const { lookup } = require('../../lib/utils/lookup')

describe('lookup', () => {
  it('builds a lookup', () => {
    expect(lookup('lookup-language-code-to-label')).to.deep.include({
      aar: 'Afar',
      ach: 'Acoli',
      // ...
      zza: 'Zaza'
    })
  })
})
