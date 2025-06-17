const expect = require('chai').expect
const { buildUnionOfSubjects, fetchStaleSubjectLiterals, buildBibSubjectCountEvents } = require('../../lib/browse-terms')
const EsBib = require('../../lib/es-models/bib')
const SierraBib = require('../../lib/sierra-models/bib')
const { mgetResponses, toIndex, toDelete } = require('../fixtures/browse-term.js/fixtures')

const mockEsClient = {
  mget: async (request) => {
    const docs = request.body.docs.map(({ _id }) => {
      console.log(_id)
      return mgetResponses[_id]
    })
    return Promise.resolve({
      docs
    })
  }
}

describe('bib activity', () => {
  describe('buildBibSubjectCountEvents', () => {
    it('combines es records and sierra records into an array of term count objects', async () => {
      const recordsToIndex = await Promise.all(toIndex.map((record) => new SierraBib(record)).map(async (record) => await new EsBib(record).toJson()))
      const recordsToDelete = toDelete.map((record) => new SierraBib(record))
      const countEvents = await buildBibSubjectCountEvents(recordsToIndex, recordsToDelete, mockEsClient)
      console.log(countEvents)
      expect(countEvents).to.deep.eq([
        { term: 'University of Utah -- Periodicals.' },
        { term: 'Education, Higher -- Utah -- Periodicals.' },
        { term: 'English drama.' },
        { term: 'Milestones -- Devon.' },
        { term: 'Devon (England) -- Description and travel.' }
      ])
    })
  })
  describe('fetchStaleSubjects', () => {
    it('returns a flattened array of subjects for supplied records', async () => {
      const records = ['b2', 'b3'].map(id => { return { id } })
      const staleSubjects = await fetchStaleSubjectLiterals(records, mockEsClient)
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
      const noSubjects = await fetchStaleSubjectLiterals(undefined, mockEsClient)
      expect(noSubjects).to.deep.equal([])
    })
    it('can handle elastic search returning not found responses', async () => {
      const records = ['b1', 'b2', 'b3', 'b4'].map(id => { return { id } })
      const staleSubjects = await fetchStaleSubjectLiterals(records, mockEsClient)
      expect(staleSubjects).to.deep.eq([
        null,
        'spaghetti',
        'meatballs',
        'Literature -- Collections -- Periodicals.',
        'Intellectual life.',
        'Literature.',
        'Electronic journals.',
        'New York (N.Y.) -- Intellectual life -- Directories.',
        'New York (State) -- New York.',
        null
      ])
    })
  })
  describe.only('buildUnionOfSubjects', () => {
    it('can handle when there is a missing stale record', () => {
      const fresh = ['a', 'b', 'c', 'd', 'q', 'z', 'y', 'a', 'b']
      const stale = ['a', 'b', 'c', 'x', null, 'z', 'y', 'a', 'b']
      expect(buildUnionOfSubjects([...fresh, ...stale])
        .sort((a, b) => {
          return a > b ? 1 : -1
        })
      )
        .to.deep.equal(['a', 'b', 'c', 'd', 'q', 'x', 'y', 'z'])
    }
    )
    it('update', () => {
      const fresh = ['a', 'b', 'c', 'd']
      const stale = ['a', 'b', 'c', 'x']
      expect(buildUnionOfSubjects([...fresh, ...stale])).to.deep.equal(['a', 'b', 'c', 'd', 'x'])
    })
    it('creation', () => {
      const fresh = ['a', 'b', 'c', 'x']
      const stale = [null]
      expect(buildUnionOfSubjects([...fresh, ...stale])).to.deep.equal(['a', 'b', 'c', 'x'])
    })
    it('deletion', () => {
      const fresh = [null]
      const stale = ['a', 'b', 'c', 'x']
      expect(buildUnionOfSubjects([...fresh, ...stale])).to.deep.equal(['a', 'b', 'c', 'x'])
    })
  })
})
