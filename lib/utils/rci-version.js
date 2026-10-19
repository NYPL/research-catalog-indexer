const { version } = require('../../package.json')

/**
 *  Get the current RCI version from package.json (ex. "1.0.0").
 */
const rciVersion = () => version

module.exports = { rciVersion }
