const expect = require('chai').expect
const {
  fetchStaleSubjectLiterals,
  buildBibSubjectEvents,
  buildSubjectDiff,
  getPrimaryAndParallelLabels,
  getSubjectModels,
  buildBatchedCommands
} = require('../../lib/browse-terms')
const SierraBib = require('../../lib/sierra-models/bib')
const {
  mgetResponses,
  toIndex,
  toDelete
} = require('../fixtures/browse-term/fixtures')
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
  describe('buildBatchedCommands', () => {
    const generateSubjects = (length) => (new Array(length)).fill(null).map((_, i) => ({ preferredTerm: `pref ${i}` }))
    it('1 subject', () => {
      const subject = generateSubjects(1)
      const commands = buildBatchedCommands(subject, 'sqs url')
      expect(commands.length).to.eq(1)
      expect(commands[0].input.Entries.length).to.eq(1)
    })
    it('10 subjects', () => {
      const subject = generateSubjects(10)
      const commands = buildBatchedCommands(subject, 'sqs url')
      expect(commands.length).to.eq(1)
      expect(commands[0].input.Entries.length).to.eq(10)
    })
    it('27 subjects', () => {
      const subject = generateSubjects(27)
      const commands = buildBatchedCommands(subject, 'sqs url')
      expect(commands.length).to.eq(3)
      expect(commands[2].input.Entries.length).to.eq(7)
    })
  })
  describe('getSubjectModels', () => {
    it('returns labels for preferred term and variants', () => {
      const bib = toIndex.find(({ id }) => id === 'parallelsChaos')
      expect(getSubjectModels(new SierraBib(bib))).to.deep.eq([
        {
          preferredTerm: '600 primary value a 600 primary value b',
          variant: '‏600 parallel value a 600 parallel value b'
        }
      ])
    })
    it('returns objects without parallels', () => {
      const bib = toIndex.find(({ id }) => id === '11655934')
      console.log(getSubjectModels(new SierraBib(bib)))
      expect(getSubjectModels(new SierraBib(bib))).to.deep.eq([
        { preferredTerm: 'University of Utah -- Periodicals.' },
        { preferredTerm: 'Education, Higher -- Utah -- Periodicals.' }
      ])
    })
    it('can handle orphan parallels', () => {
      const bib = {
        varFields: [{
          fieldTag: 'y',
          marcTag: '880',
          ind1: '0',
          ind2: ' ',
          content: null,
          subfields: [
            {
              tag: '6',
              content: '600-02/(3/r'
            },
            {
              tag: 'a',
              content: '600 orphaned parallel value a'
            },
            {
              tag: 'b',
              content: '600 orphaned parallel value b'
            }
          ]
        }]
      }
      expect(getSubjectModels(new SierraBib(bib))).to.deep.eq([
        { variant: '‏600 orphaned parallel value a 600 orphaned parallel value b' }
      ])
    })
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
  describe('buildBibSubjectEvents', () => {
    it('can handle a combination of deleted and updated sierra bibs', async () => {
      const records = [...toIndex, ...toDelete].map((record) => new SierraBib(record))
      const countEvents = await buildBibSubjectEvents(records)
      const sortedCountEvents = countEvents.sort((a, b) => {
        return a.preferredTerm.toLowerCase() > b.preferredTerm.toLowerCase() ? 1 : -1
      })
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
