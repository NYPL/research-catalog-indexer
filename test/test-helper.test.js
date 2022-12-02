const sinon = require('sinon')

const kms = require('../lib/kms')

before(() => {
  sinon.stub(kms, 'decrypt').callsFake((val) => {
    // If updating fixtures, pass the origianl value through because local
    // config is decrypted
    return Promise.resolve(process.UPDATE_FIXTURES ? val : 'decrypted!')
  })
})

after(() => {
  kms.decrypt.restore()
})
