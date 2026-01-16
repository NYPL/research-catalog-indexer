// Replace FE20 + FE21 combining halves with a single U+0361 combining double inverted breve
const combineLigaturePairs = (text) => {
  if (!text) return text
  return text.replace(/(.)\uFE20(.)\uFE21/g, (match, left, right) => {
    return `${left}\u0361${right}`
  })
}

module.exports = {
  combineLigaturePairs
}
