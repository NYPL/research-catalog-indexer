const expect = require('chai').expect
const itemSort = require('../../lib/utils/item-sort')
const EsItem = require('../../lib/es-models/item')
const EsCheckinCardItem = require('../../lib/es-models/checkin-card-item')

const mockEsItem = (enumerationChronology, shelfMark = '', uri, Klass = EsItem) => {
  const item = new Klass()
  item.enumerationChronology = () => [enumerationChronology]
  item._shelfMarkNormalized = () => shelfMark
  item.uri = () => uri
  return item
}

const mockEsCheckinCardItem = (enumerationChronology, shelfMark = '', uri = '') => {
  return mockEsItem(enumerationChronology, shelfMark, uri, EsCheckinCardItem)
}

describe('utils/item-sort', () => {
  describe('groupByShelfmark', () => {
    it('no-ops empty array', () => {
      expect(itemSort._private.groupByShelfmark([])).to.deep.equal([])
    })

    it('groups by shelfmark', () => {
      const grouped = itemSort._private.groupByShelfmark([
        { _shelfMarkNormalized: () => '*ZAN', uri: '1' },
        { _shelfMarkNormalized: () => 'JK 123', uri: '2' },
        { _shelfMarkNormalized: () => 'PC', uri: '3' },
        { _shelfMarkNormalized: () => 'JK 123', uri: '4' },
        { _shelfMarkNormalized: () => '*ZAN', uri: '5' }
      ])
      const out = [
        {
          shelfmark: '*ZAN',
          items: [
            { _shelfMarkNormalized: () => '*ZAN', uri: '1' },
            { _shelfMarkNormalized: () => '*ZAN', uri: '5' }
          ]
        },
        {
          shelfmark: 'JK 123',
          items: [
            { _shelfMarkNormalized: () => 'JK 123', uri: '2' },
            { _shelfMarkNormalized: () => 'JK 123', uri: '4' }
          ]
        },
        {
          shelfmark: 'PC',
          items: [
            { _shelfMarkNormalized: () => 'PC', uri: '3' }
          ]
        }
      ]
      expect(JSON.stringify(grouped)).to.equal(JSON.stringify(out))
    })
  })

  describe('shelfmarkGroupCoverageComparator', () => {
    it('responds correctly for different values', () => {
      let result = itemSort._private.shelfmarkGroupCoverageComparator(
        { items: [mockEsItem('v. 2')] },
        { items: [mockEsItem('v. 1')] }
      )
      expect(result).to.equal(1)

      result = itemSort._private.shelfmarkGroupCoverageComparator(
        { items: [mockEsItem('v. 1')] },
        { items: [mockEsItem('v. 2')] }
      )
      expect(result).to.equal(-1)

      result = itemSort._private.shelfmarkGroupCoverageComparator(
        { items: [mockEsItem('2025')] },
        { items: [mockEsItem('1998')] }
      )
      expect(result).to.equal(1)
    })

    it('responds correctly for complicated values', () => {
      let result = itemSort._private.shelfmarkGroupCoverageComparator(
        { items: [mockEsItem('v. 3'), mockEsItem('v. 4')] },
        { items: [mockEsItem('v. 2'), mockEsItem('v. 1')] }
      )
      expect(result).to.equal(1)

      result = itemSort._private.shelfmarkGroupCoverageComparator(
        { items: [mockEsItem('v. 1 no. 4'), mockEsItem('v. 1 no. 3')] },
        { items: [mockEsItem('r. 1'), mockEsItem('r. 2, no. 1')] }
      )
      // Expect 'number' to be dominant tag, so order group w/ no. 1 first
      expect(result).to.equal(1)

      result = itemSort._private.shelfmarkGroupCoverageComparator(
        { items: [mockEsItem('2025, v. 2')] },
        { items: [mockEsItem('1998, v. 1')] }
      )
      // Both 'year' and 'volume' are dominant and both cause former to sort last:
      expect(result).to.equal(1)
    })
  })

  describe('shelfmarkGroupMicrofilmComparator', () => {
    it('responds correctly as comparator', () => {
      let result = itemSort._private.shelfmarkGroupMicrofilmComparator(
        { shelfmark: '*ZAN' },
        { shelfmark: 'JFK' }
      )
      expect(result).to.equal(-1)

      result = itemSort._private.shelfmarkGroupMicrofilmComparator(
        { shelfmark: 'JFK' },
        { shelfmark: 'sc micro' }
      )
      expect(result).to.equal(1)

      result = itemSort._private.shelfmarkGroupMicrofilmComparator(
        { shelfmark: '*ZAN' },
        { shelfmark: 'sc micro' }
      )
      expect(result).to.equal(-1)

      result = itemSort._private.shelfmarkGroupMicrofilmComparator(
        { shelfmark: 'sc micro' },
        { shelfmark: 'sc micro' }
      )
      expect(result).to.equal(0)
    })

    it('should favor microfilm shelfmarks', () => {
      const input = [
        { shelfmark: 'JK 123' },
        { shelfmark: '*ZAN' },
        { shelfmark: 'ZYX 123' },
        { shelfmark: 'SC micro' },
        { shelfmark: 'ABC 123' }
      ]
      expect(input.sort(itemSort._private.shelfmarkGroupMicrofilmComparator))
        .to.deep.equal([
          { shelfmark: '*ZAN' },
          { shelfmark: 'SC micro' },
          { shelfmark: 'JK 123' },
          { shelfmark: 'ZYX 123' },
          { shelfmark: 'ABC 123' }
        ])
    })
  })

  describe('shelfmarkGroupAlphaComparator', () => {
    it('sorts groups alphanumerically', () => {
      const input = [
        { shelfmark: 'JK 123' },
        { shelfmark: 'JK 124' },
        { shelfmark: '*ZAN' },
        { shelfmark: 'ABC 456' }
      ]
      const output = input.sort(itemSort._private.shelfmarkGroupAlphaComparator)

      expect(output).to.deep.equal([
        { shelfmark: '*ZAN' },
        { shelfmark: 'ABC 456' },
        { shelfmark: 'JK 123' },
        { shelfmark: 'JK 124' }
      ])
    })
  })

  describe('shelfmarkGroupComparator', () => {
    it('sorts groups by volume coverage', () => {
      // The v. 1 causes the first group to sort first (even though we may prefer *ZAN at the top
      const result = itemSort._private.shelfmarkGroupComparator(
        { shelfmark: 'JK 123', items: [mockEsItem('v. 1')] },
        { shelfmark: '*ZAN', items: [mockEsItem('v. 2')] }
      )
      expect(result).to.equal(-1)
    })

    it('sorts groups by year coverage', () => {
      const result = itemSort._private.shelfmarkGroupComparator(
        { shelfmark: 'JK 123', items: [mockEsItem('2025')] },
        { shelfmark: '*ZAN', items: [mockEsItem('2024')] }
      )
      expect(result).to.equal(1)
    })

    it('sorts groups with microfilm shelfmarks', () => {
      let result = itemSort._private.shelfmarkGroupComparator(
        { shelfmark: 'JK 123', items: [mockEsItem('v. 1')] },
        { shelfmark: '*ZAN', items: [mockEsItem('v. 1')] }
      )
      expect(result).to.equal(1)

      result = itemSort._private.shelfmarkGroupComparator(
        { shelfmark: 'SC micro', items: [mockEsItem('v. 1')] },
        { shelfmark: 'JK 123', items: [mockEsItem('v. 1')] }
      )
      expect(result).to.equal(-1)
    })

    it('sorts groups with by shelfmark', () => {
      let result = itemSort._private.shelfmarkGroupComparator(
        { shelfmark: 'ABC 123', items: [mockEsItem('v. 1')] },
        { shelfmark: 'ABC 456', items: [mockEsItem('v. 1')] }
      )
      expect(result).to.equal(-1)

      result = itemSort._private.shelfmarkGroupComparator(
        { shelfmark: 'ZYX 123', items: [mockEsItem('v. 1')] },
        { shelfmark: 'ABC 456', items: [mockEsItem('v. 1')] }
      )
      expect(result).to.equal(1)
    })
  })

  describe('dominantEnumerationTags', () => {
    it('identifies dominant enumeration tags', () => {
      const input = [
        mockEsItem('v. 1'),
        mockEsItem('box II, v. 2'),
        mockEsItem('v. 3, no. 1'),
        mockEsItem('box 8, v. iV')
      ]
      expect(itemSort._private.dominantEnumerationTags(input)).to.deep.equal([
        { type: 'volume', count: 4 },
        { type: 'box', count: 2 },
        { type: 'number', count: 1 }
      ])
    })
  })

  describe('highestPriorityEnumerationTypes', () => {
    it('selects most prevelant tags', () => {
      const input = [
        mockEsItem('v. 1'),
        mockEsItem('v. 2 no. 1'),
        mockEsItem('v. 3 no. 1')
      ]
      expect(itemSort._private.highestPriorityEnumerationTypes(input))
        .to.deep.equal(['volume', 'number'])
    })

    it('selects most prevelant tags', () => {
      let input = [
        mockEsItem('r. 1'),
        mockEsItem('r. 2 no. 1'),
        mockEsItem('v. 3 no. 1')
      ]
      expect(itemSort._private.highestPriorityEnumerationTypes(input))
        .to.deep.equal(['reel', 'number', 'volume'])

      input = [
        mockEsItem('r. 1'),
        mockEsItem('v. 2 no. 1'),
        mockEsItem('v. 3 no. 1')
      ]
      // Reel fails to appear here because it appears in < 50% of items:
      expect(itemSort._private.highestPriorityEnumerationTypes(input))
        .to.deep.equal(['number', 'volume'])
    })
  })

  describe('itemComparatorOnTypes', () => {
    it('returns basic comparator', () => {
      expect(itemSort._private.itemComparatorOnTypes(['volume'])(
        mockEsItem('v. 4'),
        mockEsItem('v. 3')
      )).to.equal(1)

      expect(itemSort._private.itemComparatorOnTypes(['bind'])(
        mockEsItem('bind 1'),
        mockEsItem('bind 2')
      )).to.equal(-1)

      expect(itemSort._private.itemComparatorOnTypes(['box'])(
        mockEsItem('box 1'),
        mockEsItem('box 1')
      )).to.equal(0)
    })

    it('returns multi-tag comparator', () => {
      expect(itemSort._private.itemComparatorOnTypes(['plate', 'series', 'number'])(
        mockEsItem('plate 2, series 5'),
        mockEsItem('plate 1, series 2')
      )).to.equal(1)

      expect(itemSort._private.itemComparatorOnTypes(['plate', 'series', 'number'])(
        mockEsItem('plate 1, series 2'),
        mockEsItem('plate 2, series 4')
      )).to.equal(-1)

      expect(itemSort._private.itemComparatorOnTypes(['plate', 'series', 'number'])(
        mockEsItem('plate 2, series 4'),
        mockEsItem('plate 2, series 2')
      )).to.equal(1)

      expect(itemSort._private.itemComparatorOnTypes(['plate', 'series', 'number'])(
        mockEsItem('no. 1 plate 2, series 4'),
        mockEsItem('no. 2 plate 2, series 2')
      )).to.equal(1)
    })

    it('sorts suppl last, all else equal', () => {
      expect(itemSort._private.itemComparatorOnTypes(['box', 'volume', 'number'])(
        mockEsItem('box 1, vol. 2'),
        mockEsItem('box 1, vol. 2')
      )).to.equal(0)

      expect(itemSort._private.itemComparatorOnTypes(['box', 'volume', 'number'])(
        mockEsItem('box 1, vol. 2 suppl'),
        mockEsItem('box 1, vol. 2')
      )).to.equal(1)
    })
  })

  describe('isActivelyCollected', () => {
    it('returns true if includes recent checkin card items', () => {
      let input = [
        mockEsItem('1997'),
        mockEsCheckinCardItem('1997')
      ]
      // Fails because no recent items:
      expect(itemSort._private.isActivelyCollected(input)).to.equal(false)

      input = [
        mockEsItem('1997'),
        mockEsItem('2026')
      ]
      // Fails because no checkin-cards:
      expect(itemSort._private.isActivelyCollected(input)).to.equal(false)

      input = [
        mockEsItem('1997'),
        mockEsCheckinCardItem('2026')
      ]
      // Succeeds because has checkin-cards and recent item:
      expect(itemSort._private.isActivelyCollected(input)).to.equal(true)
    })
  })

  describe('sortKeysForItems', () => {
    it('returns lookup for sorted items', () => {
      expect(itemSort.sortKeysForItems([
        mockEsItem('v. 48, no. 7-12 (1992)', 'ABC', 'i123'),
        mockEsItem('no. 1-2 (2007)', 'ABC', 'i456'),
        mockEsItem('v. 50-51, no. 1-3 (1994-1995)', 'ABC', 'i789')
      ]))
        .to.deep.equal({
          i123: '   0',
          i789: '   1',
          i456: '   2'
        })
    })
  })

  describe('sortItems', () => {
    it('orders by year', () => {
      const input = [
        mockEsItem('v. 48, no. 7-12 (1992)', 'ABC'),
        mockEsItem('no. 1-2 (2007)', 'ABC'),
        mockEsItem('v. 50-51, no. 1-3 (1994-1995)', 'ABC')
      ]
      expect(itemSort._private.sortItems(input).map((i) => i.enumerationChronology()[0])).to.deep.equal([
        'v. 48, no. 7-12 (1992)',
        'v. 50-51, no. 1-3 (1994-1995)',
        'no. 1-2 (2007)'
      ])
    })

    it('orders missing years first', () => {
      // These are ordered by year, then number, then volume
      // Both 'volume' and 'number' occur 5 times each, so we break the tie by alhpabetically
      // In general when ordering by a enumeration tag, we order items without any value for that tag first.
      const input = [
        'v. 48, no. 7-12 (1992)',
        'no. 1-2 ',
        'v. 50-51, no. 1-3 (1994-1995)',
        'v. 48, no. 1-6 (1992)',
        'v. 49, no. 1-6 (1993)',
        'v. 10'
      ].map((v) => mockEsItem(v, 'ABC'))

      expect(itemSort._private.sortItems(input).map((i) => i.enumerationChronology()[0])).to.deep.equal([
        'v. 10',
        'no. 1-2 ',
        'v. 48, no. 1-6 (1992)',
        'v. 48, no. 7-12 (1992)',
        'v. 49, no. 1-6 (1993)',
        'v. 50-51, no. 1-3 (1994-1995)'
      ])
    })

    it('orders by enumeration tag when years identical', () => {
      const input = [
        'v. 47, no. 7-12 (1990)',
        'v. 48, no. 7-12 (1991)',
        'no. 1-2 (2007)',
        'v. 48, no. 1-6 (1992)',
        'v. 48, no. 7-12 (1992)',
        'v. 49, no. 1-6 (1993)',
        'v. 50-51, no. 1-3 (1994-1995)',
        'v. 48, no. 1-6 (1991)',
        'no. 3-4 (2007)',
        'no. 1-2 (2008)',
        'no. 1-2 (2009)',
        'v. 51, no. 4-6',
        'v. 52, no. 1-3 (1996)',
        'v. 52, no. 4-6 (1996)'
      ].map((v) => mockEsItem(v, 'ABC'))

      expect(itemSort._private.sortItems(input).map((i) => i.enumerationChronology()[0])).to.deep.equal([
        'v. 51, no. 4-6',
        'v. 47, no. 7-12 (1990)',
        'v. 48, no. 1-6 (1991)',
        'v. 48, no. 7-12 (1991)',
        'v. 48, no. 1-6 (1992)',
        'v. 48, no. 7-12 (1992)',
        'v. 49, no. 1-6 (1993)',
        'v. 50-51, no. 1-3 (1994-1995)',
        'v. 52, no. 1-3 (1996)',
        'v. 52, no. 4-6 (1996)',
        'no. 1-2 (2007)',
        'no. 3-4 (2007)',
        'no. 1-2 (2008)',
        'no. 1-2 (2009)'
      ])
    })

    it('orders [many items] by enumeration tag when years identical', () => {
      const input = [
        'v. 1-2, inc. (1945-1946)',
        'v. 3 (1946/1947)',
        'v. 4 (1947/1948)',
        'v. 5 (1948/1949)',
        'v. 9 (1953)',
        'v. 12 (1956)- v. 13 (1957)',
        'v. 12, no.1-5 (1956)',
        'v. 14 (1956)',
        'v. 15 (1959)',
        'v.16, inc. (1960)',
        'v. 18 (1962)',
        'v. 19 (1963)',
        'v. 20 (1964)',
        'v. 21 (1965)',
        'v. 22 (1966)',
        'v. 27 (1971)',
        'v. 29 (1973)',
        'v. 31 (1975)',
        'v. 32 (1976)',
        'v. 33 (1977)',
        'v. 34 (1978)',
        'v. 35, no.1-3 (1979)',
        'v. 35, no.4-6 (1979)',
        'v. 36 (1980)',
        'v. 37 (1981)',
        'v. 38 (1982)',
        'v. 38 (1983)',
        'v. 40 (1984)',
        'v. 40, no. 6 (1984)',
        'v. 41 no. 1-6 (1985)',
        'v. 41, no. 7-12 (1985)',
        'v. 42, no. 1-6 (1986)',
        'v. 42, no. 7-12 (1986)',
        'v. 43, no.1-6 (1987)',
        'v. 43, no. 7-12 (1987)',
        'v. 44, no. 1-6 (1988)',
        'v. 44, no. 7-12 (1988)',
        'v. 45, no. 1-4 (1989)',
        'v. 45, no. 5-8 (1989)',
        'v. 45, no. 9-12 (1989)',
        'v. 47, no. 1-6 (1990)',
        'v. 47, no. 7-12 (1990)',
        'v. 48, no. 1-6 (1991)',
        'v. 48, no. 7-12 (1991)',
        'v. 48, no. 1-6 (1992)',
        'v. 48, no. 7-12 (1992)',
        'v. 49, no. 1-6 (1993)',
        'v. 50-51, no. 1-3 (1994-1995)',
        'no. 1-2 (2007)',
        'no. 3-4 (2007)',
        'no. 1-2 (2008)',
        'no. 1-2 (2009)',
        'v. 51, no. 4-6',
        'v. 52, no. 1-3 (1996)',
        'v. 52, no. 4-6 (1996)',
        'v. 53, inc. (1997)',
        'v. 54 (1998)',
        'v. 55 (1999)',
        'v. 56 (2000)',
        'v. 57 (2001)',
        'v. 58 (2002)',
        'v. 59 (2003)',
        'v. 60, no. 1-4 (2004)',
        'v. 60, no. 5-6 (2004)',
        'v. 61, no. 1-2 (2005)',
        'v. 62 (2006)',
        'no. 5-6 (2007)',
        'no. 3-4 (2008)',
        'no. 5-6 (2008)',
        'no. 3-4 (2009)',
        'no. 5-6 (2009)'
      ].map((v) => mockEsItem(v, 'ABC'))

      expect(itemSort._private.sortItems(input).map((i) => i.enumerationChronology()[0])).to.deep.equal([
        'v. 51, no. 4-6',
        'v. 1-2, inc. (1945-1946)',
        'v. 3 (1946/1947)',
        'v. 4 (1947/1948)',
        'v. 5 (1948/1949)',
        'v. 9 (1953)',
        'v. 12 (1956)- v. 13 (1957)',
        'v. 12, no.1-5 (1956)',
        'v. 14 (1956)',
        'v. 15 (1959)',
        'v.16, inc. (1960)',
        'v. 18 (1962)',
        'v. 19 (1963)',
        'v. 20 (1964)',
        'v. 21 (1965)',
        'v. 22 (1966)',
        'v. 27 (1971)',
        'v. 29 (1973)',
        'v. 31 (1975)',
        'v. 32 (1976)',
        'v. 33 (1977)',
        'v. 34 (1978)',
        'v. 35, no.1-3 (1979)',
        'v. 35, no.4-6 (1979)',
        'v. 36 (1980)',
        'v. 37 (1981)',
        'v. 38 (1982)',
        'v. 38 (1983)',
        'v. 40 (1984)',
        'v. 40, no. 6 (1984)',
        'v. 41 no. 1-6 (1985)',
        'v. 41, no. 7-12 (1985)',
        'v. 42, no. 1-6 (1986)',
        'v. 42, no. 7-12 (1986)',
        'v. 43, no.1-6 (1987)',
        'v. 43, no. 7-12 (1987)',
        'v. 44, no. 1-6 (1988)',
        'v. 44, no. 7-12 (1988)',
        'v. 45, no. 1-4 (1989)',
        'v. 45, no. 5-8 (1989)',
        'v. 45, no. 9-12 (1989)',
        'v. 47, no. 1-6 (1990)',
        'v. 47, no. 7-12 (1990)',
        'v. 48, no. 1-6 (1991)',
        'v. 48, no. 7-12 (1991)',
        'v. 48, no. 1-6 (1992)',
        'v. 48, no. 7-12 (1992)',
        'v. 49, no. 1-6 (1993)',
        'v. 50-51, no. 1-3 (1994-1995)',
        'v. 52, no. 1-3 (1996)',
        'v. 52, no. 4-6 (1996)',
        'v. 53, inc. (1997)',
        'v. 54 (1998)',
        'v. 55 (1999)',
        'v. 56 (2000)',
        'v. 57 (2001)',
        'v. 58 (2002)',
        'v. 59 (2003)',
        'v. 60, no. 1-4 (2004)',
        'v. 60, no. 5-6 (2004)',
        'v. 61, no. 1-2 (2005)',
        'v. 62 (2006)',
        'no. 1-2 (2007)',
        'no. 3-4 (2007)',
        'no. 5-6 (2007)',
        'no. 1-2 (2008)',
        'no. 3-4 (2008)',
        'no. 5-6 (2008)',
        'no. 1-2 (2009)',
        'no. 3-4 (2009)',
        'no. 5-6 (2009)'
      ])
    })
  })
})
