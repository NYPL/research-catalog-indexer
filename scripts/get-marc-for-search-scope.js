const { searchScopes, mappings } = require('./mapping')

const theThing = () => {
  const scopes = Object.keys(searchScopes)
  scopes.map((scope) => {
    console.log('\nSearch Scope:', scope.toLocaleUpperCase())
    const fields = searchScopes[scope].fields
      .map((field) =>
        field.match(/(\w+)[.|^]?/)[1])
    return fields.forEach(field => {
      console.log('\n', 'elastic search query', field.toLocaleUpperCase() + ':')
      if (field.startsWith('parallel')) {
        console.log(' is a parallel field. Check corresponding primary field\'s 880 linked fields')
        return
      }
      if (!mappings[field]) {
        console.log(' is exceptional. Ask an engineer')
        return
      }

      mappings[field].paths.forEach((path) => {
        const { marc, subfields, notes } = path
        if (marc && subfields) {
          console.log('\tMarc tag ' + marc + '\n' + '\tsubfields:', subfields.join(','))
        } else if (marc) {
          console.log('\tmarg tag', marc)
        } else {
          console.log('\tnotes:', notes)
        }
      })
    })
  })
}

theThing()
