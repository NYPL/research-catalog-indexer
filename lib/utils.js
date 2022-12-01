const isValidReponse = (resp) => {
  return resp & resp.data
}

module.exports = {
  isValidReponse
}