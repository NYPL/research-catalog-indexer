# Reindexing Guidelines

This document is a work in progress and is nowhere near exhaustive. It is meant to illustrate common use cases.

## The scripts and their applications
### `identify-ids-by-es-query.js`
* Required: elastic search query JSON. See `./example-queries` for inspiration
* RCI source: n/a
* Uses:
  * Return bib ids from elastic search. Handles pagination of returned records and outputs to a csv of ids.
* Risks: n/a

### `reindex-record.js`
* Required: single record uri
* RCI source: deployed code
* Uses:
  * Bib is not displaying according to indexing rules in the Research Catalog
  * Record in ES is out of sync with Bib/Item/Holding Service data
* Risks: Low. 
  * Single record update using code that has passed code review and has been safely deployed.

### `bulk-index.js`
* Required: csv of ids or bib service query. Note that it may be more efficient to run the bib service query separately and output to a csv with id and nyplSource column. If the property in question is a bib-level property, see documentation `bulk-index.js` about bib-only update invocations
* RCI source: checked out branch of RCI
* Uses:
  * Updating any number of records. Necessary when a new indexing rule has been added or updated for a property that every bib has.
  * Testing out work in progress code. If you are working on a new indexing rule, you may reindex it with your WIP as long as you are working with QA config.
* Risks: High. 
  * User must double check that the code they have checked out is in working order. Highly recommended to run on a single record, then a large batch, before running on entire set of records.
  * DB connections are often dropped, so if you are running an update on every record in the bib service, there is a high chance that the update will stop partway through. 

## Scenarios

### Updating records from a specific holding location or customer code
  - Run `./identify-ids-by-es-query.js` using a query similar to `./example-queries/item-property-match.json`. Use the output ids to run a `bulk-index.js` job. Depending on what you are updating, you may wish to run it with a csv prepopulated with recap customer codes to avoid hitting the SCSB API. 
    
### Adding a new subfield to an indexing rule
This kind of update requires using the `bulk-index.js` script.
#### Updated rule affects every bib (e.g. title, author, format)
  - run a `bulk-index.js` job with no limit, probably using the `updateOnly`, `skipApiPrefetch`, and `skipDbPrefetch` options (see documentation for details on bib update workflow)
#### Updated rule affects a large number of bibs 
This case has two possible sources of bib ids:
  1. Elastic search 
    - If presence of a specific marc field is not relevant, and presence of a property is sufficient reason to reindex, this is the move. After querying Elastic Search, use those id's to populate a CSV that will passed along to the script.
    - Example: The subfields that comprise `description` are going to be split into two new properties. Any bib with a `description` in the index should be updated. Specific knowledge of marc fields is unneccesary, so an ES query is appropriate.
      - See `./example-queries/bib-property-multi-match.json` documentation for an example script
  2. Bib service
    - A single marc field rule has been changed for a property that is comprised of multiple marc fields, AND that single marc field is not on every bib
    - Example: `subjectLiteral` ES property contains many 6xx fields. If recent updates only apply to uncommon 690 fields, every bib does not need to be updated, just the ones with 690 fields. Querying the bib service is the way to go here since the marc field is relevant.
    - Example of SQL query for ids for bibs with a 690 marc field present, the output of which is written to a CSV:
    ```
    \COPY (SELECT DISTINCT id, nypl_source FROM bib, json_array_elements(bib.var_fields::json) j690 WHERE jsonb_typeof(bib.var_fields) = 'array' AND j690->>'marcTag' = '690') TO '~/690_bibs.csv' WITH CSV DELIMITER ',' HEADER;

## EC2
If you are reindexing or updating more than a million or so records, it is a good idea to run the script from our dedicated server in AWS for long-running scripts. See documentation [here](https://docs.google.com/document/d/1A2PQt32tMmLRyI7KcTsOtheFMVvROt3akGdXuSXxwYQ/edit?tab=t.0#heading=h.njlhfusam8s0) for instructions.
