# Using RCI for browse term ingest
This document outlines the procedure for updating a browse term property on all resources documents in elastic search, populating the browse index with those terms, and updating the counts for those terms.

## Dependencies
- a copy of the [Browseable Term Indexer](https://github.com/NYPL/browseable-term-indexer) (heretofore BTI) 

## How to
1. cd into the BTI
2. ensure there is an up to date `temp/index.js` in the Browseable Term Indexer: 
 - (TO DO: update to skip this next step) update BTI's package.json to have `"type": "commonjs"`
 - npm i; npm run build;
3. cd into the Research Catalog Indexer (RCI)
4. ensure the qa-browse-ingest.env has an accurate value for BTI_INDEX_PATH, which is relative to THIS repo's scripts/ directory, and BTI_CONFIG_PATH, which is relative to where the script is invoked (which should be the root of this repo)
5. Run:
```
node scripts/bulk-index.js --properties subjectLiteral,parallelSubjectLiteral --envfile config/qa-browse-ingest.env --type bib --nyplSource {source}
```

## ENV vars
- BTI_INDEX_PATH - path to where the BTI lambda handler is exported from.
- BTI_CONFIG_PATH - path from where script is invoked to where the BTI config is stored.
- INGEST_BROWSE_TERMS (true) - indicates to the RCI to skip live bib browse term data fetching. We fetch those to ensure that any deleted subjects or updated subjects get updated counts. When ingesting, we are not worried about such potential diffs, because there are no diffs in an empty index.
- EMIT_BROWSE_TERMS (true) - indicates to RCI to reprocess browse terms via exposed methods in `./index.js` and send them to, in this case, a local version of the BTI for indexing.
- SKIP_DOC_PROCESSED_STREAM (true) - we don't need to write completed processed documents to this kinesis stream, and skippin the avro encoding is good for performance.
- SKIP_PREFETCH (true) - skip any item or holding DB or API prefetching. These fields are not needed for browse term updates
- UPDATE_ONLY (true) - perform updates only to specific properties passed on command line instead of rewriting entire document

