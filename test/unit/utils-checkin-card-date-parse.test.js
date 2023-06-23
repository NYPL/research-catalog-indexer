const expect = require('chai').expect

const { parseCheckinCardDate } = require('../../lib/utils/checkin-card-date-parse')

describe('checkin-card-date-parse', () => {
  ; [
    { input: 'Mar. 2012', output: '2012-03-01' },
    { input: 'Jan. 2012', output: '2012-01-01' },
    { input: 'Jul. 10, 1999', output: '1999-07-10' },
    { input: '2023', output: '2023-01-01' },
    { input: 'Spr. 1999', output: '1999-04-01' },
    // Note the assumption that Winter begins on Jan 1, when some might say
    // "Winter '99" means "December 21, 1999". It's not perfectly clear which
    // interpretation is more often correct in our data
    { input: 'Winter 1999', output: '1999-01-01' }
  ].forEach(({ input, output }) => {
    it('parses parsable date string: ' + input, () => {
      expect(parseCheckinCardDate(input)).to.eq(output)
    })
  })

  it('returns null for non-parsable date strings', () => {
    expect(parseCheckinCardDate('tomorrow')).to.eq(null)
    expect(parseCheckinCardDate('Jan/Feb')).to.eq(null)
    expect(parseCheckinCardDate('2')).to.eq(null)
    expect(parseCheckinCardDate(2)).to.eq(null)
    expect(parseCheckinCardDate(null)).to.eq(null)
    expect(parseCheckinCardDate(undefined)).to.eq(null)
  })
})
