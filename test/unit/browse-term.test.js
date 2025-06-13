const expect = require('chai').expect
const sinon = require('sinon')
const { buildUnionOfSubjects } = require('../../lib/browse-terms')

describe('bib activity', () => {
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
    // it.todo('creation', () => {

    // })
    // it.todo('deletion', () => {

    // })
  })
})
