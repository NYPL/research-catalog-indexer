const isValidResponse = (resp) => {
  return resp && resp.data
}

const bNumberWithCheckDigit = (bnumber) => {
  const ogBnumber = bnumber
  const results = []
  let multiplier = 2
  for (const digit of bnumber.split('').reverse().join('')) {
    results.push(parseInt(digit) * multiplier++)
  }

  const remainder = results.reduce(function (a, b) { return a + b }, 0) % 11

  // OMG THIS IS WRONG! Sierra doesn't do mod11 riggghhttttt
  // remainder = 11 - remainder

  if (remainder === 11) return `${ogBnumber}0`
  if (remainder === 10) return `${ogBnumber}x`

  return `${ogBnumber}${remainder}`
}

module.exports = {
  isValidResponse,
  bNumberWithCheckDigit
}
