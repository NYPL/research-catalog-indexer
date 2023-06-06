const NyplSourceMapper = require('./nypl-source-mapper')

/*
 * Get "uri" form of bib/item identifier
 *
 * e.g.
 *  - uriForRecordIdentifier('sierra-nypl', '1234')
 *    => 'i1234'
 *  - uriForRecordIdentifier('recap-cul', '9876')
 *    => 'ci9876'
 *  - uriForRecordIdentifier('sierra-nypl', '1234', 'bib')
 *    => 'b1234'
 *  - uriForRecordIdentifier('recap-cul', '9876', 'bib')
 *    => 'cb9876'
 */
const uriForRecordIdentifier = async function (nyplSource, id, type = 'item') {
  const nyplSourceMapping = await NyplSourceMapper.nyplSourceMapping()

  if (!nyplSourceMapping[nyplSource]) return null

  return nyplSourceMapping[nyplSource][`${type}Prefix`] + id
}

module.exports = {
  uriForRecordIdentifier
}
