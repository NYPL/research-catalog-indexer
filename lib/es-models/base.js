const { sortableShelfMark } = require('../utils/shelfmark')
const { toJson } = require('../to-json')

class EsBase {
  /**
   *  Returns a sortable form of this.shelfMark() for those descendent models
   *  that implement it.
   */
  _sortableShelfMark () {
    if (!this.shelfMark) return null

    const shelfMark = this.shelfMark().shift()
    if (shelfMark) {
      // order by call number; Put these items first
      return ['a' + sortableShelfMark(this.shelfMark()[0])]
    } else {
      // Order by id if we have no call numbers, but make sure these items
      // go after items with call numbers
      return ['b' + this.uri()]
    }
  }

  /**
   *  All ES models are "jsonable", meaning they can be rendered as a
   *  plainobject by calling .toJson(). If any sub-models implement toJson,
   *  they will also be rendered as a plainobject.
   */
  async toJson () {
    // Apply to-json to this object:
    const plainObject = await toJson(this)
    // Recursively apply to-json to any child entity that implements toJson:
    await Promise.all(
      Object.entries(plainObject).map(async ([key, value]) => {
        // Handle case where ES model method returns a single ES model:
        if (value && value.toJson) {
          plainObject[key] = await value.toJson()
        // Handle case where ES model method returns an array of ES models:
        } else if (Array.isArray(value) && value.some((v) => v.toJson)) {
          plainObject[key] = await Promise.all(
            value.map((subModel) => subModel.toJson())
          )
        }
      })
    )
    return plainObject
  }
}

module.exports = EsBase
