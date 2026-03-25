const expect = require('chai').expect

const parse = require('../../lib/utils/parse-enumeration-chronology')

describe('utils/parse-enumeration-chronology', () => {
  describe('parseNamedEnumerationTag', () => {
    it('parses years', () => {
      ; [
        [' 2026', ' 2026'],
        [' 1599', null],
        [' 2100', null],
        ['r. 2025', null],
        ['Mar. 2023', ' 2023']
      ].forEach(([input, output]) => {
        const parsed = parse.parseNamedEnumerationTags('year', input)
        const val = parsed ? parsed[0].start : null
        expect(val).to.equal(output)
      })

      expect(parse.parseNamedEnumerationTags('year', 'fladeedle 1963')).to.deep.equal([
        { start: ' 1963', type: 'year', raw: '1963' }
      ])
    })

    it('parses numbers', () => {
      ; [
        [' Nov 6', null],
        [' no. 7', '    7'],
        ['no. v', '    5'],
        ['Fladeedle nos. XII-XIII', '   12', '   13']
      ].forEach(([input, start, end = null]) => {
        const parsed = parse.parseNamedEnumerationTags('number', input)
        const val = parsed ? parsed[0].start : null
        expect(val).to.equal(start)
        if (end) {
          const val = parsed ? parsed[0].end : null
          expect(val).to.equal(end)
        }
      })
    })

    it('parses volume', () => {
      expect(parse.parseNamedEnumerationTags('volume', 'v. 1')).to.deep.equal([
        { start: '    1', type: 'volume', raw: 'v. 1' }
      ])
    })
  })

  describe('parseEnumerationTags', () => {
    it('parseEnumerationTags', () => {
      expect(parse.parseEnumerationTags('Sc Micro F-1 pt. 1 no. 220 (Algeria-- Politics & govt., 1963)'))
        .to.deep.equal([
          { raw: 'no. 220', start: '  220', type: 'number' },
          { raw: 'pt. 1', start: '    1', type: 'part' },
          { raw: '1963', start: ' 1963', type: 'year' }
        ])

      expect(parse.parseEnumerationTags('*ZY (Atlanta constitution) r. 1856: Nov. 1-4, 2001'))
        .to.deep.equal([
          { raw: 'r. 1856', start: ' 1856', type: 'reel' },
          { raw: '2001', start: ' 2001', type: 'year' }
        ])

      expect(parse.parseNamedEnumerationTags('number', 'no. 1, no. ii-v'))
        .to.deep.equal([
          { type: 'number', raw: 'no. 1', start: '    1' },
          { type: 'number', raw: 'no. ii-v', start: '    2', end: '    5' }
        ])

      expect(parse.parseEnumerationTags('v. 1, no.3, pt. v, 1966'))
        .to.deep.equal([
          { type: 'number', raw: 'no.3', start: '    3' },
          { type: 'part', raw: 'pt. v', start: '    5' },
          { type: 'volume', raw: 'v. 1', start: '    1' },
          { type: 'year', raw: '1966', start: ' 1966' }
        ])
    })
  })

  describe('removeVolumeTags', () => {
    it('removes volume tags', () => {
      expect(parse.removeVolumeTags('jfe 123 v. 1')).to.equal('jfe 123 ')
      expect(parse.removeVolumeTags('jfe 123 no. iv v. 1 pt. 6')).to.equal('jfe 123 ')
    })
  })
})
