// Match the following patterns:
//  - Lastname, (Firstname|Iniital.)
//  - Lastname, (Firstname|Initial.) (Middlename|Initial.)
//  - Lastname1 Lastname2, (Firstname|Initial.) (Middlename|Initial.)
const NAME_PATTERN = /^(?<last>[a-zÀ-ž- ]+), (?<first>[a-zÀ-ž]\.|[a-zÀ-ž-]+)( (?<middle1>[a-zÀ-ž]\.|[a-zÀ-ž-]+))?( (?<middle2>[a-zÀ-ž]\.|[a-zÀ-ž-]+))?/i

/**
* Given a name such as appears in catalog data (e.g. "Smith, John A.", "John Smith Fdn."),
* if the names matches NAME_PATTERHN above,
* returns an array of possible normalizations (e.g. "John Smith", "John A. Smith")
* Supports up to two middle name/initials.
*/
const normalizeAuthorName = (name) => {
  // If name doesn't match, return it unchanged:
  if (!NAME_PATTERN.test(name)) {
    return [name]
  }

  const permutations = []

  // Parse out name parts:
  const parts = name.match(NAME_PATTERN)
  const { first, last, middle1, middle2 } = parts.groups

  // Start with firstname lastname
  permutations.push(`${first} ${last}`)
  // If there's a middle name, add that permutation:
  if (middle1) {
    permutations.push(`${first} ${middle1} ${last}`)
    // If there's a second middle name, add that permutation:
    if (middle2) {
      permutations.push(`${first} ${middle1} ${middle2} ${last}`)
    }
  }

  return permutations
}

/**
* Given a author string (e.g. "Dickens, Charles, 1812-1870", "Gurudatta, 1894-1989"),
* returns the string without the dates part of the string.
*/
const withoutDates = (name) => {
  if (typeof name !== 'string') return name

  const tokens = name.split(', ')
    .slice(0, 2)
  if (tokens.length < 2) return name

  // If author has only one name, second token may be dates; Remove it:
  if (/\d{4}/.test(tokens[1])) {
    tokens.pop()
  }

  return tokens.join(', ')
}

/**
 * Given a name string (e.g. "Dickens, Charles", "Doe, Jane.", returns same
 * string with meaningless trailing period character removed. Only removes
 * trailing period if it follows 2 or more lowercase characters (or something
 * numeric, e.g. dates) - to avoid removing periods after an initial.
*/
const trimTrailingPeriod = (name) => {
  if (!name) return name
  return name.replace(/(?<=[a-z0-9]{2})\.$/, '')
}

/**
* Given a contributor name and a list of "other names", returns true if the name
* essentially duplicates one of the "other names".
*
* e.g. nameIsRedundant (
*        'Dickens, Charles',
*        ['Doe, Jane', 'Dickens, Charles, 1812-1870']
*      ) => true
*/
const nameIsRedundant = (name, otherNames) => {
  if (!otherNames) return false

  return otherNames.map(trimTrailingPeriod)
    .some((otherName) => otherName.startsWith(trimTrailingPeriod(name)))
}

module.exports = {
  nameIsRedundant,
  normalizeAuthorName,
  trimTrailingPeriod,
  withoutDates
}
