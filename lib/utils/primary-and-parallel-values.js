const primaryValues = (varFieldMatchObjects) => {
  // Return an empty string when there is a varFieldMatchObject with
  // no value property. Probably something like an orphaned parallel value.
  return varFieldMatchObjects.map((match) => match.value || '')
}

const parallelValues = (varFieldMatchObjects) => {
  return varFieldMatchObjects.map((match) => {
    if (!match.parallel) return ''
    return (match.parallel.direction === 'rtl' ? '\u200F' : '') +
      match.parallel.value
  })
}

module.exports = {
  primaryValues,
  parallelValues
}
