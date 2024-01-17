## Purpose
This app manipulates MarcInJson records, writing the result to the Elastic Search index that powers the [Discovery API](https://github.com/NYPL/discovery-api). It was built to replace the trifecta Discovery Store Poster (aka PCDM store updater)/Discovery API Indexer/Discovery Hybrid Indexer.

## Contributing

This repo uses the [Main-QA-Production](https://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#main-qa-production)
1. Create feature branch off main
2. Compute next logical version and update README.md, CHANGELOG.md, package.json, etc.
3. Create PR against main
4. After merging the PR, git tag main with new version number.
5. Merge main > qa
6. After QC signoff, merge qa > production

## Deployment

This app uses Travis-CI and terraform for deployment. Code pushed to `qa` and `main` trigger deployments to `qa` and `production`, respectively.

## Testing

To run several tests of this app's ability to handle various Kinesis events and write relevant ES documents:

```
nvm use
npm test
```

### Local invocation
To run lambda locally, use this script:
```
sam local invoke --profile nypl-digital-dev -t sam.local.yml -e test/sample-events/b10001936.json
```

## Running

### Bulk Indexing

The bulk-indexer can be used to index lots of records at once by direct BibService SQL query.

For example, to reindex the first 10K NYPL bibs with marc 001 in QA:
```
node scripts/bulk-index.js --envfile config/qa-bulk-index.env --type bib --hasMarc 001 --nyplSource sierra-nypl --limit 10000
```

To enable NewRelic reporting during bulk-indexing:
 - Install the NR agent:
   - Follow the "guided install" link on [this page](https://docs.newrelic.com/docs/new-relic-solutions/get-started/intro-new-relic/)
   - Follow instructions for your OS (e.g. for MacOS, the procedure is a long curl-to-bash command)
 - Invoke like: `source ./scripts/decrypt-newrelic-key.sh; DISABLE_CIRC_DELETE=true node scripts/bulk-index.js --envfile config/qa-bulk-index.env --type bib --hasMarc 001 --nyplSource sierra-nypl --limit 10000` (Note that NR breaks deletes in the current elasticsearch client, so for now we have to add `DISABLE_CIRC_DELETE=true` as above.)
 - While running, view live data at [NR > RC > Transactions](https://one.newrelic.com/nr1-core/apm-features/transactions/MTIxMzM0fEFQTXxBUFBMSUNBVElPTnwxNDg2MzQ3NzM5?account=121334&duration=1800000&state=34c7b09b-f7f1-01ef-e050-200414839809)
