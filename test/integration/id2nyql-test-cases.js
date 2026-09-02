// Map of EXPECTED_INPUT -> EXPECTED_OUTPUT for each identifier normalizer,
// derived from examples in SCC-5582, SCC-5432, SCC-5425, SCC-5426,
// SCC-5424, and SCC-5443.

const bnumberCases = {
  // SCC-5443 (target bib: b11947770)
  b11947770: '11947770',
  cb11947770: '11947770',
  PB11947770: '11947770',
  b119477701: '11947770',
  11947770: '11947770',
  119477701: '11947770'
}

const lccnCases = {
 
  '67-062762': '67062762',
  '67-62762': '67062762',

 
  '93-656168': '93656168',
  '  93656168  ': '93656168',
  '93656168 //r934': '93656168', // unnecessary suffix stripped

 
  '2001-233910': '2001233910',

 
  ' 92641021  ': '92641021',
  '   92641021 ': '92641021',

 
  'sn 85066219': 'sn85066219',
  sn85066219: 'sn85066219',

 
  'a 40002886': 'a40002886',
  'a  40002886': 'a40002886',

 
  'a  50004463 //r623': 'a50004463', // original
  a50004463: 'a50004463', // fully normalized
  'a  50004463': 'a50004463', // no suffix
  'a 50004463//r623': 'a50004463', // different spacing
  'a  50-004463 //r623': 'a50004463', // dashes
  'a 50-4463': 'a50004463', // dashes, no zero-padding, no suffix
  8500002: '8500002', // unchanged (no hyphen to trigger padding)
  '85-00002': '85000002', // padded to 6-digit serial
  '85-2': '85000002' // padded to 6-digit serial
}

const isbnCases = {
  8071131172: '8071131172',
  '582430047X': '582430047x',

  // dash stripping
  '978-0822-9458-33': '9780822945833',

  // dirty vs clean (b11305617)
  '392161807X (pbk.)': '392161807x',

  // dirty vs clean (b16868578)
  '9780071544115 (alk. paper)': '9780071544115',
  9780071544115: '9780071544115'
}

const oclcCases = {
  // non-numeric OCLC
  vendorOCM58728734: 'vendorocm58728734'
}

const issnCases = {
  '0042-1014': '00421014',
  '0303-9846': '03039846',
  '1313-1451': '13131451',
  '00421014': '00421014' // no-dash input is a no-op
}

module.exports = { bnumberCases, lccnCases, isbnCases, issnCases, oclcCases }
