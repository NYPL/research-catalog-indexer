class SkipPrefetchError extends Error {
  constructor (recordType) {
    super()
    this.message = `Attempting to access unfetched ${recordType}s`
  }
}

module.exports = {
  SkipPrefetchError
}