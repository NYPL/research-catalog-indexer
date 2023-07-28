const { removeTrailingElementsMatching } = require('../utils')

const primaryValues = (varFieldMatchObjects) => {
  // Return an empty string when there is a varFieldMatchObject with
  // no value property. Probably something like an orphaned parallel value.
  return removeTrailingEmpties(
    varFieldMatchObjects.map((match) => match.value || '')
  )
}

const parallelValues = (varFieldMatchObjects) => {
  const values = varFieldMatchObjects.map(parallelValue)

  return removeTrailingEmpties(values)
}

const parallelValue = (varFieldMatch) => {
  if (!varFieldMatch.parallel) return ''

  return (varFieldMatch.parallel.direction === 'rtl' ? '\u200F' : '') +
    varFieldMatch.parallel.value
}

const removeTrailingEmpties = (values) => {
  return removeTrailingElementsMatching(values, (v) => !v)
}

module.exports = {
  primaryValues,
  parallelValues,
  parallelValue
}
