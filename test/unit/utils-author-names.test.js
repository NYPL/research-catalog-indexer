const expect = require('chai').expect

const authorNamesUtils = require('../../lib/utils/author-names')

describe('utils/author-names', () => {
  describe('normalizeAuthorName', () => {
    it('reverses a variety of author names', () => {
      expect(authorNamesUtils.normalizeAuthorName('Lastname, Firstname'))
        .to.deep.equal(['Firstname Lastname'])
      expect(authorNamesUtils.normalizeAuthorName('Lastname, Firstname, 1979-'))
        .to.deep.equal(['Firstname Lastname'])
      expect(authorNamesUtils.normalizeAuthorName('Lastname-hyphenated, Firstname, 1979-'))
        .to.deep.equal(['Firstname Lastname-hyphenated'])
      expect(authorNamesUtils.normalizeAuthorName('Milne, A. A. (Alan Alexander), 1882-1956.'))
        .to.deep.equal(['A. Milne', 'A. A. Milne'])
      expect(authorNamesUtils.normalizeAuthorName('Milne, Alan A., 1882-1956.'))
        .to.deep.equal(['Alan Milne', 'Alan A. Milne'])
      expect(authorNamesUtils.normalizeAuthorName('Milne, A., 1882-1956.'))
        .to.deep.equal(['A. Milne'])
      expect(authorNamesUtils.normalizeAuthorName('Milne, AA, 1882-1956.'))
        .to.deep.equal(['AA Milne'])
      expect(authorNamesUtils.normalizeAuthorName('Milne, A A, 1882-1956.'))
        .to.deep.equal(['A Milne', 'A A Milne'])
      expect(authorNamesUtils.normalizeAuthorName('Mozart, Wolfgang Amadeus, 1756-1791'))
        .to.deep.equal(['Wolfgang Mozart', 'Wolfgang Amadeus Mozart'])
      expect(authorNamesUtils.normalizeAuthorName('Beethoven, Ludwig van, 1770-1827.'))
        .to.deep.equal(['Ludwig Beethoven', 'Ludwig van Beethoven'])
      expect(authorNamesUtils.normalizeAuthorName('Delibes, Léo, 1836-1891.'))
        .to.deep.equal(['Léo Delibes'])

      // No change to unsupported patterns:
      expect(authorNamesUtils.normalizeAuthorName('Lastname')).to.deep.equal(['Lastname'])
      expect(authorNamesUtils.normalizeAuthorName('Big long company name'))
        .to.deep.equal(['Big long company name'])
      expect(authorNamesUtils.normalizeAuthorName('Voltaire, 1694-1778.'))
        .to.deep.equal(['Voltaire, 1694-1778.'])
      expect(authorNamesUtils.normalizeAuthorName('WNYC (Radio station : New York, N.Y.)'))
        .to.deep.equal(['WNYC (Radio station : New York, N.Y.)'])

      // FIXME Unfortunately, we don't support this diacritic style for some reason:
      expect(authorNamesUtils.normalizeAuthorName('Dvořák, Antonín, 1841-1904.'))
        .to.deep.equal(['Dvořák, Antonín, 1841-1904.'])

      // Multiple surnames:
      expect(authorNamesUtils.normalizeAuthorName('García Márquez, Gabriel, 1927-2014.'))
        .to.deep.equal(['Gabriel García Márquez'])

      // Note that, in order to support authors with multiple surnames, we may
      // sometimes normalize poorly (but not adversely):
      expect(authorNamesUtils.normalizeAuthorName('Big long company name, with commas'))
        .to.deep.equal([
          'with Big long company name',
          'with commas Big long company name'
        ])
      expect(authorNamesUtils.normalizeAuthorName('Louis XVI, King of France, 1754-1793.'))
        .to.deep.equal([
          'King Louis XVI',
          'King of Louis XVI',
          'King of France Louis XVI'
        ])
      expect(authorNamesUtils.normalizeAuthorName('Merce Cunningham Dance Foundation, donor.'))
        .to.deep.equal(['donor Merce Cunningham Dance Foundation'])
    })
  })

  describe('withoutDates', () => {
    it('removes dates from author string', () => {
      expect(authorNamesUtils.withoutDates('Lastname'))
        .to.equal('Lastname')
      expect(authorNamesUtils.withoutDates('Lastname, firstname'))
        .to.equal('Lastname, firstname')
      expect(authorNamesUtils.withoutDates('Lastname, firstname, 1979-2024'))
        .to.equal('Lastname, firstname')
      expect(authorNamesUtils.withoutDates('Lastname, firstname m. m., 1979-2024'))
        .to.equal('Lastname, firstname m. m.')
      expect(authorNamesUtils.withoutDates('Dvořák, Antonín, 1841-1904.'))
        .to.equal('Dvořák, Antonín')
      expect(authorNamesUtils.withoutDates('Louis XVI, King of France, 1754-1793.'))
        .to.equal('Louis XVI, King of France')
      expect(authorNamesUtils.withoutDates('Lastname-hyphenated, Firstname, 1979-'))
        .to.equal('Lastname-hyphenated, Firstname')
      // We say "dates", but really it's about stripping anything after the name:
      expect(authorNamesUtils.withoutDates('Lastname, firstname, other stuff'))
        .to.equal('Lastname, firstname')
      // Support mononyms:
      expect(authorNamesUtils.withoutDates('Cher, 1946-')).to.equal('Cher')
      expect(authorNamesUtils.withoutDates('Gurudatta, 1894-1989'))
        .to.equal('Gurudatta')
      expect(authorNamesUtils.withoutDates('Lastname, 1234'))
        .to.equal('Lastname')
      expect(authorNamesUtils.withoutDates('Lastname, 1234, other stuff'))
        .to.equal('Lastname')
      // We identify dates by 4 digits, so this isn't stripped:
      expect(authorNamesUtils.withoutDates('Lastname, 123'))
        .to.equal('Lastname, 123')
    })
  })

  describe('nameIsRedundant', () => {
    it('returns true if name is redundant', () => {
      const names = ['Doe, Jane', 'Dickens, Charles, 1812-1870']

      expect(authorNamesUtils.nameIsRedundant('Dickens, Charles', names))
        .to.equal(true)
      expect(authorNamesUtils.nameIsRedundant('Doe, Jane', names))
        .to.equal(true)
    })

    it('returns false if name is not matched', () => {
      const names = ['Doe, Jane', 'Dickens, Charles, 1812-1870']

      expect(authorNamesUtils.nameIsRedundant('Dickens, Charlesregard', names))
        .to.equal(false)
      expect(authorNamesUtils.nameIsRedundant('Shelley, Mary', names))
        .to.equal(false)
    })
  })

  describe('trimTrailingPeriod', () => {
    it('removes trailing period', () => {
      expect(authorNamesUtils.trimTrailingPeriod('Doe, Jane'))
        .to.equal('Doe, Jane')
      expect(authorNamesUtils.trimTrailingPeriod('Doe, Jane.'))
        .to.equal('Doe, Jane')

      // Assert meaningful periods not removed:
      expect(authorNamesUtils.trimTrailingPeriod('Michael K.'))
        .to.equal('Michael K.')
      expect(authorNamesUtils.trimTrailingPeriod('Michael k.'))
        .to.equal('Michael k.')

      // Assert period following author dates removed:
      expect(authorNamesUtils.trimTrailingPeriod('Doyle, Arthur Conan, 1859-1930.'))
        .to.equal('Doyle, Arthur Conan, 1859-1930')
    })
  })
})
