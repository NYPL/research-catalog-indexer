import { loadNyplCoreData } from '../lib/load-core-data.js'

console.log('Initializing nypl-core-objects data for tests')
await loadNyplCoreData()
console.log('nypl-core-objects ready')
