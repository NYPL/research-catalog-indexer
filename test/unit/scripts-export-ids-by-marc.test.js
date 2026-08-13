const { expect } = require('chai')

const { buildSqlQuery } = require('../../scripts/export-ids-by-marc')

describe('scripts/export-ids-by-marc', () => {
  describe('buildSqlQuery', () => {
    it('builds sql for has-marc query', () => {
      expect(buildSqlQuery({ hasMarc: '001', nyplSource: 'sierra-nypl', type: 'bib' }))
        .to.deep.eq({
          query: [
            'SELECT DISTINCT id, nypl_source FROM bib,',
            'json_array_elements(var_fields::json) jV',
            'WHERE nypl_source = $1',
            "AND jV->>'marcTag' = $2"
          ].join('\n'),
          params: ['sierra-nypl', '001'],
          type: 'bib'
        })
    })

    it('builds sql for has-marc and has-subfield query', () => {
      expect(buildSqlQuery({ hasMarc: '700', hasSubfield: 't', nyplSource: 'sierra-nypl', type: 'bib' }))
        .to.deep.eq({
          query: [
            'SELECT DISTINCT id, nypl_source FROM bib,',
            'json_array_elements(var_fields::json) jV,',
            "json_array_elements(jV->'subfields') jVS",
            'WHERE nypl_source = $1',
            "AND jV->>'marcTag' = $2",
            "AND jVS->>'tag' = $3"
          ].join('\n'),
          params: ['sierra-nypl', '700', 't'],
          type: 'bib'
        })
    })

    it('applies limit if specified', () => {
      expect(buildSqlQuery({ hasMarc: '001', nyplSource: 'sierra-nypl', type: 'bib', limit: 10 }))
        .to.deep.eq({
          query: [
            'SELECT DISTINCT id, nypl_source FROM bib,',
            'json_array_elements(var_fields::json) jV',
            'WHERE nypl_source = $1',
            "AND jV->>'marcTag' = $2 LIMIT 10"
          ].join('\n'),
          params: ['sierra-nypl', '001'],
          type: 'bib'
        })
    })
  })
})
