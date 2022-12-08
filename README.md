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

