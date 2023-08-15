const EsBase = require('./base')
const EsItem = require('./item')
const EsHolding = require('./holding')
const EsCheckinCardItem = require('./checkin-card-item')
const { parallelValue } = require('../utils/primary-and-parallel-values')
const NyplSourceMapper = require('../utils/nypl-source-mapper')
const { BibMappings } = require('../mappings/mappings')
const { pack } = require('../utils/packed-transform')
const { titleSortTransform } = require('../utils/title-sort-transform')
const { lookup } = require('../utils/lookup')
const { getBibCallNum } = require('../utils/get-bib-call-num')
const { unique, removeTrailingElementsMatching } = require('../utils')
const { subjectLiteralFromSubfieldMap } = require('../utils/subject-formatter')

class EsBib extends EsBase {
  constructor (sierraBib) {
    super(sierraBib)
    this.bib = sierraBib
  }

  carrierType () {
    // construct a suitable return object for the given fallback carriertype:
    const useDefault = function (id) {
      const label = lookup('lc-carriertypes')[id]
      return [{ id: `carriertypes:${id}`, label }]
    }

    // Because they don't record Material Type in the same way,
    // for CUL/PUL, just pull 338 / 007, falling back on 'nc'
    if (this.bib.isPartnerRecord()) {
      return this._carrierTypeByVarField() || useDefault('nc')
    }

    // Based on Material Type pull carrier type from var fields or use default:
    switch (this.bib.fixed('Material Type')) {
      case '-': // MISC
      case '7': // TEACHER AUDIO
      case '8': // TEACHER SET
        return this._carrierTypeByVarField(['338']) || useDefault('zu')
      case '3': // E-VIDEO:
        return useDefault('cr')
      case 'a': // BOOK/TEXT:
        return this._carrierTypeByVarField() || useDefault('nc')
      case 'b': // BLU-RAY
      case 'v': // DVD
        return useDefault('vd')
      case 'e': // MAP
        return this._carrierTypeByVarField(['338']) || useDefault('nc')
      case 'g': // FILM, SLIDE, ETC
        return this._carrierTypeByVarField(['007'])
      case 'h': // MICROFORM:
        return this._carrierTypeByVarField(['007']) || useDefault('hz')
      case 'i': // SPOKEN WORD
      case 'j': // MUSIC NON-CD:
        return this._carrierTypeByVarField(['007']) || useDefault('sz')
      case 'k': // PICTURE:
        return useDefault('nb')
      case 'm': // COMPUTER FILE!
        switch (this.bib.varFieldSegment('007', [1, 1])) {
          case 'o': return useDefault('cd')
          case 'r': return useDefault('cr')
          default: return useDefault('cu')
        }
      case 'o': // KIT
      case 'p': // ARCHIVAL MIX
        return useDefault('nc')
      case 'z': // E-BOOK
      case 'w': // WEB RESOURCE
      case 'n': // E-AUDIOBOOK
        return useDefault('cr')
      case 'r': // 3-D OBJECT
      case 'x': // GAME
        return useDefault('nr')
      case 's': // VHS
        return useDefault('vf')
      case 't': // MANUSCRIPT
        return this._carrierTypeByVarField(['338']) || useDefault('nc')
      case 'u': // AUDIOBOOK
      case 'y': // MUSIC CD
        return useDefault('sd')
      // c (SCORE), d (MANUSCRIPT MUS), l (LARGE PRINT), o (KIT), p (ARCHIVAL MIX)
      default:
        return useDefault('nc')
    }
  }

  carrierType_packed () {
    return pack(this.carrierType())
  }

  contentsTitle () {
    return this._valueToIndexFromBasicMapping('contentsTitle')
  }

  contributorLiteral () {
    return this._valueToIndexFromBasicMapping('contributorLiteral')
  }

  contributor_sort () {
    return this._sortify('contributorLiteral')
  }

  createdString () {
    if (this._dateCreatedString()) return [this._dateCreatedString()]
  }

  createdYear () {
    if (this._dateCreatedString()) return [parseInt(this._dateCreatedString())]
  }

  creatorLiteral () {
    return this._valueToIndexFromBasicMapping('creatorLiteral')
  }

  creator_sort () {
    return this._sortify('creatorLiteral')
  }

  dateEndString () {
    const year = this.bib.varFieldSegment('008', [11, 14])?.trim()
    return year ? [year] : null
  }

  dateEndYear () {
    // TODO: Handle '9999', etc
    const dateString = this.dateEndString()
    return dateString
      ? dateString.map((date) => parseInt(date))
      : null
  }

  dateStartYear () {
    if (this._dateCreatedString()) return [parseInt(this._dateCreatedString())]
  }

  dateString () {
    if (this._dateCreatedString()) return [this._dateCreatedString()]
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

  // Returns array of hashes with { url, label }, containing electronic resources that are complete digital records
  electronicResources () {
    let resources = this._extractElectronicResourcesFromBibMarc('complete digital record') || []

    // Strip Aeon URLs:
    resources = resources.filter((resource) => !this._isAeonUrl(resource.url))

    return resources.length ? resources : null
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

  holdings () {
    const holdings = this.bib.holdings()
      .map((h) => new EsHolding(h))
    return holdings.length ? holdings : null
  }

  identifier () {
    // Convert identifier entities into urn-style strings:
    const urnPrefixMap = {
      'bf:Barcode': 'barcode',
      'nypl:Bnumber': 'bnum',
      'bf:Isbn': 'isbn',
      'nypl:Issn': 'issn',
      'nypl:Lccn': 'lccn',
      'nypl:Oclc': 'oclc',
      'bf:ShelfMark': 'shelfmark'
    }
    return this._identifiers()
      .map((identifier) => {
        const prefix = urnPrefixMap[identifier.type] || 'identifier'
        const value = identifier.value
        return `urn:${prefix}:${value}`
      })
  }

  identifierV2 () {
    return this._identifiers()
  }

  idIsbn () {
    const isbns = this._valueToIndexFromBasicMapping('isbn')
    return isbns ? isbns.map((value) => value.replace(/:$/, '')) : null
  }

  idIsbn_clean () {
    const isbns = this.idIsbn()
    if (!isbns) return null
    return isbns.map((value) => {
      // this regex removes any characters that are not a digit or x
      return value.replace(/[^0-9xX]/g, '')
    })
  }

  idIssn () {
    return this._valueToIndexFromBasicMapping('issn')
  }

  idLccn () {
    const lccns = this._valueToIndexFromBasicMapping('lccn')
    return lccns ? lccns.map((v) => v.trim()) : null
  }

  idOclc () {
    let oclcs = []

      ;[
      { marc: '991', subfield: 'y' },
      { marc: '035', subfield: 'a' },
      { marc: '001' }
    ].forEach((mapping) => {
      let matches = this.bib.varField(mapping.marc, [mapping.subfield])

      // Special handling for 035 values:
      if (mapping.marc === '035') {
        const oclcPrefix = /^\(OCoLC\)/
        matches = matches
        // Only consider 035 identifiers prefixed (OCoLC):
          .filter((match) => {
            return oclcPrefix.test(match.value)
          })
        // Strip (OCoLC) prefix:
          .map((match) => {
            match.value = match.value.replace(oclcPrefix, '')
            return match
          })
      }

      const newOclcs = matches.map((match) => match.value.trim())
      oclcs = oclcs.concat(newOclcs)
    })

    oclcs = unique(oclcs)
    return oclcs.length ? oclcs : null
  }

  issuance () {
    const ldr = this.bib.ldr()
    if (ldr?.bibLevel?.trim()) {
      const bibLevel = ldr.bibLevel.trim()
      const label = lookup('lookup-bib-levels')[bibLevel]
      return [{ id: 'urn:biblevel:' + bibLevel, label }]
    }
  }

  issuance_packed () {
    return pack(this.issuance())
  }

  items () {
    return this.bib.items()
      .map(item => new EsItem(item, this))
      .concat(
        this.bib.holdings()
          .map((h) => EsCheckinCardItem.fromSierraHolding(h, this))
          .reduce((acc, el) => acc.concat(el), [])
      )
  }

  language () {
    const languageEntities = this._languageCodes()
      // Add lang label from lookup
      .map((code) => {
        const label = lookup('lookup-language-code-to-label')[code] || ''
        return {
          id: `lang:${code}`,
          label
        }
      })
    return languageEntities.length ? languageEntities : null
  }

  language_packed () {
    return pack(this.language())
  }

  lccClassification () {
    return this._valueToIndexFromBasicMapping('lccClassification')
  }

  // ironically, this method has nothing to do with the fixed field with label 'material type'. Its original mapping
  // in the legacy indexer was names 'Resource Type', but for some reason indexed as materialType
  materialType () {
    const recType = this.bib.ldr()?.recType
    const resourceType = lookup('lookup-rectype-to-resourcetype')[recType]
    if (!resourceType) return null
    const resourceLabel = lookup('lookup-resourcetype')[resourceType]
    return [{
      id: `resourcetypes:${resourceType}`,
      label: resourceLabel
    }]
  }

  materialType_packed () {
    return pack(this.materialType())
  }

  mediaType () {
    // Given a mediatype id, returns an entity having that id and appropriate
    // label:
    const useDefault = function (id) {
      const label = lookup('lc-mediatypes')[id]
      return [{ id: `mediatypes:${id}`, label }]
    }

    // If it's a partner record, just use 337/007, falling back on 'n'
    if (this.bib.isPartnerRecord()) {
      return this._mediaTypeByVarField() || useDefault('n')
    }

    // Based on Material Type pull media type from var fields or use default:
    switch (this.bib.fixed('Material Type')) {
      case '-': // MISC
      case '7': // TEACHER AUDIO
      case '8': // TEACHER SET
        return this._mediaTypeByVarField(['337']) || useDefault('z')
      case '3': // E-VIDEO:
        return useDefault('c')
      case 'b': // BLU-RAY
      case 'v': // DVD
        return useDefault('v')
      case 'g': // FILM, SLIDE, ETC
        return this._mediaTypeByVarField(['007']) || useDefault('n')
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
        return this._mediaTypeByVarField(['337']) || useDefault('nc')
      case 'u': // AUDIOBOOK
      case 'y': // MUSIC CD
        return useDefault('s')
    }

    // Handle anything falling through as 'n', including:
    // c (SCORE), d (MANUSCRIPT MUS), l (LARGE PRINT), o (KIT), p (ARCHIVAL MIX),
    // k (PICTURE), o (KIT), p (ACHIVAL MIX), r (3-D OBJECT), x (GAME), e (MAP),
    // a (BOOK/TEXT)
    return useDefault('n')
  }

  mediaType_packed () {
    return pack(this.mediaType())
  }

  note () {
    const notesArray = this._buildNotesArray()
    if (!notesArray.length) return null

    // loop over the content so a separate object is generated for each one.
    return notesArray
      .map(({ varFieldMatchObject, description }, index) =>
      // the array has primary and parallel varFieldMatch objects. An orphan
      //    parallel value will not have a value property, rather a parallel.value
        ({
          label: varFieldMatchObject.value,
          type: 'bf:Note',
          noteType: description
        })
      )
  }

  numCheckinCardItems () {
    const count = this.items()
      .filter((item) => item.type() && item.type().length && item.type()[0] === 'nypl:CheckinCardItem')
      .length
    return [count]
  }

  numItemDatesParsed () {
    const count = this.items()
      .filter((item) => item.dateRange())
      .length
    return [count]
  }

  numElectronicResources () {
    return [this.electronicResources() ? this.electronicResources().length : 0]
  }

  numItemVolumesParsed () {
    const count = this.items()
      .filter((item) => item.volumeRange())
      .length
    return [count]
  }

  numItemsTotal () {
    return [this.items().length]
  }

  nyplSource () {
    return this.bib.nyplSource ? [this.bib.nyplSource] : null
  }

  parallelContributorLiteral () {
    return this._valueToIndexFromBasicMapping('contributorLiteral', false)
  }

  parallelCreatorLiteral () {
    return this._valueToIndexFromBasicMapping('creatorLiteral', false)
  }

  parallelDisplayField () {
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
        if (!parallelValuesPerFieldName) return []

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
    const parallelNotes = this._parallelNotesAsDisplayFields()
    const parallelDisplayFields = [...allOtherParallels, ...parallelNotes]
    return parallelDisplayFields.length === 0 ? null : parallelDisplayFields
  }

  parallelPublisherLiteral () {
    return this._valueToIndexFromBasicMapping('publisherLiteral', false)
  }

  parallelSeriesStatement () {
    return this._valueToIndexFromBasicMapping('seriesStatement', false)
  }

  parallelSubjectLiteral () {
    return this._subjectLiteralValueToIndex(false)
  }

  parallelTitle () {
    return this._valueToIndexFromBasicMapping('title', false)
  }

  parallelTitleAlt () {
    return this._valueToIndexFromBasicMapping('titleAlt', false)
  }

  parallelTitleDisplay () {
    return this._valueToIndexFromBasicMapping('titleDisplay', false)
  }

  parallelUniformTitle () {
    return this._valueToIndexFromBasicMapping('uniformTitle', false)
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

  serialPublicationDates () {
    return this._valueToIndexFromBasicMapping('serialPublicationDates')
  }

  seriesStatement () {
    return this._valueToIndexFromBasicMapping('seriesStatement')
  }

  shelfMark () {
    const callNumber = this._callNum()
    if (callNumber && callNumber.value) {
      // this fieldtag function will actually not add a fieldtagv the logic
      //    returns nothing if there is a marc tag
      const fieldTagV = this.bib.fieldTag('v')
      if (fieldTagV) return [callNumber.value + fieldTagV]
    }
  }

  subjectLiteral () {
    return this._subjectLiteralValueToIndex(true)
  }

  subjectLiteral_exploded () {
    if (this.subjectLiteral()?.length) {
      const subjectLiterals = this.subjectLiteral().map((subject) => {
        if (subject.slice(-1) === '.') {
          return subject.slice(0, -1)
        } else return subject
      })
      return unique(subjectLiterals.map(this._explode).flat())
    } else return null
  }

  // Returns array of hashes with { url, label }, containing electronic resources that are not complete digital records
  supplementaryContent () {
    return this._extractElectronicResourcesFromBibMarc('supplementary content') || null
  }

  tableOfContents () {
    return this._valueToIndexFromBasicMapping('tableOfContents')
  }

  title () {
    return this._valueToIndexFromBasicMapping('title')
  }

  title_sort () {
    const titles = this.title()
    if (!titles?.length) return null

    return [titleSortTransform(titles[0])]
  }

  titleAlt () {
    return this._valueToIndexFromBasicMapping('titleAlt')
  }

  titleDisplay () {
    return this._valueToIndexFromBasicMapping('titleDisplay')
  }

  type () {
    const issuance = this.issuance()
    if (issuance && ['collection', 'serial'].includes(issuance.label)) {
      return ['nypl:Collection']
    }
    // Despite the confusing name, we do in fact want 'Item' here, which has nothing to do
    // with the model type
    return ['nypl:Item']
  }

  uniformTitle () {
    return this._valueToIndexFromBasicMapping('uniformTitle')
  }

  updatedAt () {
    return Date.now()
  }

  async uri () {
    const nyplSourceMapper = await NyplSourceMapper.instance()
    const prefix = nyplSourceMapper.prefix(this.nyplSource())
    return `${prefix}${this.bib.id}`
  }

  _aeonUrls () {
    const urls = this._extractElectronicResourcesFromBibMarc('complete digital record')
      ?.map(({ url }) => url)
      .filter(this._isAeonUrl)
    return urls?.length ? urls : null
  }

  /**
   *  Returns a flat array of objects that have:
   *   - varFieldMatchObject: A varfieldmatch having a primary, parallel, or both
   *   - description: The note description (aka noteType)
   */
  _buildNotesArray () {
    // noteType is description, type is bf:Note, label is the value
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
      const varFields = this.bib.varField(path.marc, path.subfields, {
        // For notes, first indicator of '0' means it's suppressed:
        preFilter: (block) => block.ind1 !== '0'
      })
      return varFields
        .map((varFieldMatchObject) => ({ varFieldMatchObject, description: path.description }))
      // remove empty arrays (no notes for a given marc tag)
    }).filter((content) => {
      return content.length
    }).flat()
  }

  _callNum () {
    return getBibCallNum(this.bib)
  }

  _carrierTypeByVarField (useStrategies = ['338', '007']) {
    if (useStrategies.includes('007')) {
      const id = this.bib.varFieldSegment('007', [0, 1])
      if (id && lookup('lc-carriertypes')[id]) {
        return [{ id: `carriertypes:${id}`, label: lookup('lc-carriertypes')[id] }]
      }
    }

    if (useStrategies.includes('338')) {
      const vals = this.bib.varField('338', ['b', 'a'], { tagSubfields: true })
      if (vals && vals[0]) {
        const id = vals[0].subfieldMap.b
        const label = vals[0].subfieldMap.a
        return [{ id: `carriertypes:${id}`, label }]
      }
    }
  }

  /**
   *  Get date from bib.publishYear. Otherwise pull from 008.
   *
   *  In either case, we return the value as a string just in case it's not parsable as an int (e.g. "197-")
   */
  _dateCreatedString () {
    if (this.bib.publishYear) return String(this.bib.publishYear)
    const dateBy008 = this.bib.varFieldSegment('008', [7, 10])
    if (dateBy008) return dateBy008
  }

  _explode (string) {
    const splitSubject = string.split('--')
    return splitSubject.map((subject, i) => {
      return splitSubject.slice(0, i + 1).join('--').trim()
    })
  }

  /**
 * Given a MiJ bib and a e-resource type, returns extracted resources
 *
 * @param {object} bib Instance of BibSierraRecord
 * @param {string} type Type of resource to extract - either 'supplementary content' or 'complete digital record'
 *
 * @return {array} Array of objects representing electronic resources with following properties:
 * - url: URL of resoruce
 * - label: Label for resource if found
 * - path: "Path" to value in marc (for recording provo)
 */
  _extractElectronicResourcesFromBibMarc (type) {
    // Set up a filter to apply to 856 fields
    // Unless `type` set to ER or Appendix, our preFilter accepts all e-resources:
    let preFilter = () => true
    // Each 856 entry with ind2 of '0' or '1' is a Electronic Resource:
    if (type === 'complete digital record') preFilter = (marcBlock) => ['0', '1'].indexOf(String(marcBlock.ind2)) >= 0
    // Each 856 entry with ind2 of '2' (or blank/unset) is "Appendix" (bib.supplementaryContent):
    if (type === 'supplementary content') preFilter = (marcBlock) => !marcBlock.ind2 || String(marcBlock.ind2).trim() === '' || ['2'].indexOf(String(marcBlock.ind2)) >= 0

    // URLs and labels can be anywhere, so pass `null` subfields param to get them all
    const electronicStuff = this.bib.varField(856, null, { tagSubfields: true, preFilter })

    if (electronicStuff && electronicStuff.length > 0) {
      return electronicStuff.map(({ subfieldMap }) => {
        // Consider all subfield values:
        const values = Object.values(subfieldMap).filter((content) => content)
        // // varFields automatically concatenates subfields into one string, but we want to ignore that
        // delete values.value
        // Get the one that looks like a URL
        const isUrl = (v) => /^https?:/.test(v)
        const url = values.filter(isUrl)[0]
        // .. and choose the label from the longest value that isn't a URL
        const label = values.filter((v) => !isUrl(v)).sort((e1, e2) => e1.length > e2.length ? -1 : 1)[0]

        return url ? { url, label } : null
      }).filter((r) => r)
    } else return null
  }

  _identifiers () {
    let identifiers = []

    // Add shelfmark (call number):
    if (this.shelfMark()) {
      identifiers = identifiers.concat(
        this.shelfMark().map((value) => ({ value, type: 'bf:ShelfMark' }))
      )
    }

    // Add Bnumber as an identifier:
    identifiers.push(
      { value: this.bib.id, type: 'nypl:Bnumber' }
    )

    // Add ISBN(s):
    if (this.idIsbn()) {
      identifiers = identifiers.concat(
        this.idIsbn().map((value) => ({ value, type: 'bf:Isbn' }))
      )
    }

    // Add canceled/invalid ISBNs:
    identifiers = identifiers.concat(
      this.bib.varFieldsMulti(
        BibMappings.get('isbnCanceledInvalid', this.bib)
      )
        .filter((match) => match.value)
        .map((match) => {
          return { value: match.value, type: 'bf:Isbn', identifierStatus: 'canceled/invalid' }
        })
    )

    // Add OCLC(s):
    if (this.idOclc()) {
      identifiers = identifiers.concat(
        this.idOclc().map((value) => ({ value, type: 'nypl:Oclc' }))
      )
    }

    // Add LCCN(s):
    if (this.idLccn()) {
      identifiers = identifiers.concat(
        this.idLccn().map((value) => ({ value, type: 'nypl:Lccn' }))
      )
    }

    // Add ISSN(s):
    if (this.idIssn()) {
      identifiers = identifiers.concat(
        this.idIssn().map((value) => ({ value, type: 'nypl:Issn' }))
      )
    }

    // Add canceled ISSNs:
    identifiers = identifiers.concat(
      this.bib.varFieldsMulti(
        BibMappings.get('issnCanceled', this.bib)
      )
        .filter((match) => match.value)
        .map((match) => {
          return { value: match.value, type: 'bf:Issn', identifierStatus: 'canceled' }
        })
    )

    // Add incorrect ISSNs:
    identifiers = identifiers.concat(
      this.bib.varFieldsMulti(
        BibMappings.get('issnIncorrect', this.bib)
      ).map((value) => {
        return { value, type: 'bf:Issn', identifierStatus: 'incorrect' }
      })
    )

    // Add obscure system control numbers:
    identifiers = identifiers.concat(
      this.bib.varFieldsMulti(BibMappings.get('identifier', this.bib))
        .filter((field) => {
          // Filter out any of these identifiers that have already been added
          // through more specific mappings above:
          return !identifiers.some((otherIdentifier) => {
            return otherIdentifier.id === field.value
          })
        })
        .map((field) => {
          return { value: field.value, type: 'bf:Identifier' }
        })
    )

    return identifiers
  }

  _isAeonUrl (url) {
    const aeonLinks = [
      'https://specialcollections.nypl.org/aeon/Aeon.dll',
      'https://nypl-aeon-test.aeon.atlas-sys.com'
    ]
    return Boolean(aeonLinks.some((path) => url.startsWith(path)))
  }

  _languageCodes () {
    let code = this.bib.varFieldSegment('008', [35, 37])
    if (code) code = code.trim()
    // Only accept 3-char lang codes:
    if (code && code.length === 3) return [code]

    return this.bib.varField('041', ['a'])
      .map((match) => match.value.split(' '))
      .reduce((acc, el) => acc.concat(el), [])
  }

  _mediaTypeByVarField (useStrategies = ['337', '007']) {
    if (useStrategies.includes('007')) {
      const id = this.bib.varFieldSegment('007', [0, 0])
      if (id && lookup('lc-mediatypes')[id]) {
        return [{ id: `mediatypes:${id}`, label: lookup('lc-mediatypes')[id] }]
      }
    }

    if (useStrategies.includes('337')) {
      const vals = this.bib.varField('337', ['b', 'a'], { tagSubfields: true })
      if (vals && vals[0]) {
        const id = vals[0].subfieldMap.b
        const label = vals[0].subfieldMap.a
        return [{ id: `mediatypes:${id}`, label }]
      }
    }
  }

  /**
   * Returns an array of parallel note values rendered as parallelDisplayField
   * entries
   */
  _parallelNotesAsDisplayFields () {
    const notesArray = this._buildNotesArray()
    return notesArray
      // Convert the varfieldmatch objects into parallelDisplayField style
      // objects:
      .map(({ varFieldMatchObject, description }, index) => {
        return {
          value: parallelValue(varFieldMatchObject),
          index,
          fieldName: 'note'
        }
      })
      // Now that we've assigned them index values, remove any that don't
      // actually have any content:
      .filter((parallelDisplayField) => parallelDisplayField.value)
  }

  // _this parameter exists for testing
  _sortify (func, _this = this) {
    let literal = _this[func]()
    if (!literal) return null
    literal = Array.isArray(literal) ? literal[0] : literal
    if (typeof literal !== 'string') return null
    return [literal.substring(0, 80).toLowerCase()]
  }

  /**
   *  Get an array of subjectLiteral (or parallelSubjectLiteral) values to index
   *
   *  This property has very unusual value joining requirements
   */
  _subjectLiteralValueToIndex (primary = true) {
    const mappings = BibMappings.get('subjectLiteral', this.bib)
    const matches = this.bib.varFieldsMulti(mappings)

    let values = matches.map((match) => {
      const subfieldMap = primary ? match.subfieldMap : match.parallel?.subfieldMap
      // Add RTL/LTR indicator if it's a parallel:
      const prefix = !primary && match.parallel?.direction === 'rtl' ? '\u200F' : ''
      return subfieldMap
        ? prefix + subjectLiteralFromSubfieldMap(subfieldMap)
        : ''
    })
    // Remove empty trailing subjects:
    values = removeTrailingElementsMatching(values, (s) => s === '')
    return values.length ? values : null
  }
}

module.exports = EsBib
