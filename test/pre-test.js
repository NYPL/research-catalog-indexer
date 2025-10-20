const EsBib = require('../lib/es-models/bib')
const SierraBib = require('../lib/sierra-models/bib')
const bibs = {
  b1: require('./fixtures/bib-10001936.json'),
  b2: require('./fixtures/bib-11606020.json'),
  b3: require('./fixtures/bib-hl990000453050203941.json')
}

async function runTest () {
  Object.keys(bibs).forEach(async function (bib) {
    console.log('bib: ', bib)
    const bibValue = bibs[bib]
    const sierraBib = new SierraBib(bibValue)
    const esBib = new EsBib(sierraBib)
    console.log('title: ', esBib.title())
    console.log('parallelTitle', esBib.parallelTitle())
    const uri = esBib.uri()
    console.log('uri: ', uri)
    console.log('creatorLiteral: ', esBib.creatorLiteral())
    console.log('parallelCreatorLiteral: ', esBib.parallelCreatorLiteral())
    console.log('contentsTitle: ', esBib.contentsTitle())
    console.log('contributorLiteral: ', esBib.contributorLiteral())
    console.log('contributor_sort: ', esBib.contributor_sort())
    console.log('parallelContributorLiteral: ', esBib.parallelContributorLiteral())
    console.log('numItems: ', esBib.numItems())
    console.log('type: ', esBib.type())
    console.log('nyplSource', esBib.nyplSource())
  })
}

runTest()
