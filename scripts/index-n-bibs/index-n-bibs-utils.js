module.exports = {
  query: (term) => ({
    query_string:
    {
      fields:
        ['title^5',
          'title.folded^2',
          'description.folded',
          'subjectLiteral^2',
          'subjectLiteral.folded',
          'creatorLiteral^2',
          'creatorLiteral.folded',
          'contributorLiteral.folded',
          'note.label.folded',
          'publisherLiteral.folded',
          'seriesStatement.folded',
          'titleAlt.folded',
          'titleDisplay.folded',
          'contentsTitle.folded',
          'donor.folded',
          'parallelTitle.folded^5',
          'parallelTitleDisplay.folded',
          'parallelTitleAlt.folded',
          'parallelSeriesStatement.folded',
          'parallelCreatorLiteral.folded',
          'parallelPublisher'],
      query: term,
      default_operator: 'AND'
    }
  }),
  searchTerms: [
    'new york times',
    'reichenthal joachim',
    'consumer reports',
    'wall street journal',
    'vogue',
    'tapas',
    'design',
    'genealogy',
    'renato sollima',
    'new york post',
    'el silencio y sus filos héctor peña',
    'washington post',
    'harry potter',
    'charles jarvis',
    'victor moore',
    'oxford english dictionary',
    'newspapers',
    'new yorker',
    'new york daily news',
    'village voice',
    'toast',
    'poemas de tierra y flores héctor peña',
    'the relative strength of common stock price forecasting',
    'peril',
    'nature',
    'names, personal -- dictionaries.',
    'new york herald tribune',
    'new york herald',
    'life magazine',
    'reference solutions',
    'newsday',
    'new york',
    'el apasionado peregrinaje héctor peña',
    'art news',
    'architectural record',
    'variety',
    'the last thing he told me',
    'nomadland',
    'james baldwin',
    'chicago defender',
    'berg hall dictionary',
    "women's wear daily",
    'value line',
    'sc rare',
    'new york world',
    'klara and the sun',
    'fortune',
    'valueline',
    'the cellist',
    'psychology',
    'financial times',
    'science',
    'new york sun',
    'el silencio y sus filos',
    'economist',
    'daily news',
    'cosmopolitan',
    'business week',
    'the new yorker',
    'the economist',
    'newsweek',
    'new york magazine',
    'moriches',
    'life',
    'time magazine',
    'time',
    'ships -- ireland -- passenger lists',
    'james patterson',
    'harvard business review',
    'arts magazine',
    'art in america',
    'amsterdam news',
    'american israelite',
    'the times'
  ]
}
