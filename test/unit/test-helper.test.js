const chai = require('chai')
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))

const sinon = require('sinon')
const dotenv = require('dotenv')

const kms = require('../../lib/kms')

dotenv.config({ path: './config/test.env' })

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
