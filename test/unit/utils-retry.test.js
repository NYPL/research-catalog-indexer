const expect = require('chai').expect
const sinon = require('sinon')

const retryUtils = require('../../lib/utils/retry.js')
const { retry } = retryUtils

describe('utils/retry', () => {
  before(() => {
    sinon.stub(retryUtils, 'delay').callsFake(() => Promise.resolve())
  })

  after(() => {
    retryUtils.delay.restore()
  })

  it('retries a failing function N times', async () => {
    const call = () => Promise.reject(new Error('Error!'))

    await expect(call().catch(retry(call, 1))).to.be.rejectedWith('Exhausted 1 retries: Error!')
    await expect(call().catch(retry(call, 3))).to.be.rejectedWith('Exhausted 3 retries: Error!')
  })

  it('resolves a temporarily failing function', async () => {
    // Set up an async function that succeeds after 3rd error:
    let errorCount = 0
    const call = () => {
      // Succeed after 3 successive errors:
      if (errorCount === 3) return Promise.resolve('toast')

      errorCount += 1
      return Promise.reject(new Error('Error!'))
    }

    // First, confirm fails if only allowed to retry twice:
    await expect(call().catch(retry(call, 2))).to.be.rejectedWith('Exhausted 2 retries: Error!')

    // Next, confirm it succeeds if allowed to retry thrice:
    errorCount = 0
    await expect(call().catch(retry(call, 3))).to.eventually.equal('toast')
  })
})
