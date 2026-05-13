/**
 *
 * Copies the settings and mappings from the QA index and uses them to create
 * a new production index, then triggers a reindex from the old prod index to the new prod index.
 *
 * Usage: node scripts/copy-qa-index-to-prod.js
 *
 */
const { client, _resetClient } = require('../lib/elastic-search/client')
const dotenv = require('dotenv')
dotenv.config({ path: './config/qa.env' })
const readline = require('node:readline')

const buildIndexPostBody = (indexName, settings, mappings) => {
  const body = {
    index: indexName,
    body: {
      settings: {
        index: {
          refresh_interval: settings.refresh_interval,
          analysis: settings.analysis
        }
      },
      mappings: { properties: mappings }
    }
  }
  return body
}

const theThing = async (doIt = false) => {
  // Establish qa client
  const qaIndex = process.env.ELASTIC_RESOURCES_INDEX_NAME
  const esQa = await client()
  const settings = await esQa.indices.getSettings({ index: qaIndex })
  const mappingsResp = await esQa.indices.getMapping({ index: qaIndex })
  const mappings = mappingsResp.body[qaIndex].mappings.properties

  // Reset client and load prod config
  _resetClient()
  dotenv.config({ path: './config/production.env', override: true })
  const prodIndex = process.env.ELASTIC_RESOURCES_INDEX_NAME

  // Build prod index
  const esProd = await client()
  const newIndexName = `resources-prod-${new Date(Date.now()).toISOString().split('T')[0]}`
  const body = buildIndexPostBody(newIndexName, settings.body[qaIndex].settings.index, mappings)
  console.log(body)
  if (doIt) {
    console.log(`Building new prod index at ${newIndexName}`)
    await esProd.indices.create(body)
    console.log('Successfully created new prod index at ', newIndexName)
    const reindexRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    reindexRl.question('Copy old index contents to new index? Only "yes" will trigger reindex... ', async answer => {
      if (answer === 'yes') {
        console.log(`Copying contents of ${prodIndex} to ${newIndexName}`)
        const resp = await esProd.reindex({ waitForCompletion: false, body: { source: { index: prodIndex }, dest: { index: newIndexName } } })
        console.log(`Started reindex task #${resp.body.task}`)
      } else console.log('Only yes will trigger reindex. Goodbye!')
      reindexRl.close()
    })
  } else {
    console.log('Prepared body but DID NOT POST to ', newIndexName)
    console.dir(body, { depth: null })
  }
}

theThing()
