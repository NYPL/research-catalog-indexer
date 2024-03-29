const expect = require('chai').expect

const {
  sourceMatches,
  amendMappingsBasedOnNyplSource,
  BibMappings,
  ItemMappings,
  HoldingMappings
} = require('../../lib/mappings/mappings')
const SierraBib = require('../../lib/sierra-models/bib')

describe('mappings', function () {
  describe('amendMappingsBasedOnNyplSource', function () {
    it('should filter out paths with non-matching nypl sources', function () {
      const data = {
        title: {
          paths: [
            {
              marc: '245',
              subfields: [
                'a',
                'b'
              ],
              nyplSources: [
                'sierra-nypl',
                'recap-cul',
                'recap-pul'
              ]
            },
            {
              marc: '245',
              subfields: [
                'a',
                'b',
                'c'
              ],
              nyplSources: [
                'recap-hl'
              ]
            }
          ]
        },
        type: {
          paths: [
            {
              marc: 'LDR/07'
            }
          ]
        }
      }
      const nyplSource = 'sierra-nypl'
      const expectedAmendedData = {
        title: {
          paths: [
            {
              marc: '245',
              subfields: [
                'a',
                'b'
              ],
              nyplSources: [
                'sierra-nypl',
                'recap-cul',
                'recap-pul'
              ]
            }
          ]
        },
        type: {
          paths: [
            {
              marc: 'LDR/07'
            }
          ]
        }
      }
      expect(amendMappingsBasedOnNyplSource(data, nyplSource)).to.deep.equal(expectedAmendedData)
    })
  })

  describe('sourceMatches', function () {
    it('should return true if any of the patterns are equal to the given source', function () {
      expect(sourceMatches('sierra-nypl', ['recap-pul', 'sierra-nypl'])).to.equal(true)
    })

    it('should return true if any of the patterns is *', function () {
      expect(sourceMatches('sierra-nypl', ['recap-pul', '*'])).to.equal(true)
    })

    it('should return false if there are no matching patterns', function () {
      expect(sourceMatches('sierra-nypl', ['recap-pul', 'recap-cul'])).to.equal(false)
    })
  })

  describe('model mappers', function () {
    describe('BibMappings', function () {
      it('should have a get function that extracts from bib mappings', function () {
        expect(BibMappings.get('title', {})).to.deep.equal([
          {
            marc: '245',
            subfields: [
              'a',
              'b'
            ],
            nyplSources: [
              'sierra-nypl',
              'recap-cul',
              'recap-pul'
            ]
          },
          {
            marc: '245',
            subfields: [
              'a',
              'b',
              'c'
            ],
            nyplSources: [
              'recap-hl'
            ]
          }
        ])
      })
    })

    describe('ItemMappings', function () {
      it('should have a get function that extracts from item mappings', function () {
        expect(ItemMappings.get('recapCustomerCode', {})).to.deep.equal([
          {
            marc: '900',
            subfields: [
              'b'
            ]
          }
        ])
      })
    })

    describe('HoldingMappings', function () {
      it('should have a get function that extracts from holding mappings', function () {
        expect(HoldingMappings.get('physicalLocation', {})).to.deep.equal([
          {
            marc: '852',
            subfields: [
              'k',
              'h',
              'i'
            ]
          }
        ])
      })
    })
  })
  describe('makeMappingsGetter', () => {
    it('returns a function that returns subfields specified in mappings.json', () => {
      const bib = new SierraBib(require('../fixtures/bib-11055155.json'))
      const mappings = BibMappings.get('contentsTitle', bib)
      const subfields = mappings.map(marcField => marcField.subfields).flat()
      // This marcfield for this bib also has subfields g and r, which are not
      // included in bib-mappings.json
      expect(subfields).to.deep.equal(['t'])
    })
  })
})
