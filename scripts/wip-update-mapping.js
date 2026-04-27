const { client } = require('../lib/elastic-search/client')
const { propertyTemplates } = require('../lib/elastic-search/index-schema')
require('dotenv').config({ path: './config/qa.env' })

const updateProperties = ['series', 'seriesAddedEntry', 'seriesUniformTitle']
const desiredMapping = propertyTemplates.textWithFilterableKeyword
const index = process.env.ELASTIC_RESOURCES_INDEX_NAME

const updateMappings = (mappings) => {
  updateProperties.forEach((prop) => {
    mappings['parallel' + prop[0].toLocaleUpperCase() + prop.slice(1)] = desiredMapping
    mappings[prop] = desiredMapping
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
  const indexName = `resources-${new Date(Date.now()).toISOString().split('T')[0]}`
  const body = buildIndexPostBody(indexName, settings.body[index].settings.index, mappings)
  console.log(body)
  if (doIt) {
    const createResp = await es.indices.create(body)
    console.log('successfully created new index at ', indexName)
    console.log(createResp)
  } else {
    console.log('Prepared body but DID NOT POST to ', indexName)
    console.dir(body, { depth: null })
  }
}

theThing()
