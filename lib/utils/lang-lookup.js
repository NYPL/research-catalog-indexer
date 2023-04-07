const fs = require('fs')

const languageData = fs.readFileSync(`${__dirname}/../../data/language-code-to-label.csv`)
  .toString()
  .split('\n')
  .map((line) => {
    const [code, rawValue] = line.split(',')
    return [code, rawValue && rawValue.slice(2, -1)]
  })

const langLookup = (key) => { return languageData[key] }


module.exports = {
  langLookup
}
