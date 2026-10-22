## Purpose
This app manipulates MarcInJson records, writing the result to the Elastic Search index that powers the [Discovery API](https://github.com/NYPL/discovery-api). It was built to replace the trifecta Discovery Store Poster (aka PCDM store updater)/Discovery API Indexer/Discovery Hybrid Indexer.

## Contributing

This repo uses the [Main-QA-Production](https://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#main-qa-production)
1. Create a feature branch off `main`. 
2. Open a PR against `main`.
   - The PR must include an updated changelog and package version, merge will be blocked without these
   - Git will automatically tag the new version you merge into `main`, and QA index updates will be initiated on `main`.
3. Merge `main` > `qa`.
   - Production index updates should be initiated on `qa`.
4. After QA signoff, merge `qa` > `production`.

Merging into `main` should indicates it's dev-approved, ready for other developers to pull it down into their own feature work, and can be safely included in the next QA reindex.

### Changelog

This project maintains a [CHANGELOG](./CHANGELOG.md).

- All PRs should include a relevant CHANGELOG entry with a brief summary of the PR's changes and the relevant ticket (if there is one) in the `Prerelease` section
- When merging into `main`, update the `Prerelease` section with the next version and the current date (e.g., `## [1.0.1] - 2026-10-15`). Update the `package.json` version as well
- To skip CHANGELOG or versioning enforcement, add the `skip-changelog`/`skip-versionbump` label to your PR. Generally, avoid this (hot fixes need to be documented even if you're in a rush) 

Example format:
```
## Prerelease

- Removed every letter Y (SCC-0123)
- Updated parallels for contributor fields (SCC-1234)
```

## Deployment

This app uses Terraform for deployment. Code pushed to `qa` and `production` triggers deployments to `qa` and `production`, respectively.

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

For example, to reindex the first 10K NYPL bibs in QA:
```
node scripts/bulk-index.js --envfile config/qa-bulk-index.env --type bib --hasMarc 001 --nyplSource sierra-nypl --limit 10000
```

To enable NewRelic reporting during bulk-indexing:
 - Install the NR agent:
   - Follow the "guided install" link on [this page](https://docs.newrelic.com/docs/new-relic-solutions/get-started/intro-new-relic/)
   - Follow instructions for your OS (e.g. for MacOS, the procedure is a long curl-to-bash command)
 - Invoke like: `source ./scripts/decrypt-newrelic-key.sh; DISABLE_CIRC_DELETE=true node scripts/bulk-index.js --envfile config/qa-bulk-index.env --type bib --hasMarc 001 --nyplSource sierra-nypl --limit 10000` (Note that NR breaks deletes in the current elasticsearch client, so for now we have to add `DISABLE_CIRC_DELETE=true` as above.)
 - While running, view live data at [NR > RC > Transactions](https://one.newrelic.com/nr1-core/apm-features/transactions/MTIxMzM0fEFQTXxBUFBMSUNBVElPTnwxNDg2MzQ3NzM5?account=121334&duration=1800000&state=34c7b09b-f7f1-01ef-e050-200414839809)
