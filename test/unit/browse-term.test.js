const expect = require('chai').expect
const { fetchStaleSubjectLiterals, buildBibSubjectCountEvents, buildSubjectDiff, getPrimaryAndParallelLabels } = require('../../lib/browse-terms')
const SierraBib = require('../../lib/sierra-models/bib')
const { mgetResponses, toIndex, toDelete } = require('../fixtures/browse-term.js/fixtures')
const esClient = require('../../lib/elastic-search/client')
const sinon = require('sinon')

const mockEsClient = {
  mget: async (request) => {
    const docs = request.body.docs.map(({ _id }) => {
      return mgetResponses[_id]
    })
    return Promise.resolve({
      docs
    })
  }
}

describe('bib activity', () => {
  before(() => {
    sinon.stub(esClient, 'client').resolves(mockEsClient)
  })
  after(() => {
    esClient.client.restore()
  })
  describe('getPrimaryAndParallelLabels', () => {
    it('can handle no parallels', () => {
      const labels = getPrimaryAndParallelLabels({
        marc: {
          marcTag: '600',
          subfields: [
            { tag: 'a', content: 'preferredTerm a' },
            { tag: 'b', content: 'preferredTerm b' }
          ]
        }
      })
      expect(labels).to.deep.equal({ preferredTerm: 'preferredTerm a preferredTerm b' })
    })
    it('can handle preferredTerm and parallel', () => {
      const labels = getPrimaryAndParallelLabels({
        marc: {
          marcTag: '600',
          subfields: [
            { tag: 'a', content: 'preferredTerm a' },
            { tag: 'b', content: 'preferredTerm b' }
          ]
        },
        parallel: {
          marc: {
            marcTag: '880',
            subfields: [
              { tag: 'a', content: 'parallel a' },
              { tag: 'b', content: 'parallel b' }
            ]
          }
        }
      })
      expect(labels).to.deep.equal(
        { preferredTerm: 'preferredTerm a preferredTerm b', variant: 'parallel a parallel b' })
    })
  })
  describe('buildSubjectDiff', () => {
    const makePreferredTermObject = (x) => ({ preferredTerm: x })
    it('subjects added', () => {
      expect(buildSubjectDiff(['a', 'b', 'c', 'd'].map(makePreferredTermObject), ['c', 'd'].map(makePreferredTermObject))).to.deep.equal(['a', 'b'].map(makePreferredTermObject))
    })
    it('subjects deleted', () => {
      expect(buildSubjectDiff(['c', 'd'].map(makePreferredTermObject), ['a', 'b', 'c', 'd'].map(makePreferredTermObject))).to.deep.equal(['a', 'b'].map(makePreferredTermObject))
    })
  })
  describe('buildBibSubjectCountEvents', () => {
    it('can handle a combination of deleted and updated sierra bibs', async () => {
      const records = [...toIndex, ...toDelete].map((record) => new SierraBib(record))
      const countEvents = await buildBibSubjectCountEvents(records)
      const sortedCountEvents = countEvents.sort((a, b) => {
        return a.preferredTerm.toLowerCase() > b.preferredTerm.toLowerCase() ? 1 : -1
      })
      console.dir(sortedCountEvents, { depth: null })
      expect(sortedCountEvents).to.deep.eq([
        {
          preferredTerm: '600 primary value a 600 primary value b',
          variant: '‏600 parallel value a 600 parallel value b',
          type: 'subjectLiteral'
        },
        { preferredTerm: 'an', type: 'subjectLiteral' },
        {
          preferredTerm: 'Armenians -- Iran -- History.',
          type: 'subjectLiteral'
        },
        {
          preferredTerm: 'Devon (England) -- Description and travel.',
          type: 'subjectLiteral'
        },
        {
          preferredTerm: 'Education, Higher -- Utah -- Periodicals.',
          type: 'subjectLiteral'
        },
        { preferredTerm: 'English drama.', type: 'subjectLiteral' },
        {
          preferredTerm: 'Milestones -- England -- Devon.',
          type: 'subjectLiteral'
        },
        { preferredTerm: 'old', type: 'subjectLiteral' },
        { preferredTerm: 'stale', type: 'subjectLiteral' },
        { preferredTerm: 'subject', type: 'subjectLiteral' },
        { preferredTerm: 'subject', type: 'subjectLiteral' },
        {
          preferredTerm: 'subject -- from -- suppressed bib.',
          type: 'subjectLiteral'
        },
        {
          preferredTerm: 'University of Utah -- Periodicals.',
          type: 'subjectLiteral'
        }
      ])
    })
  })
  describe('fetchStaleSubjects', () => {
    it('returns a flattened array of subjects for supplied records', async () => {
      const records = ['b2', 'b3']
      const staleSubjects = await fetchStaleSubjectLiterals(records)
      expect(staleSubjects).to.deep.equal([
        'spaghetti',
        'meatballs',
        'Literature -- Collections -- Periodicals.',
        'Intellectual life.',
        'Literature.',
        'Electronic journals.',
        'New York (N.Y.) -- Intellectual life -- Directories.',
        'New York (State) -- New York.'
      ])
    })
    it('can handle no records', async () => {
      const noSubjects = await fetchStaleSubjectLiterals(undefined)
      expect(noSubjects).to.deep.equal([])
    })
    it('can handle elastic search returning not found responses', async () => {
      const records = ['b1', 'b2', 'b3', 'b4']
      const staleSubjects = await fetchStaleSubjectLiterals(records)
      expect(staleSubjects).to.deep.eq([
        'spaghetti',
        'meatballs',
        'Literature -- Collections -- Periodicals.',
        'Intellectual life.',
        'Literature.',
        'Electronic journals.',
        'New York (N.Y.) -- Intellectual life -- Directories.',
        'New York (State) -- New York.'
      ])
    })
  })
})
