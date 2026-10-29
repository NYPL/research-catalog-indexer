const { expect } = require('chai')

const { buildSqlQuery } = require('../../scripts/identify-ids-by-marc')

describe('scripts/identify-ids-by-marc', () => {
  describe('buildSqlQuery', () => {
    it('builds sql for has-marc query', () => {
      expect(buildSqlQuery({ hasMarc: '001', nyplSource: 'sierra-nypl', type: 'bib' }))
        .to.deep.eq({
          query: [
            'SELECT id, nypl_source FROM bib',
            'WHERE (is_nypl_research OR nypl_source != \'sierra-nypl\')',
            'AND nypl_source = \'sierra-nypl\'',
            'AND marc_tags @> ARRAY[\'001\']'
          ].join(' '),
          type: 'bib'
        })
    })

    it('builds sql for has-marc and has-subfield query', () => {
      expect(buildSqlQuery({ hasMarc: '700', hasSubfield: 't', nyplSource: 'sierra-nypl', type: 'bib' }))
        .to.deep.eq({
          query: [
            'SELECT id, nypl_source FROM bib, json_array_elements(bib.var_fields::json) jV,',
            "json_array_elements(jV->'subfields') jVS",
            "WHERE (is_nypl_research OR nypl_source != 'sierra-nypl')",
            "AND nypl_source = 'sierra-nypl'",
            "AND marc_tags @> ARRAY['700']",
            "AND json_typeof(bib.var_fields::json) = 'array'",
            "AND jV->>'marcTag' = '700'",
            "AND json_typeof(jV->'subfields') = 'array'",
            "AND jVS->>'tag' = 't'"
          ].join(' '),
          type: 'bib'
        })
    })

    it('applies limit if specified', () => {
      expect(buildSqlQuery({ hasMarc: '001', nyplSource: 'sierra-nypl', type: 'bib', limit: 10 }))
        .to.deep.eq({
          query: [
            'SELECT id, nypl_source FROM bib',
            "WHERE (is_nypl_research OR nypl_source != 'sierra-nypl')",
            "AND nypl_source = 'sierra-nypl'",
            "AND marc_tags @> ARRAY['001']",
            'LIMIT 10'
          ].join(' '),
          type: 'bib'
        })
    })
  })
})
