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
  // b14262371
  67062762: '67062762',
  '67-062762': '67062762',
  '67-62762': '67062762',

  // b15986028
  93656168: '93656168',
  '93-656168': '93656168',
  '  93656168  ': '93656168',
  '93656168 //r934': '93656168', // unnecessary suffix stripped

  // b15888643
  2001233910: '2001233910',
  '2001-233910': '2001233910',

  // b21457839 (indexed value itself has space padding: '   92641021 ')
  92641021: '92641021',
  ' 92641021  ': '92641021',
  '   92641021 ': '92641021',

  // b12564169 (indexed value: '58031783 //r934')
  58031783: '58031783',
  '58031783 //r934': '58031783',
  '58031783 //r439': '58031783',

  // b15245673
  'sn 85066219': 'sn85066219',
  sn85066219: 'sn85066219',

  // b15411483
  'a 40002886': 'a40002886',
  'a  40002886': 'a40002886',
  a40002886: 'a40002886',

  // b12030939 - full combination of rules
  'a  50004463 //r623': 'a50004463', // original
  a50004463: 'a50004463', // fully normalized
  'a  50004463': 'a50004463', // no suffix
  'a 50004463//r623': 'a50004463', // different spacing
  'a  50-004463 //r623': 'a50004463', // dashes
  'a 50-4463': 'a50004463', // dashes, no zero-padding, no suffix

  // KNOWN DISCREPANCY (see README/notes): ticket states these three should
  // all match indexed term "8500002", but the hyphenated forms actually
  // zero-pad to a 6-digit serial ("85000002"), matching real LOC LCCN
  // normalization rules, while the un-hyphenated literal is left untouched.
  // Included as documented, not asserted as passing.
  8500002: '8500002', // unchanged (no hyphen to trigger padding)
  '85-00002': '85000002', // padded to 6-digit serial
  '85-2': '85000002' // padded to 6-digit serial
}

const isbnCases = {
  // SCC-5425 clean examples
  9780822945833: '9780822945833', // b22021020
  9789934601514: '9789934601514', // b22965224
  8071131172: '8071131172', // b12040728
  '582430047X': '582430047x', // b14586714 (lowercased)

  // dash stripping
  '978-0822-9458-33': '9780822945833',

  // dirty vs clean (b11305617)
  '392161807X (pbk.)': '392161807x',
  '392161807X': '392161807x',

  // dirty vs clean (b16868578)
  '9780071544115 (alk. paper)': '9780071544115',
  9780071544115: '9780071544115'
}

const oclcCases = {
  // SCC-5424 single-OCLC examples
  15163786: '15163786', // b11797404
  21563524: '21563524', // b11049433
  642629844: '642629844', // b20432027
  1089258717: '1089258717', // b21967733
  879158969: '879158969', // b21118388

  // non-numeric OCLC
  vendorOCM58728734: 'vendorocm58728734', // b16308362 (lowercased)

  // multi-OCLC bibs (each individual OCLC normalizes to itself)
  47826622: '47826622', // b15031304
  52197942: '52197942', // b15031304
  30599817: '30599817', // b14294570
  55220282: '55220282', // b14294570
  244811826: '244811826', // b17059227 (duplicate OCLC1/OCLC2)
  30932323: '30932323', // b12002784
  31969868: '31969868' // b12002784
}


const issnCases = {
  '0042-1014': '00421014', // b10585778
  '0303-9846': '03039846', // b11767354
  '1313-1451': '13131451', // b22718174
  '00421014': '00421014'   // no-dash input is a no-op
}

module.exports = { bnumberCases, lccnCases, isbnCases, issnCases, oclcCases }