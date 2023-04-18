const EsBase = require('./base')
const { primaryValues, parallelValues } = require('../utils/primary-and-parallel-values')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { BibMappings } = require('../mappings/mappings')
const { pack } = require('../utils/packed-transform')
const { titleSortTransform } = require('../utils/title-sort-transform')
const { langLookup } = require('../utils/lang-lookup')
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

  datesOfSerialPublication () {
    return this._valueToIndexFromBasicMapping('datesOfSerialPublication')
  }

  description () {
    return this._valueToIndexFromBasicMapping('description')
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
    return ['idIsbn', 'idIssn', 'idLccn', 'idOclc']
  }

  identifier () {
    return this._identifiersArray()
      .map((idFunc) => this[idFunc](), this)
      .flat()
  }

  identifierV2 () {
    // excuse me what is the difference btw identifier and identifier v2??
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
    const id = this._valueToIndexFromBasicMapping('oclcNumber').filter((oclcNum) => oclcNum.includes('(OCoLC)'))[0].replace(/^\(OCoLC\)/, '')
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

  _buildNotesArray () {
    // noteType is description, type is bf:note, label is the value
    // get marctags
    // const values = this._valueToIndexFromBasicMapping('note', primary)
    const marcTags = BibMappings.get('note', this.bib)
    return marcTags.map((path) => {
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
      return varFields
        .map((varFieldMatchObject) => ({ varFieldMatchObject, description: path.description }))
      // remove everything that isnt a parallel and primaries
    }).filter((content) => {
      return content.length
    })
  }

  note () {
    const notesArray = this._buildNotesArray()
    // loop over the content so a separate object is generated for each one.
    return notesArray
      .map((varFieldsPerMarcTag) => {
        return varFieldsPerMarcTag
          .filter((vfPerMt) => vfPerMt.varFieldMatchObject.value)
          .map(({ varFieldMatchObject, description }) =>
          // the array has primary and parallel varFieldMatch objects. An orphan
          //    parallel value will not have a value property, rather a parallel.value
            ({
              label: varFieldMatchObject.value,
              type: 'bf:note',
              noteType: description
            })
          )
      }).flat()
  }

  _parallelNote () {
    const notesArray = this._buildNotesArray()
    return notesArray
      .map((varFieldsPerMarcTag, index) => {
        const parallelFieldsPerMarcTag = varFieldsPerMarcTag
          .filter((vfPerMt) => vfPerMt.varFieldMatchObject.parallel)
        return parallelFieldsPerMarcTag
          .map(({ varFieldMatchObject }) => {
            return {
              label: parallelValues([varFieldMatchObject])[0],
              index,
              fieldName: 'note'
            }
          })
      }).flat()
  }

  parallelContributorLiteral () {
    return this._valueToIndexFromBasicMapping('contributorLiteral', false)
  }

  parallelDisplayField () {
    const parallelNote = this._parallelNote()
    // These fields don't have dedicated parallel properties in the ES Index:
    const allOtherParallels = ['publicationStatement', 'placeOfPublication', 'editionStatement', 'tableOfContents', 'description']
      // For each, look up the parallel marc mappings:
      .map((fieldName) => {
        // this is an array of strings containing the various parallel values
        const parallelValuesPerFieldName = fieldName === 'note' ? this.note(false) : this._valueToIndexFromBasicMapping(fieldName, false)
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
    return [...allOtherParallels, ...parallelNote]
  }

  partOf () {
    return this._valueToIndexFromBasicMapping('partOf')
  }

  placeOfPublication () {
    return this._valueToIndexFromBasicMapping('placeOfPublication')
  }

  publicationStatement () {
    return this._valueToIndexFromBasicMapping('publicationStatement')
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

  shelfMark () {
    const callNumber = getBibCallNum(this.bib)
    if (callNumber && callNumber.value) {
      // this fieldtag function will actually not add a fieldtagv the logic
      //    returns nothing if there is a marc tag
      const fieldTagV = this.bib.fieldTag('v')
      console.log(fieldTagV, callNumber.value)
      if (fieldTagV) return [callNumber.value + fieldTagV]
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
