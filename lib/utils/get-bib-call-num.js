/**
 * getBibCallNum
 * extracts the call number and call number path from a bib
 * @param {Object} object (an object representing a bib)
 * @returns {{ value: string, path: string}}
 */

exports.getBibCallNum = (object) => {
  if (!object) return
  // Callnum
  let callnum = null
  if (object.varField('852', ['h'])) callnum = object.varField('852', ['h'])[0]
  if (!callnum) callnum = object.callNumber
  return callnum
}
