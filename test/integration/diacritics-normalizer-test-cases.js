// Each group below represents a single real-world name, spelled with
// Unicode diacritics encoded in different (but visually/semantically
// identical) composition forms:
//   - NFC: "precomposed" - a single codepoint represents the base letter
//     + diacritic (e.g. "\u1e25" = LATIN SMALL LETTER H WITH DOT BELOW)
//   - NFD: "decomposed" - the base letter and diacritic are separate
//     codepoints (e.g. "h" + "\u0323" COMBINING DOT BELOW)
//
// Different cataloging/vendor pipelines may produce either form for the
// "same" string, so the index's normalizers/analyzers must treat them as
// equivalent. See lib/elastic-search/index-config/index-settings.js
// (icu_normalizer_char_filter).
//
// Confirmed against production (platform.nypl.org) on 2026-10-08: the
// precomposed (NFC) spelling of this contributor appears on e.g.
// res:b23575961 creatorLiteral, while the decomposed (NFD) spelling
// appears on e.g. res:b15285842 creatorLiteral.
// `filters[contributorLiteral][0]=\u1e7ealden...` (NFC) matched only 3 of
// the 18 bibs found via `q=...&search_scope=contributor`, silently missing
// the 15 bibs spelled with the NFD form.
const waldenNameVariants = {
  'NFC (precomposed)': '\u1e7ealden, Mosheh Mena\u1e25em Mendil ben Aharon',
  'NFD (decomposed)': 'V\u0323alden, Mosheh Menah\u0323em Mendil ben Aharon'
}

// Confirmed against production (platform.nypl.org) on 2026-10-08: both
// spellings of this contributor are indexed, under different bib records,
// e.g.:
//   res:b17965729 creatorLiteral: "Dim\u00f3pulos, Mariana" (NFC)
//   res:cb7035340 creatorLiteral: "Dimo\u0301pulos, Mariana" (NFD)
// `filters[contributorLiteral][0]=Dim%C3%B3pulos%2C%20Mariana` (NFC) only
// matched res:b17965729, silently missing res:cb7035340.
const dimopulosNameVariants = {
  'NFC (precomposed)': 'Dim\u00f3pulos, Mariana',
  'NFD (decomposed)': 'Dimo\u0301pulos, Mariana'
}

module.exports = {
  waldenNameVariants,
  dimopulosNameVariants
}
