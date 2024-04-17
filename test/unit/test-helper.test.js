const chai = require('chai')
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))

const sinon = require('sinon')
const dotenv = require('dotenv')

const kms = require('../../lib/kms')

dotenv.config({ path: './config/test.env' })

before(() => {
  sinon.stub(kms, 'decrypt').callsFake((val) => {
    // Just return original value (local env values are fake/unencrypted)
    return Promise.resolve(val)
  })
})

after(() => {
  kms.decrypt.restore()
})
