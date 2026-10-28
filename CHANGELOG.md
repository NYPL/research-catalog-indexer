# Changelog


## Prerelease
- Update NewRelic layer to 'slim' version

## v1.0.1 - TBD
- Add changelog, version bumping, and git tagging hooks, plus `rciVersion` property to indexed documents (SCC-5406)

## v1.0.0 (January 2026)
- Update browse term emission rules: send all subjects from ES index and new bib document to Browse Term Indexer. Previous behavior involved filtering out subjects present in both places, and only sending subjects assumed to be added or deleted.
- Update @nypl/browse-term version for updated 690 rules
- Add changelog
