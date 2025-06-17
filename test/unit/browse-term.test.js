const expect = require('chai').expect
const { buildUnionOfSubjects, fetchStaleSubjectLiterals } = require('../../lib/browse-terms')
const esResponses = require('../fixtures/browse-term.js/es-responses')

const mockEsClient = {
  mget: async (request) => {
    const docs = request.body.docs.map(({ _id }) => esResponses[_id])
    return Promise.resolve({
      docs
    })
  }
}

describe('bib activity', () => {
  describe('fetchStaleSubjects', () => {
    it('can handle no records', async () => {
      const noSubjects = await fetchStaleSubjectLiterals([], mockEsClient)
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
  describe('buildUnionOfSubjects', () => {
    it('can handle when there is a missing stale record', () => {
      const fresh = [{ subjectLiteral: ['a', 'b', 'c', 'd'] }, { subjectLiteral: ['q'] }, { subjectLiteral: ['z', 'y', 'a', 'b'] }]
      const stale = [{ subjectLiteral: ['a', 'b', 'c', 'x'] }, null, { subjectLiteral: ['z', 'y', 'a', 'b'] }]
      console.log(buildUnionOfSubjects(fresh, stale))
      expect(buildUnionOfSubjects(fresh, stale)
        .sort((a, b) => {
          return a > b ? 1 : -1
        })
      )
        .to.deep.equal(['a', 'b', 'c', 'd', 'q', 'x', 'y', 'z'])
    }
    )
    it('update', () => {
      const fresh = [{ subjectLiteral: ['a', 'b', 'c', 'd'] }]
      const stale = [{ subjectLiteral: ['a', 'b', 'c', 'x'] }]
      expect(buildUnionOfSubjects(fresh, stale)).to.deep.equal(['a', 'b', 'c', 'd', 'x'])
    })
    it('creation', () => {
      const fresh = [{ subjectLiteral: ['a', 'b', 'c', 'x'] }]
      const stale = [{ subjectLiteral: null }]
      expect(buildUnionOfSubjects(fresh, stale)).to.deep.equal(['a', 'b', 'c', 'x'])
    })
    it('deletion', () => {
      const fresh = [{ subjectLiteral: null }]
      const stale = [{ subjectLiteral: ['a', 'b', 'c', 'x'] }]
      expect(buildUnionOfSubjects(fresh, stale)).to.deep.equal(['a', 'b', 'c', 'x'])
    })
  })
})
