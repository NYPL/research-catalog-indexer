module.exports = {
  toDelete: [
    require('../bib-10001936-suppressed.json'),
    require('../bib-10001936-deleted.json')
  ],
  toIndex: [
    require('../bib-11655934.json'),
    require('../bib-14576049.json'),
    require('../bib-10554618.json')
  ],
  mgetResponses:
  {
    b10001936: {
      _index: 'resources-2024-10-22',
      _id: 'b10001936',
      _version: 405,
      _seq_no: 55971152,
      _primary_term: 6,
      found: true,
      _source: {
        subjectLiteral: [
          'stale',
          'subject'
        ]
      }
    },
    b14576049: {
      _index: 'resources-2024-10-22',
      _id: 'b14576049',
      _version: 405,
      _seq_no: 55971152,
      _primary_term: 6,
      found: true,
      _source: {
        subjectLiteral: [
          'an',
          'old',
          'subject'
        ]
      }
    },
    b1: {
      _index: 'resources-2024-10-22',
      _id: 'b1',
      found: false
    },
    b2: {
      _index: 'resources-2024-10-22',
      _id: 'b2',
      _version: 405,
      _seq_no: 55971152,
      _primary_term: 6,
      found: true,
      _source: {
        subjectLiteral: [
          'spaghetti',
          'meatballs'
        ]
      }
    },
    b3: {
      _index: 'resources-2024-10-22',
      _id: 'b3',
      _version: 405,
      _seq_no: 55971152,
      _primary_term: 6,
      found: true,
      _source: {
        subjectLiteral: [
          'Literature -- Collections -- Periodicals.',
          'Intellectual life.',
          'Literature.',
          'Electronic journals.',
          'New York (N.Y.) -- Intellectual life -- Directories.',
          'New York (State) -- New York.'
        ]
      }
    },
    b4: {
      _index: 'resources-2024-10-22',
      _id: 'b4',
      found: false
    }
  }
}
