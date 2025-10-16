const propertyTemplates = {
  entity: {
    type: 'object',
    properties: {
      id: { type: 'keyword' },
      label: { type: 'keyword' }
    }
  },
  // This type should be used for "packed" fields containing ids & labels
  // munged together, which will only be matched exactly:
  packed: {
    type: 'keyword',
    eager_global_ordinals: true
  },
  // This type should be used for text that we don't need analyzed for fuzzy
  // searching, but we do want to be able to filter on it using exact matching:
  exactString: {
    type: 'keyword'
  },
  // This type should be used for text not worth analyzing for fuzzy-matching
  // and we don't expect to ever use it in an exact-match query either:
  exactStringNotIndexed: {
    index: false,
    type: 'keyword'
  },
  number: {
    type: 'short'
  },
  // This type should be used for text properties that we want analyzed for
  // fuzzy searching, and we never expect to build an aggregation across it:
  fulltext: {
    type: 'text'
  },
  // Identical to above, but stores a secondary `folded` field with folding
  fulltextFolded: {
    type: 'text',
    fields: {
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      }
    }
  },
  // This type should be used for text properties that we want analyzed for
  // fuzzy matching as well as exact matching (but not exposed through
  // aggregations)
  fulltextWithRawFolded: {
    type: 'text',
    fields: {
      raw: {
        type: 'keyword'
      },
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      }
    }
  },
  // This type should be used for text properties that we want analyzed for
  // fuzzy searching, but we also want to store a raw copy for aggregations:
  // AND we anticipate accented chars we'd like folded:
  fulltextWithRawFoldedAgg: {
    type: 'text',
    fields: {
      raw: {
        type: 'keyword',
        eager_global_ordinals: true
      },
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      }
    }
  },
  foldingStemmed: {
    type: 'text',
    fields: {
      foldedStemmed: {
        type: 'text',
        analyzer: 'folding_stemming_analyzer'
      }
    }
  },
  identifier: {
    type: 'keyword',
    fields: {
      clean: {
        type: 'keyword',
        ignore_above: 256,
        normalizer: 'identifier_normalizer'
      }
    }
  },
  boolean: {
    type: 'boolean'
  }
}

const compoundTemplates = {
  identifier: {
    properties: {
      value: propertyTemplates.exactString,
      type: propertyTemplates.exactString,
      identifierStatus: propertyTemplates.exactString
      /* identifierStatus: {
        type: 'keyword',
        normalizer: 'punctuation_and_lowercase_normalizer'
      }
      */
    }
  },
  electronicResources: {
    properties: {
      label: propertyTemplates.exactString,
      url: propertyTemplates.exactString
    }
  }
}

// The following establishes the resource index mapping as it currently
// exists in dev & prod.
exports.schema = () => ({
  addedAuthorTitle: propertyTemplates.fulltextWithRawFolded,
  buildingLocationIds: {
    type: 'keyword',
    eager_global_ordinals: true
  },
  carrierType: propertyTemplates.entity,
  carrierType_packed: propertyTemplates.packed,
  collectionIds: {
    type: 'keyword',
    eager_global_ordinals: true
  },
  contentsTitle: propertyTemplates.fulltextFolded,
  contributorLiteral: {
    type: 'text',
    fields: {
      raw: {
        type: 'keyword',
        eager_global_ordinals: true
      },
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'lowercase_normalizer'
      },
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      }
    }
  },
  contributorLiteralNormalized: {
    type: 'keyword',
    fields: {
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'lowercase_normalizer'
      }
    }
  },
  contributorLiteralWithoutDates: {
    type: 'keyword',
    fields: {
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'lowercase_normalizer'
      }
    }
  },
  contributor_sort: propertyTemplates.exactString,
  created: { type: 'date', index: false },
  createdDecade: propertyTemplates.number,
  createdString: propertyTemplates.exactString,
  createdYear: propertyTemplates.number,
  creatorLiteral: {
    type: 'text',
    fields: {
      raw: {
        type: 'keyword',
        eager_global_ordinals: true
      },
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'lowercase_normalizer'
      },
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      }
    }
  },
  creatorLiteralNormalized: {
    type: 'keyword',
    fields: {
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'lowercase_normalizer'
      }
    }
  },
  creatorLiteralWithoutDates: {
    type: 'keyword',
    fields: {
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'lowercase_normalizer'
      }
    }
  },
  creator_sort: propertyTemplates.exactString,
  dates: {
    type: 'nested',
    properties: {
      range: {
        type: 'date_range'
      },
      raw: {
        type: 'keyword'
      },
      tag: {
        type: 'keyword'
      }
    }
  },
  dateStartYear: propertyTemplates.number,
  description: propertyTemplates.foldingStemmed,
  dimensions: propertyTemplates.exactString,
  donor: propertyTemplates.fulltextWithRawFolded,
  electronicResources: compoundTemplates.electronicResources,
  // TODO: there are things like extent and dimensions that dont seem like thiings we can or want to search on. should become exactStringNotIndexed
  extent: propertyTemplates.exactString,
  formatId: propertyTemplates.exactString,
  formerTitle: propertyTemplates.fulltextFolded,
  genreForm: propertyTemplates.fulltextWithRawFoldedAgg,
  holdings: {
    type: 'nested',
    properties: {
      checkInBoxes: {
        type: 'nested',
        properties: {
          copies: propertyTemplates.number,
          coverage: propertyTemplates.exactString,
          position: propertyTemplates.number,
          shelfMark: propertyTemplates.exactStringNotIndexed,
          status: propertyTemplates.exactString,
          type: propertyTemplates.exactString
        }
      },
      format: propertyTemplates.exactString,
      holdingStatement: propertyTemplates.exactString,
      identifier: compoundTemplates.identifier,
      location: {
        properties: {
          code: propertyTemplates.exactString,
          label: propertyTemplates.exactString
        }
      },
      notes: propertyTemplates.exactString,
      physicalLocation: propertyTemplates.exactStringNotIndexed,
      shelfMark: propertyTemplates.exactString,
      uri: propertyTemplates.exactString
    }
  },
  idIsbn: propertyTemplates.identifier,
  idIsbn_clean: propertyTemplates.exactString,
  idIssn: propertyTemplates.identifier,
  idLcc: propertyTemplates.exactString,
  idLccn: {
    type: 'keyword',
    normalizer: 'punctuation_and_lowercase_normalizer'
  },
  idOclc: propertyTemplates.exactString,
  identifier: propertyTemplates.exactString,
  identifierV2: compoundTemplates.identifier,
  issuance: propertyTemplates.entity,
  issuance_packed: propertyTemplates.packed,
  items: {
    // This could be 'object', but we're making it 'nested' that items are indexed
    // independently of bibs per https://www.elastic.co/guide/en/elasticsearch/reference/current/nested.html
    type: 'nested',
    properties: {
      accessMessage: propertyTemplates.entity,
      accessMessage_packed: propertyTemplates.packed,
      aeonUrl: propertyTemplates.exactString,
      catalogItemType: propertyTemplates.entity,
      catalogItemType_packed: propertyTemplates.packed,
      dateRange: {
        type: 'date_range',
        format: 'yyyy-MM-dd||yyyy-MM||yyyy'
      },
      deliveryLocation: propertyTemplates.entity,
      deliveryLocation_packed: propertyTemplates.packed,
      dueDate: {
        type: 'date'
      },
      electronicLocator: {
        properties: {
          url: propertyTemplates.exactString,
          label: { type: 'keyword', index: false }
        }
      },
      enumerationChronology: propertyTemplates.exactString,
      enumerationChronology_sort: propertyTemplates.exactString,
      formatLiteral: propertyTemplates.exactString,
      holdingLocation: propertyTemplates.entity,
      holdingLocation_packed: propertyTemplates.packed,
      identifier: propertyTemplates.exactString,
      identifierV2: {
        properties: {
          value: propertyTemplates.exactString,
          type: propertyTemplates.exactString
        }
      },
      idBarcode: propertyTemplates.exactString,
      location: propertyTemplates.entity,
      m2CustomerCode: propertyTemplates.exactString,
      owner: propertyTemplates.entity,
      owner_packed: propertyTemplates.packed,
      physicalLocation: propertyTemplates.exactString,
      recapCustomerCode: propertyTemplates.exactString,
      requestable: propertyTemplates.boolean,
      shelfMark: {
        // We're indexing this as text only so that it can be used in query_string
        // fulltext searches (if indexed keyword, can't by used fuzzily)
        type: 'text',
        fields: {
          keywordLowercased: {
            type: 'keyword',
            normalizer: 'shelfmark_normalizer'
          },
          raw: {
            type: 'keyword'
          }
        }
      },
      shelfMark_sort: propertyTemplates.exactString,
      status: propertyTemplates.entity,
      status_packed: propertyTemplates.packed,
      type: propertyTemplates.exactString,
      uri: propertyTemplates.exactString,
      volumeRange: {
        type: 'integer_range'
      },
      volumeRaw: {
        type: 'text'
      }
    }
  },
  language: propertyTemplates.entity,
  language_packed: propertyTemplates.packed,
  lccClassification: propertyTemplates.exactString,
  materialType: propertyTemplates.entity,
  materialType_packed: propertyTemplates.packed,
  mediaType: propertyTemplates.entity,
  mediaType_packed: propertyTemplates.packed,
  note: {
    properties: {
      label: propertyTemplates.foldingStemmed,
      noteType: propertyTemplates.exactString,
      // This only ever contains 'bf:Note':
      type: propertyTemplates.exactStringNotIndexed
    }
  },
  numCheckinCardItems: propertyTemplates.number,
  numElectronicResources: propertyTemplates.number,
  numItemDatesParsed: propertyTemplates.number,
  numItemVolumesParsed: propertyTemplates.number,
  numItemsTotal: propertyTemplates.number,
  nyplSource: propertyTemplates.exactString,
  parallelTitle: propertyTemplates.fulltextFolded,
  parallelTitleDisplay: propertyTemplates.fulltextFolded,
  parallelSeriesStatement: propertyTemplates.fulltextWithRawFoldedAgg,
  parallelTitleAlt: propertyTemplates.fulltextFolded,
  parallelSubjectLiteral: propertyTemplates.fulltextFolded,
  parallelUniformTitle: propertyTemplates.fulltextFolded,
  parallelCreatorLiteral: propertyTemplates.fulltextWithRawFoldedAgg,
  parallelContributorLiteral: propertyTemplates.fulltextWithRawFoldedAgg,
  parallelDisplayField: {
    properties: {
      fieldName: { type: 'keyword' },
      index: propertyTemplates.number,
      value: { type: 'text' }
    }
  },
  parallelPublisherLiteral: propertyTemplates.fulltextFolded,
  partOf: propertyTemplates.exactString,
  placeOfPublication: {
    type: 'keyword',
    fields: {
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      }
    }
  },
  popularity: propertyTemplates.number,
  publicDomain: propertyTemplates.boolean,
  publisherLiteral: propertyTemplates.fulltextWithRawFoldedAgg,
  publicationStatement: propertyTemplates.exactStringNotIndexed,
  recordTypeId: propertyTemplates.exactString,
  serialPublicationDates: propertyTemplates.exactStringNotIndexed,
  seriesStatement: propertyTemplates.fulltextWithRawFoldedAgg,
  shelfMark: {
    // We're indexing this as text only so that it can be used in query_string
    // fulltext searches (if indexed keyword, can't by used fuzzily)
    type: 'text',
    fields: {
      keywordLowercased: {
        type: 'keyword',
        normalizer: 'shelfmark_normalizer'
      },
      raw: {
        type: 'keyword'
      }
    }
  },
  subjectLiteral: propertyTemplates.fulltextWithRawFoldedAgg,
  subjectLiteral_exploded: propertyTemplates.exactString,
  supplementaryContent: {
    type: 'object',
    properties: {
      url: propertyTemplates.exactString,
      label: { type: 'keyword', index: false }
    }
  },
  suppressed: propertyTemplates.boolean,
  tableOfContents: propertyTemplates.fulltextFolded,
  title: {
    type: 'text',
    fields: {
      folded: {
        type: 'text',
        analyzer: 'folding_analyzer'
      },
      foldedStemmed: {
        type: 'text',
        analyzer: 'folding_stemming_analyzer'
      },
      keyword: {
        type: 'keyword',
        ignore_above: 256
      },
      keywordLowercased: {
        type: 'keyword',
        ignore_above: 256,
        normalizer: 'lowercase_normalizer'
      },
      keywordLowercasedStripped: {
        type: 'keyword',
        ignore_above: 256,
        normalizer: 'punctuation_and_lowercase_normalizer'
      },
      shingle: {
        type: 'text',
        analyzer: 'shingles_analyzer'
      }
    }
  },
  title_sort: propertyTemplates.exactString,
  titleAlt: propertyTemplates.fulltextWithRawFolded,
  titleDisplay: propertyTemplates.fulltextFolded,
  type: propertyTemplates.exactString,
  uniformTitle: propertyTemplates.fulltextWithRawFolded,
  updatedAt: { type: 'date' },
  uri: propertyTemplates.exactString,
  uris: propertyTemplates.exactString,

  // The following properties are not implemented as methods on any Elastic Search Models in this repo.
  // They are on the current Elastic Search index mapping, so we have to include them for now.
  dateEndDecade: propertyTemplates.number,
  dateEndString: propertyTemplates.exactString,
  dateEndYear: propertyTemplates.number,
  dateStartDecade: propertyTemplates.number,
  dateStartString: propertyTemplates.exactString,
  dateString: propertyTemplates.exactString,
  depiction: propertyTemplates.exactString,
  idLccSort: propertyTemplates.exactString,
  idOwi: propertyTemplates.exactString,
  // As of this indexer, numAvailable and numItems are deprecated
  numAvailable: propertyTemplates.number,
  numItems: propertyTemplates.number
})
