const logger = require('../logger')
const { checkinCardStatusMapping } = require('../load-core-data')

/**
 *  Returns true if the volume range r1 is equal to or contains range r2
 *
 *  Note that the order of params is significant; Reversing them may produce a
 *  different result.
 **/
const rangeIncludes = (r1, r2) => {
  // Normalize inputs to ensure they have defined starts and ends
  // (i.e. allow for undefined .end)
  const [range1, range2] = [r1, r2]
    .map((r) => ({ start: r.start || r.end, end: r.end || r.start }))

  return range1.start <= range2.start && range2.end <= range1.end
}

/**
 *  Returns true if the volume range vol1 includes volume range vol2
 *
 *  If `strict` indicated, requires a `type` match
 * */
const volumeIncludes = (vol1, vol2, strict) => {
  let match = true

  if (strict) match &= vol2.type === vol1.type
  match &= rangeIncludes(vol1, vol2)

  return Boolean(match)
}

/**
 *  Returns true if the given checkin card item matches the given real item.
 *
 *  When `strict` enabled, requires:
 *   - the checkin card item's enumeration tags must all match the item's in value and type
 *
 *  When not `strict`, requires either:
 *   - neither item defines any volumes
 *   - the checkin card item's enumeration tags must all match the item's in value only
 * */
const checkinCardMatchesItem = (checkinCardItem, item, strict = false) => {
  const checkinVolumes = checkinCardItem._taggedEnumerations().slice(0, 1)
  // If neither checkin card nor item have enumeration values, return a non-strict match:
  if (!item._taggedEnumerations().length && !checkinVolumes.length && !strict) return true

  if (!item._taggedEnumerations().length) return false

  const matchingVolumes = item._taggedEnumerations().filter((itemVolume) => {
    const matchingVolume = checkinVolumes.find((checkinVolume) => {
      return volumeIncludes(itemVolume, checkinVolume, strict)
    })
    return !!matchingVolume
  })

  const matches = strict ? matchingVolumes.length === item._taggedEnumerations().length : matchingVolumes.length

  return Boolean(matches)
}

/**
 *  Given a checkin-card item, returns true if NYPL-Core indicates it can
 *  be displayed based on status
 * */
const hasAllowedStatus = (item) => {
  const status = checkinCardStatusMapping()[item.checkinCard.status.code]
  // TODO: This relies on updated nypl-core-objects to surface .display
  // Default to true if not set
  const display = (typeof status?.display === 'undefined') ? true : status.display
  return display
}

/**
 *  Returns true if the given checkin card item appears redundant alongside the given items
 *
 *  A checkin card is considered redundant if it matches another item in terms
 *  of enumeration tag values and:
 *   1. all tags also have matching types OR
 *   2. both items have matching years
 */
const isRedundantCheckinCard = (checkinCardItem, items) => {
  const matching = items.find((item) => {
    const hasYears = item._taggedYear() && checkinCardItem._taggedYear()
    const matchesYear = !hasYears || rangeIncludes(item._taggedYear(), checkinCardItem._taggedYear())

    const match = matchesYear
      // Loose match because found a matching year:
      ? checkinCardMatchesItem(checkinCardItem, item)
      // Strict match on all tag values and types:
      : checkinCardMatchesItem(checkinCardItem, item, true)

    if (match) {
      const method = matchesYear ? 'loose volume and year match' : 'strict match'
      logger.debug(`Removing redundant checkin card item: ${checkinCardItem.enumerationChronology()} via ${method}`)
    }

    return match
  })

  return Boolean(matching)
}

/**
 *  Returns true if the given checkin card item is offsite
 */
const isOffsiteCheckinCard = (item) => {
  const holdingLocations = item.holdingLocation() || []
  const isOffsite = /^loc:rc/.test(holdingLocations[0]?.id)

  return isOffsite
}

/**
 *  Builds a checkin card filter based on an array of real items that removes
 *  checkin cards that we don't want to index or display
 *
 *  The filter rejects anything that
 *   - is found to be redundant when compared with the given real items OR
 *   - is offsite (offsite checkin cards don't really make sense) OR
 *   - has a status that indicates it should be suppressed from view
 */
const buildCheckinCardFilter = (realItems) => {
  return (checkinCardItem) => {
    const issues = []

    if (isRedundantCheckinCard(checkinCardItem, realItems)) {
      issues.push('redundant')
    }
    if (isOffsiteCheckinCard(checkinCardItem)) {
      issues.push('offsite')
    }
    if (!hasAllowedStatus(checkinCardItem)) {
      issues.push('invalid status')
    }

    logger.debug(`Filtering out checkin card item '${checkinCardItem.enumerationChronology()}' due to issues: ${issues.join(',')}`)
    return issues.length === 0
  }
}

module.exports = {
  buildCheckinCardFilter,
  _private: {
    checkinCardMatchesItem,
    hasAllowedStatus,
    isOffsiteCheckinCard,
    isRedundantCheckinCard,
    rangeIncludes,
    volumeIncludes
  }
}
