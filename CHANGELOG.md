# Changelog

## v1.0.3
- Changes to linking entry logic (SCC-5564), including enforcing array values. 
- update browse-term module, include 662 in subjectLiteral bib-mapping

## v1.0.1 - 2026-11-03
- Update to new qa and prod resources indexes: `resources-qa-2026-10-23`, `resources-prod-2026-10-29`
- Revise bulk index scripts for future managed jobs (SCC-5617)
- Add `collectionId` to checkin card item model (SCC-5742)
- Add `flattenedNotIndexed` property type to index schema
- Add linking entries to bib model (SCC-5564)
- Update `physicalDescription` logic to correctly order subfields (SCC-5337)
- Update normalizers (SCC-5685)
- Add changelog, version bumping, and git tagging hooks, plus `rciVersion` property to indexed documents (SCC-5406)
- Update NewRelic layer to 'slim' version

## v1.0.0 (January 2026)
- Update browse term emission rules: send all subjects from ES index and new bib document to Browse Term Indexer. Previous behavior involved filtering out subjects present in both places, and only sending subjects assumed to be added or deleted.
- Update @nypl/browse-term version for updated 690 rules
- Add changelog
