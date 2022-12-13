const EsBase = require('./base')
const { primaryValues, parallelValues } = require('../utils/utils')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { BibMappings } = require('../mappings/mappings')

class EsBib extends EsBase {
  constructor (sierraBib) {
    super(sierraBib)
    this.bib = sierraBib
    this.nyplSourceMapper = new NyplSourceMapper()
  }

  async uri () {
    const prefix = await this.nyplSourceMapper.prefix(this.nyplSource())
    return `${prefix}${this.bib.id}`
  }

  title () {
    const mappings = BibMappings.get('title', this.bib)
    return primaryValues(mappings, this.bib)
  }

  parallelTitle () {
    const mappings = BibMappings.get('title', this.bib)
    return parallelValues(mappings, this.bib)
  }

  creatorLiteral () {
    const mappings = BibMappings.get('creatorLiteral', this.bib)
    return primaryValues(mappings, this.bib)
  }

  parallelCreatorLiteral () {
    const mappings = BibMappings.get('creatorLiteral', this.bib)
    return parallelValues(mappings, this.bib)
  }

  contentsTitle () {
    const mappings = BibMappings.get('contentsTitle', this.bib)
    return primaryValues(mappings, this.bib)
  }

  contributor_sort () {
    // first 80 chars of first contributor
    const contributor = this.contributorLiteral()[0]
    if (!contributor) return null
    return contributor.substring(0, 80).toLowerCase()
  }

  contributorLiteral () {
    const mappings = BibMappings.get('contributorLiteral', this.bib)
    return primaryValues(mappings, this.bib)
  }

  parallelContributorLiteral () {
    const mappings = BibMappings.get('contributorLiteral', this.bib)
    return parallelValues(mappings, this.bib)
  }

  numItems () {
    return 0 // TODO
  }

  type () {
    return 'nypl:Item'
  }

  nyplSource () {
    return this.bib.nyplSource
  }
}

module.exports = EsBib
