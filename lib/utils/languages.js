const { lookup } = require('./lookup')

const translateDeprecatedLanguageCode = (code) => {
  const deprecatedCodeMap = lookup('lookup-deprecated-language-code-to-preferred-code')

  return deprecatedCodeMap[code] || code
}

module.exports = { translateDeprecatedLanguageCode }
