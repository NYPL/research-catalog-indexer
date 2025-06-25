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
            { tag: 'a', content: 'primary a' },
            { tag: 'b', content: 'primary b' }
          ]
        }
      })
      expect(labels).to.deep.equal({ primary: 'primary a primary b' })
    })
    it('can handle primary and parallel', () => {
      const labels = getPrimaryAndParallelLabels({
        marc: {
          marcTag: '600',
          subfields: [
            { tag: 'a', content: 'primary a' },
            { tag: 'b', content: 'primary b' }
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
        { primary: 'primary a primary b', parallel: 'parallel a parallel b' })
    })
  })
  describe('buildSubjectDiff', () => {
    it('subjects added', () => {
      expect(buildSubjectDiff(['a', 'b', 'c', 'd'], ['c', 'd'])).to.deep.equal(['a', 'b'])
    })
    it('subjects deleted', () => {
      expect(buildSubjectDiff(['c', 'd'], ['a', 'b', 'c', 'd'])).to.deep.equal(['a', 'b'])
    })
  })
  describe.only('buildBibSubjectCountEvents', () => {
    it('can handle a combination of deleted and updated sierra bibs', async () => {
      const records = [...toIndex, ...toDelete].map((record) => new SierraBib(record))
      const countEvents = await buildBibSubjectCountEvents(records)
      expect(countEvents).to.deep.eq([
        { type: 'subjectLiteral', primary: 'University of Utah -- Periodicals.' },
        {
          type: 'subjectLiteral',
          primary: 'Education, Higher -- Utah -- Periodicals.'
        },
        { type: 'subjectLiteral', primary: 'English drama.' },
        { type: 'subjectLiteral', primary: 'Milestones -- England -- Devon.' },
        {
          type: 'subjectLiteral',
          primary: 'Devon (England) -- Description and travel.'
        },
        {
          primary: 'subject -- from -- suppressed bib.',
          type: 'subjectLiteral'
        },
        {
          primary: 'Armenians -- Iran -- History.',
          type: 'subjectLiteral'
        },
        { type: 'subjectLiteral', primary: 'an' },
        { type: 'subjectLiteral', primary: 'old' },
        { type: 'subjectLiteral', primary: 'subject' },
        { type: 'subjectLiteral', primary: 'stale' }
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
