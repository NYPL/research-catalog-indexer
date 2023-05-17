/**
 *  Given an array of entities, returns an array of strings with packed values.
 */
exports.pack = (entities) => {
  if (!Array.isArray(entities)) return null
  return entities.map((entity) => [entity.id, entity.label].join('||'))
}
