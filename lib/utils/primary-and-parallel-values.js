const primaryValues = (varFieldMatchObjects) => {
  return varFieldMatchObjects.map((match) => match.value)
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
