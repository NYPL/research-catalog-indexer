## Purpose
This app manipulates MarcInJson records, writing the result to the Elastic Search index that powers the [Discovery API](https://github.com/NYPL/discovery-api). It was built to replace the trifecta Discovery Store Poster (aka PCDM store updater)/Discovery API Indexer/Discovery Hybrid Indexer.
## Contributing

This repo uses the [Development-QA-Main Git Workflow](https://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#development-qa-main)

## Deployment

This app uses Travis-CI and terraform for deployment. Code pushed to `qa` and `main` trigger deployments to `qa` and `production`, respectively.

## Testing

To run several tests of this app's ability to handle various Kinesis events and write relevant ES documents:

```
nvm use
npm test
```

