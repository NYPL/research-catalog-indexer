const EsBase = require('./base')
const { primaryValues, parallelValues } = require('../utils/primary-and-parallel-values')
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
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  parallelTitle () {
    const mappings = BibMappings.get('title', this.bib)
    return parallelValues(this.bib.varFieldsMulti(mappings))
  }

  creatorLiteral () {
    const mappings = BibMappings.get('creatorLiteral', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  parallelCreatorLiteral () {
    const mappings = BibMappings.get('creatorLiteral', this.bib)
    return parallelValues(this.bib.varFieldsMulti(mappings))
  }

  contentsTitle () {
    const mappings = BibMappings.get('contentsTitle', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  contributor_sort () {
    // first 80 chars of first contributor
    const contributor = this.contributorLiteral()[0]
    if (!contributor) return null
    return contributor.substring(0, 80).toLowerCase()
  }

  contributorLiteral () {
    const mappings = BibMappings.get('contributorLiteral', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  parallelContributorLiteral () {
    const mappings = BibMappings.get('contributorLiteral', this.bib)
    return parallelValues(this.bib.varFieldsMulti(mappings))
  }

  numItems () {
    return 0 // TODO
  }

  type () {
    // Despite the confusing name, we do in fact want 'Item' here, which has nothing to do
    // with the Sierra Model type
    return 'nypl:Item'
  }

  nyplSource () {
    return this.bib.nyplSource
  }

  updatedAt () {
    return new Date()
  }
}

module.exports = EsBib
