const BBox = require('./bbox')
const Sections = require('./sections')
const Tables = require('./tables')
const Annotations = require('./annotations')

module.exports = Object.assign({}, BBox, Sections, Tables, Annotations)
