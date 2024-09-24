const { private: { _parseDates } } = require('../../lib/utils/item-date-parse')

describe('date parsing', () => {
  describe('_parseDates', () => {
    it.only('can parse a date with no spaces around the hyphen with a volume', async () => {
      console.log(await _parseDates('v. 2 (Feb. 20, 1926-May 22, 1926)'))
    })
  })
})
