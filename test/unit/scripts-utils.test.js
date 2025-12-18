const expect = require('chai').expect
const sinon = require('sinon')

const logger = require('../../lib/logger')
const utils = require('../../scripts/utils')

describe('scripts/utils', () => {
  describe('batch', () => {
    it('batches things by batchSize', () => {
      const inp = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      expect(utils.batch(inp, 3)).to.deep.eq([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ])
      expect(utils.batch(inp, 2)).to.deep.eq([
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        [9]
      ])
      // Default batchSize is 100:
      expect(utils.batch(inp)).to.deep.eq([inp])
    })
  })

  describe('groupIdentifiersByTypeAndNyplSource', () => {
    const input = [
      'b123',
      'b456',
      'b789',
      'pb987',
      'i12345',
      'i456',
      'i789',
      'pi1234'
    ]

    it('batches identifiers by type and source', async () => {
      const output = await utils.groupIdentifiersByTypeAndNyplSource(input)

      expect(output).to.deep.equal([
        [
          { type: 'bib', nyplSource: 'sierra-nypl', id: '123' },
          { type: 'bib', nyplSource: 'sierra-nypl', id: '456' },
          { type: 'bib', nyplSource: 'sierra-nypl', id: '789' }
        ],
        [{ type: 'bib', nyplSource: 'recap-pul', id: '987' }],
        [
          { type: 'item', nyplSource: 'sierra-nypl', id: '12345' },
          { type: 'item', nyplSource: 'sierra-nypl', id: '456' },
          { type: 'item', nyplSource: 'sierra-nypl', id: '789' }
        ],
        [{ type: 'item', nyplSource: 'recap-pul', id: '1234' }]
      ])
    })
  })

  describe('batchIdentifiersByTypeAndNyplSource', () => {
    const input = [
      'b123',
      'b456',
      'b789',
      'pb987',
      'i12345',
      'i456',
      'i789',
      'pi1234'
    ]

    it('batches identifiers by type and source', async () => {
      const output = await utils.batchIdentifiersByTypeAndNyplSource(input)

      expect(output).to.deep.equal([
        [
          { type: 'bib', nyplSource: 'sierra-nypl', id: '123' },
          { type: 'bib', nyplSource: 'sierra-nypl', id: '456' },
          { type: 'bib', nyplSource: 'sierra-nypl', id: '789' }
        ],
        [{ type: 'bib', nyplSource: 'recap-pul', id: '987' }],
        [
          { type: 'item', nyplSource: 'sierra-nypl', id: '12345' },
          { type: 'item', nyplSource: 'sierra-nypl', id: '456' },
          { type: 'item', nyplSource: 'sierra-nypl', id: '789' }
        ],
        [{ type: 'item', nyplSource: 'recap-pul', id: '1234' }]
      ])
    })

    it('respects batchSize', async () => {
      const output = await utils.batchIdentifiersByTypeAndNyplSource(input, 2)

      expect(output).to.deep.equal([
        [
          { type: 'bib', nyplSource: 'sierra-nypl', id: '123' },
          { type: 'bib', nyplSource: 'sierra-nypl', id: '456' }
        ],
        [{ type: 'bib', nyplSource: 'sierra-nypl', id: '789' }],
        [{ type: 'bib', nyplSource: 'recap-pul', id: '987' }],
        [
          { type: 'item', nyplSource: 'sierra-nypl', id: '12345' },
          { type: 'item', nyplSource: 'sierra-nypl', id: '456' }
        ],
        [{ type: 'item', nyplSource: 'sierra-nypl', id: '789' }],
        [{ type: 'item', nyplSource: 'recap-pul', id: '1234' }]
      ])
    })
  })

  describe('secondsAsFriendlyDuration', () => {
    it('returns object with correct counts and `display` property', () => {
      expect(utils.secondsAsFriendlyDuration(71)).to.deep.equal({
        days: 0,
        hours: 0,
        minutes: 1,
        seconds: 11,
        display: '1m 11s'
      })
      expect(utils.secondsAsFriendlyDuration(60 * 60 * 3 + 60 * 2 + 14)).to.deep.equal({
        seconds: 14,
        minutes: 2,
        hours: 3,
        days: 0,
        display: '3h 2m 14s'
      })
    })

    it('reduces precision for `simplified` mode', () => {
      // 2 days + 71s:
      expect(utils.secondsAsFriendlyDuration(2 * 24 * 3600 + 71, { simplified: true })).to.deep.equal({
        days: 2,
        hours: 0,
        minutes: null,
        seconds: null,
        display: '2d'
      })
      // 3h, + 74s:
      expect(utils.secondsAsFriendlyDuration(3 * 3600 + 60 * 2 + 14, { simplified: true })).to.deep.equal({
        seconds: null,
        minutes: 2,
        hours: 3,
        days: 0,
        display: '3h 2m'
      })
    })
  })

  describe('retry', () => {
    before(() => {
      sinon.stub(utils, 'delay').callsFake(() => Promise.resolve())
    })

    after(() => utils.delay.restore())

    it('retries a failing function N times', async () => {
      const call = () => Promise.reject(new Error('Error!'))

      await expect(call().catch(utils.retry(call, 1))).to.be.rejectedWith('Exhausted 1 retries')
      await expect(call().catch(utils.retry(call, 3))).to.be.rejectedWith('Exhausted 3 retries')
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
      await expect(call().catch(utils.retry(call, 2))).to.be.rejectedWith('Exhausted 2 retries')

      // Next, confirm it succeeds if allowed to retry thrice:
      errorCount = 0
      await expect(call().catch(utils.retry(call, 3))).to.eventually.equal('toast')
    })
  })

  describe('printProgress', () => {
    it('prints progress', () => {
      const loggerSpy = sinon.spy(logger, 'info')

      const lastLogLine = () => {
        return loggerSpy.getCalls()
          .pop()
          .args.shift()
      }

      const start = new Date() - 1000
      utils.printProgress(50, 10000, 50, start)
      expect(lastLogLine()).to.match(/^Processed 1 - 50 of 10000: 0.50%/)

      utils.printProgress(100, 10000, 50, start)
      expect(lastLogLine()).to.match(/^Processed 51 - 100 of 10000: 1.00%/)

      utils.printProgress(10000, 10000, 50, start)
      expect(lastLogLine()).to.match(/^Processed 9951 - 10000 of 10000: 100.00%/)
    })
  })

  describe('castArgsToInts', () => {
    it('casts args to ints', () => {
      // Mock `parseArgs` result:
      const inp = { values: { num1: '123', num2: '456' } }

      utils.castArgsToInts(inp, ['num1', 'num2'])

      expect(inp.values.num1).to.eq(123)
      expect(inp.values.num2).to.eq(456)
    })

    it('rejects invalid ints', () => {
      // Mock `parseArgs` result:
      const inp = { values: { str1: 'foo' } }

      const call = () => utils.castArgsToInts(inp, ['str1'])
      expect(call).to.throw('Invalid int arg: str1=foo')
    })
  })

  describe('groupIdentifierEntitiesByTypeAndNyplSource', () => {
    it('groups identifier entities', () => {
      const input = [
        { id: 1, nyplSource: 'a', type: 'bib' },
        { id: 2, nyplSource: 'a', type: 'bib' },
        { id: 3, nyplSource: 'b', type: 'bib' },
        { id: 4, nyplSource: 'c', type: 'bib' },
        { id: 1, nyplSource: 'c', type: 'bib' },
        { id: 1, nyplSource: 'c', type: 'item' }
      ]

      expect(utils.groupIdentifierEntitiesByTypeAndNyplSource(input)).to.deep.equal([
        [
          { id: 1, nyplSource: 'a', type: 'bib' },
          { id: 2, nyplSource: 'a', type: 'bib' }
        ],
        [
          { id: 3, nyplSource: 'b', type: 'bib' }
        ],
        [
          { id: 4, nyplSource: 'c', type: 'bib' },
          { id: 1, nyplSource: 'c', type: 'bib' }
        ],
        [
          { id: 1, nyplSource: 'c', type: 'item' }
        ]
      ])
    })

    it('groups entities with null nyplSource', () => {
      const input = [{ id: '1234', nyplSource: null }, { id: '5678', nyplSource: null }]

      expect(utils.groupIdentifierEntitiesByTypeAndNyplSource(input)).to.deep.equal([
        [
          { id: '1234', nyplSource: null },
          { id: '5678', nyplSource: null }
        ]
      ])
    })
  })
})
