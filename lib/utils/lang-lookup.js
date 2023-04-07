const fs = require('fs')

let languageData = {}
fs.readFileSync(path.join(__dirname, '../../data/language-code-to-label.csv'))
  .toString()
  .split('\n')
  .forEach((line) => {
    const [code, rawValue] = line.split(',')
    languageData[code] = rawValue && rawValue.slice(2, -1)
  })

const langLookup = (key) => { return languageData[key] }

module.exports = {
  languageData,
  langLookup
}
