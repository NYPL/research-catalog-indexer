const primaryValues = (varFieldMatchObjects) => {
  // Return an empty string when there is a varFieldMatchObject with
  // no value property. Probably something like an orphaned parallel value.
  return varFieldMatchObjects.map((match) => match.value || '')
}

const parallelValues = (varFieldMatchObjects) => {
  return varFieldMatchObjects.map(parallelValue)
}

const parallelValue = (varFieldMatch) => {
  if (!varFieldMatch.parallel) return ''

  return (varFieldMatch.parallel.direction === 'rtl' ? '\u200F' : '') +
    varFieldMatch.parallel.value
}

module.exports = {
  primaryValues,
  parallelValues,
  parallelValue
}
