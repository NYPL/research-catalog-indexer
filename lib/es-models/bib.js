const EsBase = require('./base')
const { primaryValues, parallelValues } = require('../utils/primary-and-parallel-values')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { BibMappings } = require('../mappings/mappings')
const { pack } = require('../utils/packed-transform')
const { titleSortTransform } = require('../utils/title-sort-transform')
const { getBibCallNum } = require('../utils/get-bib-call-num')

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

  creatorLiteral () {
    const mappings = BibMappings.get('creatorLiteral', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  creator_sort () {
    return this._sortify('creatorLiteral')
  }

  parallelCreatorLiteral () {
    const mappings = BibMappings.get('creatorLiteral', this.bib)
    return parallelValues(this.bib.varFieldsMulti(mappings))
  }

  carrierType () {
    // https://github.com/NYPL-discovery/discovery-store-poster/blob/38e5cd559a12e8bcc6ef0f7e2643806a48a00d26/lib/models/bib-sierra-record.js#L21
    const mappings = BibMappings.get('carrierType', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  carrierType_packed () {
    return pack(this.carrierType())
  }

  contentsTitle () {
    const mappings = BibMappings.get('contentsTitle', this.bib)
    return primaryValues(this.bib.varFieldsMulti(mappings))
  }

  contributor_sort () {
    return this._sortify('contributorLiteral')
  }

  dateStartYear () {
    return this._dateCreated()
  }

  created () {
    return this._dateCreated()
  }

  _dateCreated () {
    if (this.bib.publishYear) return this.bib.publishYear
    const dateBy008 = parseInt(this.bib.varFieldSegment('008', [7, 10]))
    if (dateBy008) return dateBy008
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

  _identifiersArray () {
    return ['idIsbn', 'idIsbn_clean', 'idIssn', 'idLccn', 'idOclc']
  }

  identifier () {
    return this._identifiersArray()
      .map((idFunc) => this[idFunc](), this)
      .flat()
  }

  identifierV2 () {
    return this._identifiersArray()
      .map((idFunc) => ({ name: this[idFunc].name, value: this[idFunc]()[0] }), this)
      .filter((id) => id.value)
  }

  idIsbn () {
    const isbn = this._valueToIndexFromBasicMapping('isbn')
      .map((isbn) => isbn.replace(/:$/, ''))
    return isbn
  }

  idIsbn_clean () {
    // this regex removes any characters that are not a digit or x
    const clean = this.idIsbn()[0].replace(/[^0-9xX]/g, '')
    return [clean]
  }

  idIssn () {
    return this._valueToIndexFromBasicMapping('issn')
  }

  idLccn () {
    return this._valueToIndexFromBasicMapping('lccn')
  }

  idOclc () {
    return this._valueToIndexFromBasicMapping('oclcNumber').filter((oclcNum) => oclcNum.includes('(OCoLC)'))
  }

  issuance () {
    return this._valueToIndexFromBasicMapping('issuance')
  }

  issuance_packed () {
    const { value, label } = this.issuance()
    return pack(value, label)
  }

  note (primary = true) {
    // noteType is description, type is bf:note, label is the value
    // get marctags
    // const values = this._valueToIndexFromBasicMapping('note', primary)
    const marcTags = BibMappings.get('note', this.bib)
    const fullNotes = marcTags.map((path) => {
      // example path:
      // {
      //   "marc": "501",
      //   "subfields": [
      //     "a"
      //   ],
      //   "description": "With"
      // }
      // contentPerMarcTag is an array of objects containing the content and subfieldMap
      //    for the marc field and subfields supplied by the path.
      const varFields = this.bib.varField(path.marc, path.subfields)
      const contentPerMarcTag = varFields
        .filter((content) => {
          // we want to hold on to the parallels and primaries to keep track
          // of the indices
          return content.value || content.parallel
        })
        // remove everything that isnt a parallel and primaries
        .filter((content) => {
          return content
        })
      // loop over the content so a separate object is generated for each one.
      const parsedContentForMarctag = contentPerMarcTag
        .map((content) =>
          ({
            label: content,
            type: 'bf:note',
            noteType: path.description
          }))
      return parsedContentForMarctag
    }).filter((content) => content.length)
      .flat()
    return fullNotes
  }

  parallelContributorLiteral () {
    return this._valueToIndexFromBasicMapping('contributorLiteral', false)
  }

  parallelDisplayField () {
    // These fields don't have dedicated parallel properties in the ES Index:
    return ['publicationStatement', 'placeOfPublication', 'editionStatement', 'note', 'tableOfContents', 'description']
      // For each, look up the parallel marc mappings:
      .map((fieldName) => {
        // this is an array of strings containing the various parallel values
        const parallelValuesPerFieldName = fieldName === 'note' ? this[note](false) : this._valueToIndexFromBasicMapping(fieldName, false)
        return { fieldName, parallelValuesPerFieldName }
      }, this)

      // array of parallel value objects
      .map((fieldNameAndValue) => {
        const { fieldName, parallelValuesPerFieldName } = fieldNameAndValue
        // Build final indexable object with all necessary context:
        // index is necessary for when number of parallel and primary parallelValuesPerFieldName are not the same.
        return parallelValuesPerFieldName.map((value, index) => {
          return {
            fieldName,
            index,
            value
          }
        })
      })
      .flat()
  }

  partOf () {
    return this._valueToIndexFromBasicMapping('partOf')
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
    return this._valueToIndexFromBasicMapping('alternativeTitle')
  }

  shelfMark () {
    const callNumber = getBibCallNum(this.bib)
    if (callNumber) {
      const fieldTagV = this.bib.fieldTag('v')
      if (fieldTagV) return callNumber + fieldTagV
    }
  }

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

  updatedAt () {
    return Date.now()
  }
}

module.exports = EsBib
