const toJson = (model) => {
  const methods = _publicMethods(model)
  const objectToJson = methods.reduce((obj, meth) => {
    obj[meth] = model[meth]()
    return obj
  }, {})
  return JSON.stringify(objectToJson)
}

const _getAllMethods = (obj) => {
  let props = []

  do {
    const l = Object.getOwnPropertyNames(obj)
      .concat(Object.getOwnPropertySymbols(obj).map(s => s.toString()))
      .sort()
      .filter((p, i, arr) =>
        // only the methods
        typeof obj[p] === 'function' &&
        // not the constructor
        p !== 'constructor' &&
        // not overriding in this prototype
        (i === 0 || p !== arr[i - 1]) &&
        // not overridden in a child
        props.indexOf(p) === -1
      )
    props = props.concat(l)
  }
  while (
    // walk-up the prototype chain
    (obj = Object.getPrototypeOf(obj)) &&
    // not the the Object prototype methods (hasOwnProperty, etc...)
    Object.getPrototypeOf(obj)
  )

  return props
}

const _publicMethods = (obj) => {
  return _getAllMethods(obj)
    .filter((method) => !/^(_|toJson$)/.test(method))
}

module.exports = {
  toJson,
  internal: { _getAllMethods, _publicMethods }
}
