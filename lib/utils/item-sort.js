const EsCheckinCardItem = require('../es-models/checkin-card-item')
const {
  compoundComparator,
  countDistinctValues,
  groupByCallback,
  orderByFixedArrayComparator
} = require('../utils')

/**
 *  Returns true if
 *  1. items includes checkin-card items and
 *  2. has items within 8 years
 * */
const isActivelyCollected = (items) => {
  const maxYear = items.map((i) => i._taggedYear())
    .filter((y) => y)
    .sort((y1, y2) => y1 < y2 ? -1 : 1)
    .pop()
  const hasRecentIssues = maxYear > (new Date()).getFullYear() - 8
  const hasCheckinCards = !!items.find((i) => i instanceof EsCheckinCardItem)

  // We're actively collecting if there are checkin card items and any items are dated within 8 years:
  return hasCheckinCards && hasRecentIssues
}

/**
 *  Given an array of items, returns plainobjects composed of:
 *   - shelfmark {string}: common normalized shelfmark [prefix] for items
 *   - items {(EsItem|EsCheckinCardItem)[]}: array of items
 * */
const groupByShelfmark = (items) => {
  // applyNormalizedShelfmarks(items)

  const lookup = groupByCallback(items, (i) => i._shelfMarkNormalized())

  return Object.entries(lookup).map(([shelfmark, items]) => ({ shelfmark, items }))
}

/**
 *  Comparator that governs sort of shelfmark groups
 *  based on relative coverage (oldest first)
 *  */
const shelfmarkGroupCoverageComparator = (g1, g2) => {
  const topTags1 = dominantEnumerationTags(g1.items).map((tag) => tag.type)
  const topTags2 = dominantEnumerationTags(g2.items).map((tag) => tag.type)
  const topCommonTags = topTags1.filter((t) => topTags2.includes(t))
  const tag = topCommonTags.shift()

  const coverage1 = [
    g1.items[0]._taggedEnumerations().find((v) => v.type === tag)?.start || g1.items[0]._taggedEnumerations()[0]?.start
  ]
  const coverage2 = [
    g2.items[0]._taggedEnumerations().find((v) => v.type === tag)?.start || g2.items[0]._taggedEnumerations()[0]?.start
  ]
  // console.log('Comparing shelfmark groups via ', tag, coverage1, coverage2)

  if (coverage1[0] === coverage2[0]) return 0
  // Oldest coverage first:
  return coverage1[0] < coverage2[0] ? -1 : 1
}

/**
 *  Comparator that governs sort of shelfmark groups
 *  based on alphanumeric order of shelfmarks
 * */
const shelfmarkGroupAlphaComparator = (g1, g2) => {
  const shelfmark1 = g1.shelfmark
  const shelfmark2 = g2.shelfmark

  if (shelfmark1 === shelfmark2) return 0
  return shelfmark1 < shelfmark2 ? -1 : 1
}

/**
 *  Comparator that governs sort of shelfmark groups
 *  based on if one of them appears to be microfilm
 **/
const shelfmarkGroupMicrofilmComparator = (g1, g2) => {
  const shelfmark1 = g1.shelfmark
  const shelfmark2 = g2.shelfmark

  const microfilmShelfmarks = [
    /^\*zan/i,
    /^sc micro/i
  ]

  for (const pattern of microfilmShelfmarks) {
    const matching1 = pattern.test(shelfmark1)
    const matching2 = pattern.test(shelfmark2)

    if (matching1 && !matching2) return -1
    if (matching2 && !matching1) return 1
  }
  return 0
}

/**
 *  Given an array of items, returns an ordered hash relating enumeration tag
 *  to precedence
 * */
const dominantEnumerationTags = (items) => {
  const allTypes = items.map((item) => item._taggedEnumerationTypes())?.flat(1)
  const types = allTypes ? countDistinctValues(allTypes) : []
  return Object.entries(types)
    .map(([type, count]) => ({ type, count }))
    .sort(compoundComparator([
      // First sort on precedence:
      (t1, t2) => t1.count === t2.count ? 0 : (t1.count < t2.count ? 1 : -1),
      // Break ties by sorting on tag name:
      (t1, t2) => t1.type < t2.type ? -1 : 1
    ]))
}

/**
 *  Given an array of items, returns an array of the highest priority enumeration tags
 *  Gives precedence to certain high-priority tags when found with significance
 * */
const highestPriorityEnumerationTypes = (items) => {
  const highPrecedenceTags = ['reel', 'box', 'disc', 'year']

  const typesWithCounts = dominantEnumerationTags(items)
    .filter((type) => {
      // Don't sort on any high-precedence tag unless there's good coverage:
      if (highPrecedenceTags.includes(type.type) && type.count < 0.5 * items.length) return false
      return true
    })

  const types = typesWithCounts.map((t) => t.type)

  return types.sort(orderByFixedArrayComparator(highPrecedenceTags))
}

/**
 *  Comparator governing order of shelfmark groups that prioritizes
 *   - oldest (low years / enumeration tags), followed by..
 *   - certain microfilm shelfmarks, followed by..
 *   - alphanumeric order of shelfmark
 **/
const shelfmarkGroupComparator = compoundComparator([
  // First sort on coverage:
  shelfmarkGroupCoverageComparator,
  // Then favor microfilm:
  shelfmarkGroupMicrofilmComparator,
  // Lastly just sort on shelfmark:
  shelfmarkGroupAlphaComparator
])

/**
 *  Given an array of items, sorts them by:
 *   - Group by shelfmark
 *   - Order shelfmark groups
 *   - Order items within each shelfmark group
 *   - Reverse order if items represent actively collected holdings
 */
const sortItems = (items) => {
  const shelfmarkGroups = groupByShelfmark(items)
    .map((group) => {
      console.log('items: ', group.items.map((i) => i.enumerationChronology()))
      const types = highestPriorityEnumerationTypes(group.items)
      const typeSorter = itemComparatorOnTypes(types)
      group.items = group.items.sort(typeSorter)
      return group
    })
    .sort(shelfmarkGroupComparator)

  let sortedItems = shelfmarkGroups
    .map((group) => group.items)
    .flat(1)

  const direction = isActivelyCollected(items) ? 'desc' : 'asc'
  if (direction === 'desc') {
    console.log('reversing')
    sortedItems = sortedItems.reverse()
  }

  return sortedItems
}

/**
 *  A compound comparator defined on a given set of enumeration types
 *  (presumably found to be popular among the items)
 *  The comparator will compare items on each of these metrics until a difference is found:
 *   - each of the given types, in order
 *   - presence of 'suppl' in the enumeration chronology (to sort them last, all else equal)
 *   - alphabetic comparison of enumeration chronology
 * */
const itemComparatorOnTypes = (types) => {
  return compoundComparator(
    types.map((type) => {
      return (i1, i2) => {
        const i1Val = i1._taggedEnumerations().find((v) => v.type === type)
        const i2Val = i2._taggedEnumerations().find((v) => v.type === type)

        if (i1Val && i2Val) {
          return i1Val.start === i2Val.start
            ? 0
            : (i1Val.start < i2Val.start ? -1 : 1)
        }
        if (i1Val) return 1
        if (i2Val) return -1
        return 0
      }
    })
      .concat([
        // A penultimate tie breaking comparator to push 'suppl' items after others, all other tags being equal:
        (i1, i2) => {
          const val1 = (i1.enumerationChronology() || []).shift()
          const val2 = (i2.enumerationChronology() || []).shift()

          const sortLastKeywords = ['suppl']

          for (const k of sortLastKeywords) {
            if (val1.includes(k)) return 1
            if (val2.includes(k)) return -1
          }
          return 0
        },
        // A final tie breaking comparator to simply sort otherwise equal values alphanumerically:
        (i1, i2) => {
          const val1 = (i1.enumerationChronology() || []).shift().replace(/[^\w]/, '')
          const val2 = (i2.enumerationChronology() || []).shift().replace(/[^\w]/, '')

          if (val1 < val2) return -1
          if (val1 > val2) return 1
          return 0
        }
      ])
  )
}

const sortKeysForItems = (items) => {
  // secondGuessTypes(items)
  return sortItems(items)
    .reduce((h, item, ind) => {
      const sortKey = ('' + ind).padStart(4)
      // console.log(`Item sort:  ${item.uri()}: ${item.shelfMark()} > ${item.enumerationChronology()}`)
      h[item.uri()] = sortKey
      return h
    }, {})
}

module.exports = {
  sortKeysForItems,
  _private: {
    dominantEnumerationTags,
    groupByShelfmark,
    highestPriorityEnumerationTypes,
    isActivelyCollected,
    itemComparatorOnTypes,
    shelfmarkGroupAlphaComparator,
    shelfmarkGroupComparator,
    shelfmarkGroupCoverageComparator,
    shelfmarkGroupMicrofilmComparator,
    sortItems
  }
}
