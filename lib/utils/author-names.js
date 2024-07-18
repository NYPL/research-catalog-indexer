// Match the following patterns:
//  - Lastname, (Firstname|Iniital.)
//  - Lastname, (Firstname|Initial.) (Middlename|Initial.)
const NAME_PATTERN = /^(?<last>[a-zÀ-ž-]+), (?<first>[a-zÀ-ž]\.|[a-zÀ-ž-]+)( (?<middle1>[a-zÀ-ž]\.|[a-zÀ-ž-]+))?( (?<middle2>[a-zÀ-ž]\.|[a-zÀ-ž-]+))?/i

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

const withoutDates = (name) => {
  if (typeof name !== 'string') return name

  const tokens = name.split(', ')
  if (tokens.length < 3) return name

  return tokens.slice(0, 2).join(', ')
}

module.exports = {
  normalizeAuthorName,
  withoutDates
}
