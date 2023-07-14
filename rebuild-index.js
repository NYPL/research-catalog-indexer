const { client } = require('./lib/elastic-search/client')
const logger = require('./lib/logger')
const { schema } = require('./lib/elastic-search/index-schema.js')
const aws = require('aws-sdk')
const dotenv = require('dotenv')

dotenv.config({ path: './config/qa.env' })

const prepareResourcesIndex = async (indexName, deleteIfExists) => {
  // default deleteIfExists=false
  deleteIfExists = (typeof deleteIfExists) === 'undefined' ? false : deleteIfExists
  logger.debug('Invoking prepareResourcesIndex on ' + indexName)
  const esClient = await client()

  const ensureDoesNotExist = async (index) => {
    logger.debug('ensureDoesNotExist: ' + index + ' (deleteIfExists=' + deleteIfExists + ')')
    return esClient.indices.exists({ index }).then((exists) => {
      logger.info('Preparing ' + index + ', which ' + (exists ? 'does' : 'does not') + ' exist')
      if (exists) {
        if (deleteIfExists) logger.info('Deleting existing ' + index)
        // Only actually delete it if told to
        if (deleteIfExists) return esClient.indices.delete({ index })
        else throw new Error('Index ' + index + ' already exists. `deleteIfExists` is false, so aborting. Use --rebuild on cmd line')
      } else {
        // If it doesn't exist, proceed:
        return Promise.resolve()
      }
    })
  }

  // After ensuring it's deleted..
  return ensureDoesNotExist(indexName).then(() => {
    // Create it:
    logger.info('Creating ' + indexName)
    return esClient.indices.create({
      index: indexName,
      body: {
        settings: {
          number_of_shards: 3,
          analysis: {
            filter: {
              yearStrip: {
                type: 'pattern_replace',
                pattern: '[0-9]',
                replacement: ''
              },
              truncate_50: {
                type: 'truncate',
                length: 50
              },
              en_stop_filter: {
                type: 'stop',
                stopwords: '_english_'
              },
              en_stem_filter: {
                type: 'stemmer',
                name: 'minimal_english'
              },
              spanish_stop: {
                type: 'stop',
                stopwords: '_spanish_'
              },
              icu_folding_filter: {
                type: 'icu_folding'
              },
              ascii_folding_filter: {
                type: 'asciifolding',
                preserve_original: true
              },
              unique_stem: {
                type: 'unique',
                only_on_same_position: true
              },
              strip_punctuation_filter: {
                type: 'pattern_replace',
                pattern: '[\']',
                replacement: ''
              }
              /*
               * This addresses a specific complaint, but doesn't address
               * core issue, so leaving it here as a note.
              synonym_filter: {
                type: 'synonym',
                synonyms: [
                  'lau, l au, la\'u'
                ]
              }
              */
            },
            analyzer: {
              default: {
                type: 'snowball',
                language: 'English'
              },
              folding: {
                tokenizer: 'icu_tokenizer',
                filter: ['lowercase', 'icu_folding_filter', 'en_stop_filter', 'keyword_repeat', 'en_stem_filter', 'unique_stem'],
                char_filter: [
                  'extended_punctuation_char_filter'
                ]
              },
              lowercase_keyword_truncated: {
                type: 'custom',
                tokenizer: 'keyword',
                filter: ['lowercase', 'truncate_50']
              }
            },
            tokenizer: {
              edgeNgram_tokenizer: {
                type: 'edgeNGram',
                min_gram: '2',
                max_gram: '5',
                token_chars: ['letter']
              }
            },
            char_filter: {
              extended_punctuation_char_filter: {
                type: 'mapping',
                mappings: [
                  // It's unclear what version of the ICU Analysis plugin is
                  // in use in our ES 5.1 domain, but some character foldings
                  // don't seem to be working
                  // This one for example (https://unicode-table.com/en/02BC/ )
                  // should map to \u0080 based on ICU4J source circa 2014, but
                  // icu_tokenizer doesn't touch it.
                  '\u02BC => \u0027'
                ]
              }
            }
          }
        }
      } // body
    }).then(() => {
      logger.info('Putting new ' + indexName + ' mapping')
      const body = {
        resource: {
          // Disable "dynamic mapping"; Throw error if an attempt is made to
          // index a property that doesn't exist in the mapping
          // https://www.elastic.co/guide/en/elasticsearch/reference/5.1/dynamic.html
          dynamic: 'strict',

          properties: schema()
        }
      }
      return esClient.indices.putMapping({ index: indexName, type: 'resource', body })
    })
  })
}

const init = async () => {
  aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'nypl-digital-dev' })
  // Create new index. Second param, deleteIfExists, ensures that the new index will overwrite
  // and old one with the same name.
  await prepareResourcesIndex(process.env.ELASTIC_RESOURCES_INDEX_NAME, true)
  console.log(`Dropped and recreated ${process.env.ELASTIC_RESOURCES_INDEX_NAME}`)
}

init()
