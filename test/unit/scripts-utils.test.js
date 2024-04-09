const expect = require('chai').expect

const utils = require('../../scripts/utils')

describe('scripts/utils', () => {
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
  })
})
