const EsBase = require('./base')
const { primaryValues, parallelValues } = require('../utils/primary-and-parallel-values')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { BibMappings } = require('../mappings/mappings')
const { pack } = require('../utils/packed-transform')
const { titleSortTransform } = require('../utils/title-sort-transform')
const { lookup } = require('../utils/lookup')

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

  identifier () {

  }

  idIsbn () {
    return this._valueToIndexFromBasicMapping('isbn')[0]
  }

  idIsbn_clean () {
    return this.idIsbn().replace(/[^0-9xX]/g, '')
  }

  idIssn () {
    return this._valueToIndexFromBasicMapping('issn')
  }

  idLccn () {
    return this._valueToIndexFromBasicMapping('lccn')
  }

  idOclc () {
    return this._valueToIndexFromBasicMapping('oclcNumber')
  }

  issuance () {
    return this._valueToIndexFromBasicMapping('issuance')
  }

  issuance_packed () {
    const { value, label } = this.issuance()
    return pack(value, label)
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
    return this._valueToIndexFromBasicMapping('Part of')
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
          label: lookup('language-code-to-label', code)
        }
      })
  }

  mediaType () {
    // construct a suitable return object for the given fallback mediatype:
    const useDefault = function (id, path) {
      path = path || 'fixed "Material Type"'
      return lookup('lc-mediatypes', id)
        .then((label) => {
          return [{
            object: { id: `mediatypes:${id}`, label },
            path
          }]
        })
    }
    // Returns a function that evaluates `val` and returns an object based on `id` if `val` is falsy
    const fallback = function (id) {
      return (val) => {
        if (val && val.length) return val
        else return useDefault(id)
      }
    }

    // Because they don't record Material Type in the same way,
    // for CUL/PUL, just pull 337 / 007, falling back on 'n'
    if (this.bib.isPartnerRecord()) return this.mediaTypeByVarField().then(fallback('n'))

    // Based on Material Type pull media type from var fields or use default:
    switch (this.materialTypeCode()) {
      case '-': // MISC
      case '7': // TEACHER AUDIO
      case '8': // TEACHER SET
        return this.mediaTypeByVarField(['337']).then(fallback('z'))
      case '3': // E-VIDEO:
        return useDefault('c')
      case 'b': // BLU-RAY
      case 'v': // DVD
        return useDefault('v')
      case 'g': // FILM, SLIDE, ETC
        return this.mediaTypeByVarField(['007'])
      case 'h': // MICROFORM:
        return useDefault('h')
      case 'i': // SPOKEN WORD
      case 'j': // MUSIC NON-CD:
        return useDefault('s')
      case 'm': // COMPUTER FILE!
      case 'n': // E-AUDIOBOOK
      case 'z': // E-BOOK
      case 'w': // WEB RESOURCE
        return useDefault('c')
      case 's': // VHS
        return useDefault('v')
      case 't': // MANUSCRIPT
        return this.mediaTypeByVarField(['337']).then(fallback('nc'))
      case 'u': // AUDIOBOOK
      case 'y': // MUSIC CD
        return useDefault('s')
      // c (SCORE), d (MANUSCRIPT MUS), l (LARGE PRINT), o (KIT), p (ARCHIVAL MIX),
      // k (PICTURE), o (KIT), p (ACHIVAL MIX), r (3-D OBJECT), x (GAME), e (MAP),
      // a (BOOK/TEXT)
      default:
        return useDefault('n')
    }
  }

  mediaTypeByVarField (useStrategies) {
    useStrategies = useStrategies || ['337', '007']

    // Register a series of strategies for pulling media type:
    const strategies = {
      '007': () => {
        const seg = this.bib.varFieldSegment('007', [0, 0])
        if (!seg) return Promise.resolve(null)

        return lookup('lc-mediatypes', seg)
          .then((label) => {
            return [{
              object: { id: `mediatypes:${seg}`, label },
              path: '007/00'
            }]
          })
      },
      337: () => {
        return new Promise((resolve, reject) => {
          const vals = this.varField('337', ['b', 'a'], { tagSubfields: true })
          if (vals) {
            return resolve(vals.map((val, ind) => {
              return {
                object: { id: `mediatypes:${val.b}`, label: val.a },
                path: '337 $b $a'
              }
            }))
          } else resolve(null)
        })
      }
    }

    // Collect strats to run:
    const stratToRun = useStrategies.map((name) => strategies[name]())
    // Iterate over them in sequence, returning first that's resolves something truthy
    return Promise.reduce(stratToRun, (previousVal, next) => {
      return previousVal || next
    }, null)
  }
}

module.exports = EsBib
