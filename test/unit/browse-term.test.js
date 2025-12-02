const expect = require('chai').expect
const {
  fetchLiveBibData,
  buildBrowseDataEvents,
  buildBrowseDataDiff,
  getPrimaryAndParallelLabels,
  getBrowseDataModels,
  buildBatchedCommands,
  determineUpdatedTerms
} = require('../../lib/browse-terms')
const SierraBib = require('../../lib/sierra-models/bib')
const {
  mgetResponses,
  toIndex,
  toDelete
} = require('../fixtures/browse-term-fixtures')
const bernsteinBib = require('../fixtures/bib-bernstein.json')

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
  describe('determineUpdatedTerms nameTitleRole', () => {
    it('returns fresh bib subjects only when there is no live bib data to return', async () => {
      const freshBibs = [
        bernsteinBib].map((bib) => new EsBib(new SierraBib(bib)))
      const ids = freshBibs.map((bib) => bib.uri())
      const terms = await determineUpdatedTerms('nameTitleRole', ids, freshBibs)
      expect(terms).to.deep.equal(
        []
      )
    })
  })
  describe('determineUpdatedTerms', () => {
    const devonBib = require('../fixtures/bib-10554618.json')
    const utahBib = require('../fixtures/bib-11655934.json')
    it('returns no updated subjects when nothing has changed', async () => {
      const freshBibs = [
        devonBib,
        utahBib].map((bib) => new EsBib(new SierraBib({ ...bib, id: `${bib.id}sameAsFresh` })))
      const ids = freshBibs.map((bib) => bib.uri())
      const terms = await determineUpdatedTerms('subjectLiteral', ids, freshBibs)
      expect(terms).to.deep.equal([])
    })
    it('returns fresh bib subjects only when there is no live bib data to return', async () => {
      const freshBibs = [
        utahBib,
        devonBib].map((bib) => new EsBib(new SierraBib(bib)))
      const ids = freshBibs.map((bib) => bib.uri())
      const terms = await determineUpdatedTerms('subjectLiteral', ids, freshBibs)
      expect(terms).to.deep.equal(
        [
          {
            preferredTerm: 'University of Utah -- Periodicals.',
            sourceId: 'b11655934'
          },
          {
            preferredTerm: 'Education, Higher -- Utah -- Periodicals.',
            sourceId: 'b11655934'
          },
          {
            preferredTerm: 'Milestones -- England -- Devon.',
            sourceId: 'b10554618'
          },
          {
            preferredTerm: 'Devon (England) -- Description and travel.',
            sourceId: 'b10554618'
          }
        ]
      )
    })
    it('does not return subjects with the same preferred terms', async () => {
      const freshBibs = [
        devonBib, devonBib
      ].map((bib) => new EsBib(new SierraBib(bib)))
      const ids = freshBibs.map((bib) => bib.uri())
      const terms = await determineUpdatedTerms('subjectLiteral', ids, freshBibs)
      expect(terms).to.deep.equal(
        [
          {
            preferredTerm: 'Milestones -- England -- Devon.',
            sourceId: 'b10554618'
          },
          {
            preferredTerm: 'Devon (England) -- Description and travel.',
            sourceId: 'b10554618'
          }
        ]
      )
    })
    it('only returns subjects that have been removed or added', async () => {
      // ie Does not return subjects present on both the live es document and the freshly generated one... ie the DIFF!
      const freshBibs = [
        require('../fixtures/bib-11655934.json'),
        require('../fixtures/bib-10554618.json')].map((bib) => new EsBib(new SierraBib({ ...bib, id: `${bib.id}someDiff` })))
      const ids = freshBibs.map((bib) => bib.uri())
      const terms = await determineUpdatedTerms('subjectLiteral', ids, freshBibs)
      expect(terms).to.deep.equal([
        {
          preferredTerm: 'University of Utah -- Periodicals.',
          sourceId: 'b11655934someDiff'
        },
        { preferredTerm: 'University of Utah -- Perixxxdicals' },
        {
          preferredTerm: 'Devon (England) -- Description and travel.',
          sourceId: 'b10554618someDiff'
        }
      ])
    })
  })
  xdescribe('buildBatchedCommands', () => {
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
  describe('getBrowseDataModels', () => {
    it('returns labels for preferred term and variants', async () => {
      const bib = toIndex.find(({ id }) => id === 'parallelsChaos')
      expect(await getBrowseDataModels(new EsBib(new SierraBib(bib)))).to.deep.eq([
        {
          sourceId: 'parallelsChaos',
          preferredTerm: '600 primary value a 600 primary value b.',
          variant: '‏600 parallel value a 600 parallel value b.'
        }
      ])
    })
    it('returns objects without parallels', async () => {
      const bib = toIndex.find(({ id }) => id === '11655934')
      expect(await getBrowseDataModels(new EsBib(new SierraBib(bib)))).to.deep.eq([
        { preferredTerm: 'University of Utah -- Periodicals.', sourceId: 'b11655934' },
        { preferredTerm: 'Education, Higher -- Utah -- Periodicals.', sourceId: 'b11655934' }
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
              content: '600 orphaned parallel value b.'
            }
          ]
        }]
      }
      expect(await getBrowseDataModels(new EsBib(new SierraBib(bib)))).to.deep.eq([
        {
          sourceId: '123',
          variant: '‏600 orphaned parallel value a 600 orphaned parallel value b.'
        }
      ])
    })
  })
  describe('getPrimaryAndParallelLabels', () => {
    it('can handle no parallels', () => {
      const labels = getPrimaryAndParallelLabels({
        marc: {
          ind2: '0',
          marcTag: '600',
          subfields: [
            { tag: 'a', content: 'preferredTerm a' },
            { tag: 'b', content: 'preferredTerm b' }
          ]
        }
      })
      expect(labels).to.deep.equal({ preferredTerm: 'preferredTerm a preferredTerm b.', suppress: false })
    })
    it('can handle preferredTerm and parallel', () => {
      const labels = getPrimaryAndParallelLabels({
        marc: {
          ind2: '0',
          marcTag: '600',
          subfields: [
            { tag: 'a', content: 'preferredTerm a' },
            { tag: 'b', content: 'preferredTerm b.' }
          ]
        },
        parallel: {
          marc: {
            ind2: '0',
            marcTag: '880',
            subfields: [
              { tag: 'a', content: 'parallel a' },
              { tag: 'b', content: 'parallel b' }
            ]
          }
        }
      })
      expect(labels).to.deep.equal(
        { preferredTerm: 'preferredTerm a preferredTerm b.', suppress: false, variant: 'parallel a parallel b.' })
    })
  })
  describe('buildBrowseDataDiff', () => {
    const makePreferredTermObject = (x) => ({ preferredTerm: x })
    it('subjects added', () => {
      expect(buildBrowseDataDiff(['a', 'b', 'c', 'd'].map(makePreferredTermObject), ['c', 'd'].map(makePreferredTermObject))).to.deep.equal(['a', 'b'].map(makePreferredTermObject))
    })
    it('subjects deleted', () => {
      expect(buildBrowseDataDiff(['c', 'd'].map(makePreferredTermObject), ['a', 'b', 'c', 'd'].map(makePreferredTermObject))).to.deep.equal(['a', 'b'].map(makePreferredTermObject))
    })
  })
  describe('buildBrowseDataEvents', () => {
    it('returns an empty array if there are no idsToFetch', async () => {
      const nonResearchBib = { getIsResearchWithRationale: () => ({ isResearch: false }) }
      expect(buildBrowseDataEvents([nonResearchBib])).to.eventually.equal([])
      expect(loggerSpy.calledWith('No records to fetch or build subjects for'))
    })
    describe('on ingest (all subjects from non suppressed or deleted bibs present are passed along)', () => {
      before(() => {
        process.env.INGEST_BROWSE_TERMS = true
      })
      after(() => {
        process.env.INGEST_BROWSE_TERMS = false
      })
      it('can handle a combination of deleted and updated sierra bibs, and filters non research and suppressed, and ignores indexed subject data', async () => {
        const records = [...toIndex, ...toDelete].map((record) => new EsBib(new SierraBib(record)))
        const countEvents = await buildBrowseDataEvents(records)
        const sortedCountEvents = countEvents.sort((a, b) => {
          return a.preferredTerm.toLowerCase() > b.preferredTerm.toLowerCase() ? 1 : -1
        })
        expect(sortedCountEvents.map((event) => event.preferredTerm)).to.deep.eq([
          'Devon (England) -- Description and travel.',
          'Education, Higher -- Utah -- Periodicals.',
          'English drama.',
          'Milestones -- England -- Devon.',
          'University of Utah -- Periodicals.'
        ])
      })
    })
    describe('Not on ingest (only diff is passed along)', () => {
      before(() => {
        process.env.INGEST_BROWSE_TERMS = false
      })
      it('calls determineUpdatedTerms', async () => {
        const records = [...toIndex, ...toDelete].map((record) => new EsBib(new SierraBib(record)))
        const countEvents = await buildBrowseDataEvents(records)
        const sortedCountEvents = countEvents.sort((a, b) => {
          return a.preferredTerm.toLowerCase() > b.preferredTerm.toLowerCase() ? 1 : -1
        })
        // This list returns more subjects than the last test, since it includes
        // subjects from live bibs as well as additional subjects from bib event
        expect(sortedCountEvents.map((event) => event.preferredTerm)).to.deep.eq([
          'an',
          'Armenians -- Iran -- History.',
          'Devon (England) -- Description and travel.',
          'Education, Higher -- Utah -- Periodicals.',
          'English drama.',
          'Milestones -- England -- Devon.',
          'old',
          'stale',
          'subject',
          'subject -- from -- suppressed bib.',
          'University of Utah -- Periodicals.'
        ])
      })
    })
  })
  describe('fetchLiveSubjects', () => {
    it('returns a flattened array of subjects for supplied records', async () => {
      const records = ['b2', 'b3']
      const liveSubjects = await fetchLiveBibData(records)
      expect(liveSubjects).to.deep.equal([
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
      const noSubjects = await fetchLiveBibData(undefined)
      expect(noSubjects).to.deep.equal([])
    })
    it('can handle elastic search returning not found responses', async () => {
      const records = ['b1', 'b2', 'b3', 'b4']
      const liveSubjects = await fetchLiveBibData(records)
      expect(liveSubjects).to.deep.eq([
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
