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
} = require('../fixtures/browse-term-fixtures')
const esClient = require('../../lib/elastic-search/client')
const sinon = require('sinon')
const EsBib = require('../../lib/es-models/bib')
const logger = require('../../lib/logger')

const mockEsClient = {
  mget: async (request) => {
    const docs = request.body.docs.map(({ _id }) => {
      return mgetResponses[_id]
    })
    return Promise.resolve({
      body: { docs }
    })
  }
}
let loggerSpy
describe('bib activity', () => {
  before(() => {
    loggerSpy = sinon.spy(logger, 'debug')
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
    it('returns labels for preferred term and variants', async () => {
      const bib = toIndex.find(({ id }) => id === 'parallelsChaos')
      expect(await getSubjectModels(new EsBib(new SierraBib(bib)))).to.deep.eq([
        {
          sourceId: 'parallelsChaos',
          preferredTerm: '600 primary value a 600 primary value b',
          variant: '‏600 parallel value a 600 parallel value b'
        }
      ])
    })
    it('returns objects without parallels', async () => {
      const bib = toIndex.find(({ id }) => id === '11655934')
      expect(await getSubjectModels(new EsBib(new SierraBib(bib)))).to.deep.eq([
        { preferredTerm: 'University of Utah -- Periodicals', sourceId: 'b11655934' },
        { preferredTerm: 'Education, Higher -- Utah -- Periodicals', sourceId: 'b11655934' }
      ])
    })
    it('can handle orphan parallels', async () => {
      const bib = {
        id: '123',
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
      expect(await getSubjectModels(new EsBib(new SierraBib(bib)))).to.deep.eq([
        {
          sourceId: '123',
          variant: '‏600 orphaned parallel value a 600 orphaned parallel value b'
        }
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
    it('returns early if there are no idsToFetch', async () => {
      const nonResearchBib = { getIsResearchWithRationale: () => ({ isResearch: false }) }
      expect(buildBibSubjectEvents([nonResearchBib])).to.eventually.equal(undefined)
      expect(loggerSpy.calledWith('No records to fetch or build subjects for'))
    })
    it('can handle a combination of deleted and updated sierra bibs, and filters non research', async () => {
      const records = [...toIndex, ...toDelete].map((record) => new SierraBib(record))
      const countEvents = await buildBibSubjectEvents(records)
      const sortedCountEvents = countEvents.sort((a, b) => {
        return a.preferredTerm.toLowerCase() > b.preferredTerm.toLowerCase() ? 1 : -1
      })
      expect(sortedCountEvents.map((event) => event.preferredTerm)).to.deep.eq([
        'an',
        'Armenians -- Iran -- History',
        'Devon (England) -- Description and travel',
        'Education, Higher -- Utah -- Periodicals',
        'English drama',
        'Milestones -- England -- Devon',
        'old', 'stale', 'subject', 'subject',
        'subject -- from -- suppressed bib',
        'University of Utah -- Periodicals'
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
