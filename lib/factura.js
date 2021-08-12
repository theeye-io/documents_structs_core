const Documento = require('./documento')

class Factura extends Documento {
  constructor (doc) {
    super (doc)
    this.label = 'factura'
  }

  initializeClassificationRulez () {
    // estos patrones son para identificar el formato de la estructura
    this.classificationRulez = this.createRulez([
      {
        label: 'codigoDocumento',
        pattern: /(?:cod\.|c(?:ó|o)digo:?|c(?:o|ó)digo nro\.) ?(0{0,}(?:1|11|19|51))\b/i
      },
      {
        label: 'tipoDocumento',
        pattern: /\bfactura\b/i
      }
    ])
  }
}

module.exports = Factura
