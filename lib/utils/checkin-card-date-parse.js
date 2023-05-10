/**
 *
 * Given a date string from a checkin card, returns an ISO8601 formatting of
 * the date.
 *
 * Minimal support for converting season strings into proper dates.
 */
const parseCheckinCardDate = (s) => {
  if (typeof s !== 'string') return null

  // Insist on a 4-digit year:
  if (!/\d{4}/.test(s)) {
    return null
  }

  const seasonMap = [
    {
      match: /\bSum(\.|mer)?\b/,
      replace: 'Jul.'
    },
    {
      match: /\bSpr(\.|ing)?\b/,
      replace: 'Apr.'
    },
    {
      match: /\b(Fall|Aut(\.|umn)?)\b/,
      replace: 'Oct.'
    },
    {
      match: /\bWin(\.|ter)?\b/,
      replace: 'Jan.'
    }
  ]
  seasonMap.forEach((rule) => {
    if (rule.match.test(s)) {
      s = s.replace(rule.match, rule.replace)
    }
  })

  let date
  try {
    date = new Date(s)
    return date.toISOString().replace(/T.+/, '')
  } catch (e) {
    return null
  }
}

module.exports = {
  parseCheckinCardDate
}
