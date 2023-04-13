const EsBase = require('./base')
const { primaryValues, parallelValues } = require('../utils/primary-and-parallel-values')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { BibMappings } = require('../mappings/mappings')
const { pack } = require('../utils/packed-transform')
const { titleSortTransform } = require('../utils/title-sort-transform')
const { langLookup } = require('../utils/lang-lookup')

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

  contentsTitle () {
    return this._valueToIndexFromBasicMapping('contentsTitle')
  }

  creatorLiteral () {
    return this._valueToIndexFromBasicMapping('creatorLiteral')
  }

  creator_sort () {
    return this._sortify('creatorLiteral')
  }

  parallelCreatorLiteral () {
    return this._valueToIndexFromBasicMapping('creatorLiteral', false)
  }

  carrierType () {
    // https://github.com/NYPL-discovery/discovery-store-poster/blob/38e5cd559a12e8bcc6ef0f7e2643806a48a00d26/lib/models/bib-sierra-record.js#L21
    const mappings = BibMappings.get('carrierType', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  carrierType_packed () {
    return pack(this.carrierType())
  }

  contributor_sort () {
    return this._sortify('contributorLiteral')
  }

  // _this parameter exists for testing
  _sortify (func, _this = this) {
    let literal = _this[func]()
    if (!literal) return null
    literal = Array.isArray(literal) ? literal[0] : literal
    return literal.substring(0, 80).toLowerCase()
  }

  _valueToIndexFromBasicMapping (field, primary = true) {
    const mappings = BibMappings.get(field, this.bib)
    const fields = this.bib.varFieldsMulti(mappings)
    return primary ? primaryValues(fields) : parallelValues(fields)
  }

  contributorLiteral () {
    return this._valueToIndexFromBasicMapping('contributorLiteral')
  }

  dateOfSerialPublication () {
    return this._valueToIndexFromBasicMapping('dateOfSerialPublication')
  }

  description () {
    return this.description()
  }

  dimensions () {
    return this._valueToIndexFromBasicMapping('dimensions')
  }

  donor () {
    return this._valueToIndexFromBasicMapping('donorSponsor')
  }

  extent () {
    return this._valueToIndexFromBasicMapping('extent')
  }

  formerTitle () {
    return this._valueToIndexFromBasicMapping('formerTitle')
  }

  genreForm () {
    return this._valueToIndexFromBasicMapping('genreFormLiteral')
  }

  idIsbn () {
    const id = this._valueToIndexFromBasicMapping('isbn')[0].replace(/:$/, '')
    return [{ id, type: 'bf:isbn' }]
  }

  idIsbn_clean () {
    // this regex removes any characters that are not a digit or x
    const clean = this.idIsbn()[0].id.replace(/[^0-9xX]/g, '')
    return [clean]
  }

  idIssn () {
    const id = this._valueToIndexFromBasicMapping('issn')[0]
    return [{ id, type: 'bf:issn' }]
  }

  idLccn () {
    const id = this._valueToIndexFromBasicMapping('lccn')[0]
    return [{ id, type: 'bf:lccn' }]
  }

  idOclc () {
    const id = this._valueToIndexFromBasicMapping('oclcNumber').filter((oclcNum) => oclcNum.includes('(OCoLC)'))[0]
    return [{ id, type: 'bf:oclc' }]
  }

  issuance () {
    return this._valueToIndexFromBasicMapping('issuance')
  }

  issuance_packed () {
    const { value, label } = this.issuance()
    return pack(value, label)
  }

  lccClassification () {
    return this._valueToIndexFromBasicMapping('lccClassification')
  }

  parallelContributorLiteral () {
    return this._valueToIndexFromBasicMapping('contributorLiteral', false)
  }

  // parallelDisplayField () {
  //   // These fields don't have dedicated parallel properties in the ES Index:
  //   return ['publicationStatement', 'placeOfPublication', 'editionStatement', 'note', 'tableOfContents', 'description']
  //     // For each, look up the parallel marc mappings:
  //     .map((fieldName) => ({ fieldName, values: this._valueToIndexFromBasicMapping(fieldName, false) }))
  //     .map((fieldMapping, index) => {
  //       const { fieldName, values } = fieldMapping
  //       // Build final indexable object with all necessary context:
  //       // index is necessary for when number of parallel and primary values are not the same.
  //       return values.map((value) => {
  //         return {
  //           fieldName,
  //           index,
  //           value
  //         }
  //       })
  //     })
  //     .flat()
  // }

  partOf () {
    return this._valueToIndexFromBasicMapping('partOf')
  }

  placeOfPublication () {
    return this._valueToIndexFromBasicMapping('placeOfPublication')
  }

  publisherLiteral () {
    return this._valueToIndexFromBasicMapping('publisherLiteral')
  }

  seriesStatement () {
    return this._valueToIndexFromBasicMapping('seriesStatement')
  }

  subjectLiteral () {
    return this._valueToIndexFromBasicMapping('subjectLiteral')
  }

  tableOfContents () {
    return this._valueToIndexFromBasicMapping('tableOfContents')
  }

  title () {
    return this._valueToIndexFromBasicMapping('title')
  }

  title_sort () {
    return this.title().map(titleSortTransform)
  }

  titleAlt () {
    return this._valueToIndexFromBasicMapping('titleAlt')
  }

  titleDisplay () {
    return this._valueToIndexFromBasicMapping('titleDisplay')
  }

  // shelfMark () {
  //   const callNumber = this.bib.varField('852', ['h'])
  //   if (callNumber) {
  //     const fieldTagV = this.bib.fieldTag('v')
  //   }
  // }

  parallelTitle () {
    const mappings = BibMappings.get('title', this.bib)
    return parallelValues(this.bib.varFieldsMulti(mappings))
  }

  type () {
    // Despite the confusing name, we do in fact want 'Item' here, which has nothing to do
    // with the Sierra Model type
    return 'nypl:Item'
  }

  nyplSource () {
    return this.bib.nyplSource
  }

  uniformTitle () {
    return this._valueToIndexFromBasicMapping('uniformTitle')
  }

  updatedAt () {
    return Date.now()
  }

  _languageCodes () {
    const code = this.bib.varFieldSegment('008', [35, 37])
    if (code) return [code]

    return this.bib.varFields('041', ['a'])
      .map((match) => match.value.split(' '))
      .reduce((acc, el) => acc.concat(el))
  }

  language () {
    return this._languageCodes()
      // Add lang label from lookup
      .map((code) => {
        return {
          id: `lang:${code}`,
          label: langLookup(code)
        }
      })
  }
}

module.exports = EsBib
