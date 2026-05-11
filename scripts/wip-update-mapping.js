const { client } = require('../lib/elastic-search/client')
const { propertyTemplates } = require('../lib/elastic-search/index-schema')
require('dotenv').config({ path: './config/qa.env' })
const readline = require('node:readline')

const updateProperties = ['series', 'seriesAddedEntry', 'seriesUniformTitle', 'placeOfPublication', 'subjectLiteral']
const index = process.env.ELASTIC_RESOURCES_INDEX_NAME

const updateMappings = (mappings) => {
  updateProperties.forEach((prop) => {
    let newMapping
    if (prop === 'subjectLiteral') newMapping = propertyTemplates.fulltextWithRawFoldedAndKLS
    else newMapping = propertyTemplates.textWithFilterableKeyword
    mappings[prop] = newMapping
  })
  return mappings
}

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
  const es = await client()
  const settings = await es.indices.getSettings({ index })
  const mappingsResp = await es.indices.getMapping({ index })
  const mappings = mappingsResp.body[index].mappings.properties
  updateMappings(mappings)
  const newIndexName = `resources-qa-${new Date(Date.now()).toISOString().split('T')[0]}`
  const body = buildIndexPostBody(newIndexName, settings.body[index].settings.index, mappings)
  console.log(body)
  if (doIt) {
    console.log(`Building new index at${newIndexName}`)
    await es.indices.create(body)
    console.log('successfully created new index at ', newIndexName)
    const reindexRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    reindexRl.question('copy old index contents to new index? Only "yes" will trigger reindex... ', async answer => {
      if (answer === 'yes') {
        console.log(`Copying contents of ${index} to˝ ${newIndexName}`)
        console.log(es.indices.getSettings)
        const resp = await es.reindex({ waitForCompletion: false, body: { source: { index }, dest: { index: newIndexName } } })
        console.log(`Started reindex task #${resp.body.task}`)
      } else console.log('only yes will trigger reindex. Goodbye!')
      reindexRl.close()
    })
  } else {
    console.log('Prepared body but DID NOT POST to ', newIndexName)
    console.dir(body, { depth: null })
  }
}

theThing(true)
