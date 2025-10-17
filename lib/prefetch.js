const platformApi = require('./platform-api/requests')

// Defer model-prefetch to the PlatformAPI:
// Note that we have to define it as an arrow function so that
// platformApi.modelPrefetch is evaluated at call time to ensure we can spy on
// it in tests
module.exports.modelPrefetch = (bibs) => platformApi.modelPrefetch(bibs)
