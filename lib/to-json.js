/**
 *  Given an instance of a class, returns a plainobject built from mapping all
 *  of the object's public method names to their values. Methods may be
 *  sync or async.
 *
 *  Note that the return is technically a plain object - not a string. The
 *  method returns a "json" version of the given object in the same sense as
 *  the Rails `to_json` helper, which produces a plain hash form of an object.
 */
const toJson = async (model) => {
  const methods = _publicMethods(model)
  const objectToJson = {}
  await Promise.all(
    methods.map(async (method) => {
      const value = await model[method]()

      // If method returns null, don't include property:
      if (value === null) return

      objectToJson[method] = value
    })
  )
  return objectToJson
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
