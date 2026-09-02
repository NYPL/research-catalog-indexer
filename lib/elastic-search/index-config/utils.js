exports.mergeSettings = (specificSettings, allSettings) => {
  Object.assign(allSettings.analysis.char_filter, {
    ...allSettings.analysis.char_filter,
    ...specificSettings.analysis.char_filter
  })
  Object.assign(allSettings.analysis.normalizer, {
    ...allSettings.analysis.normalizer,
    ...specificSettings.analysis.normalizer
  })
}
