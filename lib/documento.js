const Rule = require('./rule')
const Tables = require('./tables')
const Helpers = require('./helpers')

class Documento {
  /**
   *
   * @param {SmartDocument} doc
   *
   */
  constructor (doc) {
    this.label = 'documento'
    this.doc = doc
    this.initializeEntityRulez()
    this.initializeClassificationRulez('unknowndoc')
    this.entities

    this.classification = false
    this.type = 'generic'
  }

  initializeEntityRulez () {
    let smartRulez = this.extendEntitiesSmartRuleSet()

    let rulez = []
    for (let rule in smartRulez) {
      rulez.push( smartRulez[rule] )
    }

    this.entityRulez = this.createRulez(rulez)
  }

  initializeClassificationRulez () {
    // estos patrones son para identificar el formato de la estructura
    this.classificationRulez = this.createRulez([
      {
        label: 'codigoDocumento',
        pattern: /(?:cod\.|c(?:ó|o)digo n.:?|c(?:ó|o)digo:?|c(?:o|ó)digo nro\.) ?(0{0,}[0-9]{1,3})\b/i
      },
      {
        label: 'codigoDocumentoUnknown',
        pattern: /cod. (##)/
      },
      {
        label: 'tipoDocumentoUnknown',
        pattern: /\b##########\b/i
      },
      {
        label: 'tipoDocumento',
        pattern: /\b(factura|nota de cr.dito|nota de d.ebito)\b/i
      },
    ])
  }

  extendEntitiesSmartRuleSet (rulez) {
    return this.smartRulez
  }

  get smartRulez () {
    const factura = this
    let rulez = {
      copiaDocumento: {
        label: 'copiaDocumento',
        pattern: /\b(original|duplicado|triplicado)\b/i
      },
      tipoDocumento: {
        label: 'tipoDocumento',
        pattern: /\b(factura|nota de cr.dito|nota de d.bito)\b/i,
        filterFn: this.compareTopFirst
      },
      codigoDocumento: {
        label: 'codigoDocumento',
        pattern: /(?:cod\.|c(?:ó|o)digo n.:?|c(?:ó|o)digo:?|c(?:o|ó)digo nro\.) ?(0{0,}[0-9]{1,3})\b/i
      },
      embarque: {
        label: 'embarque',
        pattern: /\b(?:embarques?|emb)\.? ?((?:[1-9](?:\d{0,2}(?:\.\d{3})+|\d*)\/?\b)+)\b/i,
        bruteForceExtraction (doc) {
          let formatted
          //let text = doc.getText(true)
          let text = doc.getTextFromSmartBlocks(true)
          let matches = text.match(this.pattern)

          formatted = this.format(matches)
          if (formatted !== null) {
            let from = factura.calculateMatchesFrom(matches)
            let words = factura.detectWordsWithinDocument(matches[1], doc, from)
            return [{
              words,
              struct: 'smartblocks-bruteforce',
              text: formatted,
              position: matches.index
            }]
          } else {
            //try another method
            return null
          }
        },
        format (matches) {
          if (Array.isArray(matches)) {
            if (matches[1]) {
              return matches[1]
            }
          }
          return null
        }
      },
      guia: {
        label: 'guia',
        pattern: /(?:BL|HBL.HAWB):? ?([a-z]{0,4}[0-9]{8,10})/i
      },
      ordenCompra: {
        label: 'ordenCompra',
        pattern: /(?:\b(?:orden|compra|o|c|oc|ocs|o[\/liI\|]c)\.? *(?:de)? *)+(?: *ebs)? *(?:n|nro|nº)?[s =:\-]*((?:[1-9](?:\d{0,2}(?:\.\d{3})+|\d*)\/?\b)+)/i,
        bruteForceExtraction (doc) {
          let formatted
          //let text = doc.getText(true)
          let text = doc.getTextFromSmartBlocks(true)
          let matches = text.match(this.pattern)

          formatted = this.format(matches)
          if (formatted !== null) {
            let from = factura.calculateMatchesFrom(matches)
            let words = factura.detectWordsWithinDocument(matches[1], doc, from)
            return [{
              words,
              struct: 'smartblocks-bruteforce',
              text: formatted,
              position: matches.index
            }]
          } else {
            //try another method
            return null
          }
        },
        format (matches) {
          if (Array.isArray(matches)) {
            if (matches[1]) {
              return matches[1]
            }
          }
          return null
        }
      },
      numeroRecepcion: {
        label: 'numeroRecepcion',
        pattern: /(?:numero|número|n|nro|nº)?[ de]*\b(?:recep(?:ción|cion|ciones)?|rcp|rct|rto|rec)\b\.?(?:\s*ebs)?\s*(?:n.?|nro|nº)?[s\s=:\-\._]*((?:[1-9](?:\d{0,2}(?:\.\d{3})+|\d*)\/?\b)+)/i,
        bruteForceExtraction (doc) {
          let formatted
          //let text = doc.getText(true)
          let text = doc.getTextFromSmartBlocks(true)
          let matches = text.match(this.pattern)

          formatted = this.format(matches)
          if (formatted !== null) {
            let from = factura.calculateMatchesFrom(matches)
            let words = factura.detectWordsWithinDocument(matches[1], doc)
            return [{
              struct: 'smartblocks-bruteforce',
              text: formatted,
              position: matches.index
            }]
          } else {
            //try another method
            return null
          }
        },
        format (matches) {
          if (Array.isArray(matches)) {
            if (matches[1]) {
              return matches[1]
            }
          }
          return null
        }
      },
      numeroFactura: {
        label: 'numeroFactura',
        pattern: /(?:(?:(?:factura|factura venta) *)|(?:(?:n.|no|nro|numero|nro. de comprobante)\.?))+ *:? *(?:A|C|E)? ?-?([0-9]{4,5})\s*(?:-|A|C|E)\s*([0-9]{8})/i,
        extract (value) {
          let matches = value.match(this.pattern)
          return this.format(matches)
        },
        bruteForceExtraction (doc) {
          let formatted
          //let text = doc.getText(true)
          let text = doc.getTextFromSmartBlocks(true)
          let matches = text.replace(/ /g,'').match(this.pattern)

          formatted = this.format(matches)
          if (formatted !== null) {
            return [{
              struct: 'smartblocks-bruteforce',
              text: formatted,
              position: matches.index
            }]
          } else {
            //try another method
            return null
          }
        },
        format (matches) {
          if (Array.isArray(matches)) {
            if (matches[1] && matches[2]) {
              return matches[1] + '-' + matches[2]
            }
          }
          return null
        }
      },
      puntoVenta: {
        label: 'puntoVenta',
        pattern: /Punto de Venta: ([0-9]{4,5})/,
      },
      numeroComprobante: {
        label: 'numeroComprobante',
        pattern: /Comp. Nro: ([0-9]{8})/,
      },
      //caea: {
      //  label: 'caea',
      //  pattern: /(c\.? ?a\.? ?e\.? ?a\.?)/i
      //},
      //cai: {
      //  label: 'cai',
      //  pattern: /(c\.? ?a\.? ?i\.?)/i
      //},
      //cae: {
      //  label: 'cae',
      //  pattern: /(c\.? ?a\.? ?e\.?)/i
      //},
      cae: {
        label: 'cae',
        pattern: /(?:c\.? ?a\.? ?e\.? ?a\.?|c\.? ?a\.? ?e\.?|c\.? ?a\.? ?i\.?).*([0-9]{14})/i
      },
      tipoCae: {
        label: 'tipoCae',
        pattern: /(c\.? ?a\.? ?e\.? ?a\.?|c\.? ?a\.? ?e\.?|c\.? ?a\.? ?i\.?).*N?.*(?:[0-9]{14})/i
      },
      fecha: {
        label: 'fecha',
        pattern: /([0-9]{1,2}[\-\/\. ][0-9]{1,2}[\-\/\. ][0-9]{2,4})/i
      },
      inicioActividad: {
        label: 'inicioActividad',
        pattern: /Fecha de Inicio de Actividades: ([0-9]{2}\/[0-9]{2}\/[0-9]{4})$/
      },
      iibb: {
        label: 'iibb',
        pattern: /Ingresos Brutos: ([\w\s\-]*)$/
      },
      domicilioProveedor: {
        label: 'domicilioProveedor',
        pattern: /(?:domicilio comercial|domicilio):? ?((?:[\w\s,\.:\-]|[^\u0000-\u007F])*)/i,
        filterFn: this.compareTopFirst
      },
      domicilioJuridica: {
        label: 'domicilioJuridica',
        pattern: /(?:domicilio comercial|domicilio):? ?((?:[\w\s,\.:\-]|[^\u0000-\u007F])*)/i,
        filterFn: this.compareBottomFirst
      },
      razonSocialProveedor: {
        label: 'razonSocialProveedor',
        pattern: /Razón Social:[\s]*(.*)$/,
        filterFn: this.compareTopFirst
      },
      razonSocialJuridica: {
        label: 'razonSocialJuridica',
        pattern: /Razón Social:[\s]*(.*)$/,
        filterFn: this.compareBottomFirst
      },
      ivaProveedor: {
        label: 'ivaProveedor',
        pattern: /Condición frente al IVA: ([\w\s]*)$/,
        filterFn: this.compareTopFirst
      },
      ivaJuridica: {
        label: 'ivaJuridica',
        pattern: /Condición frente al IVA: ([\w\s]*)$/,
        filterFn: this.compareBottomFirst
      },
      condicionVenta: {
        label: 'condicionVenta',
        pattern: /(?:(?:cond.?|condici.n(?:es)?|plazos)(?: ?de)? ?(?:pago|venta|vta.?):?) ?((?: |de|d.as|fecha|factura|fact.?|ff)*[0-9]{1,3}(?: |de|d.as|fecha|factura|fact.?|ff)*|contado|cuenta corriente|tarjetas?|cta.?|cte.?)+/i,
        bruteForceExtraction (doc) {
          let formatted
          //let text = doc.getText(true)
          let text = doc.getTextFromSmartBlocks(true)
          let matches = text.match(this.pattern)

          formatted = this.format(matches)
          if (formatted !== null) {
            let from = factura.calculateMatchesFrom(matches)
            let words = factura.detectWordsWithinDocument(matches[1], doc, from)
            return [{
              words,
              struct: 'smartblocks-bruteforce',
              text: formatted,
              position: matches.index
            }]
          } else {
            //try another method
            return null
          }
        },
        format (matches) {
          if (Array.isArray(matches)) {
            if (matches[1]) {
              return matches[1]
            }
          }
          return null
        }
      },
      codigoBarra: {
        label: 'codigoBarra', 
        pattern: /([0-9]{40,42})/
      },
      total: {
        label: 'total',
        pattern: /total (?:\b\w*\b)? \b[1-9](?:\d{0,2}(?:\,\d{2,3})\.?\d{0,2})\b/gi
      }
    }

    const cuit = {
      label: 'cuit',
      //pattern: /(?:C\.?U\.?I\.?T\.?) *(?:n|nro|nº)?[ :]*\b((?:20|23|27|24|34|30|33)[\-\.]?([0-9]{8})[\-\.\/]?([0-9]{1})\b/,
      pattern: /(?:C\.?U\.?I\.?T\.?) *(?:n|nro|nr|nº)?[ :]*\b((?:20|23|27|24|34|30|33)[\-\.]?(?:[0-9]{8})[\-\.\/]?(?:[0-9]{1}))\b/,
      extract (value) {
        let matches = value.match(this.pattern)
        if (Array.isArray(matches)) {
          return matches[1]
        }
        return null
      },
      bruteForceExtraction (doc) {
        let res
        //let text = doc.getText(true)
        let text = doc.getTextFromSmartBlocks(true)
        let matches = text.match(/\b(?:20|23|24|30|33|34)\-?(?:[0-9]{8})\-?\/?(?:[0-9]{1})\b/g)

        if (matches !== null && matches.length > 1) {
          res = matches.map(m => {
            return {
              struct: 'smartblocks-bruteforce-m1',
              text: m
            }
          })
          return res
        } else {
          // remove white spaces
          matches = text.replace(/ /g, '').match(/(?:20|23|24|30|33|34)\-?(?:[0-9]{8})\-?\/?(?:[0-9]{1})/g)
          if (matches !== null && matches.length > 0) {
            res = matches.map(m => {
              return {
                struct: 'smartblocks-bruteforce-m2',
                text: m
              }
            })
            return res
          } else {
            //try another method
            return null
          }
        }
      }
    }

    //rulez['cuits'] = Object.assign({}, cuit, {
    //  label: 'cuits',
    //  filterFn: this.compareTopFirst
    //})

    return rulez
  }

  getDocumentId () {
    let nfact = this.entities.numeroFactura
    let docId

    if (Array.isArray(nfact) && nfact.length > 0) {
      docId = nfact[0].text
    }

    return docId
  }

  createRulez (defs) {
    let rulez = []
    for (let i = 0; i < defs.length; i++) {
      let rule = new Rule(this.doc, defs[i])
      rulez.push(rule)
    }
    return rulez
  }

  detectDocumentEntities () {
    this.entities = new Entities()
    this.entitiesExtraction()
    this.tablesExtraction()
    return this.entities
  }

  tablesExtraction () {
    this.entities.tables = Tables(this.tableRulez, this.doc)
  }

  entitiesExtraction () {
    let entities = this.entities
    let dataMatrix = this.doc.dataMatrix
    let index = 0
    let rule
    let rulez = this.entityRulez

    while (index < rulez.length) {
      rule = rulez[index]
      if (!entities[rule.label]) {
        entities[rule.label] = []
      }

      entities[rule.label] = this.ruleExtractionSteps(rule, this.doc)

      index++
    }

    return entities
  }

	search (rule) {
		return this.ruleExtractionSteps(rule, this.doc)
	}

  /**
   *
   * apply rule in steps using different methods
   *
   */
  ruleExtractionSteps (rule, doc) {
    let entities = []
    let findings
    let accepted

    const checkFindings = (findings) => {
      if (!Array.isArray(findings) || findings.length===0) {
        return false
      }

      let items = rule.filterFindings(findings)
      if (!Array.isArray(items) || items.length===0) {
        return false
      }

      items.forEach(item => {
        entities.push( new DataEntity({ rule, props: item }) )
      })
      return true
    }

    accepted = checkFindings(this.extractFromDataMatrix(rule, doc))
    if (!accepted) {
      checkFindings(this.extractUsingBruteForce(rule, doc))
    }

    // accepted or not, return findings
    return entities
  }

  /**
   *
   * use only a small set of pattern to detect already known document structure
   *
   */
  detectDocumentStructure () {
    let matchingRulez = []
    let rulez = this.classificationRulez
    let index = 0
    let confidence
    let label = this.label

    if (rulez) {
      rulez.forEach(rule => {
        let found = this.extractFromDataMatrix(rule, this.doc)
        //if (found.length > 0) {
        //  matchingRulez.push({ rule, texts: found })
        //}
        matchingRulez.push({ rule, texts: found, matched: (found.length > 0) })
      })
    }

    if (!rulez || rulez.length === 0) {
      confidence = 0
    } else {
      let matches = matchingRulez.filter(rule => rule.matched === true)
      confidence = ((matches.length * 100) / rulez.length)
    }

    return { label, confidence, matchingRulez }
  }

  toJSON () {
    let entities = this.entities.toJSON()
    entities.structLabel = [ this.label ]
    return entities
  }

  extractFromDataMatrix (rule, doc) {
    let words
    if (!rule.hasOwnProperty('pattern')) {
      // cannot detect rule without a pattern
      return []
    }

    // test pattern agains each text in dataMatrix
    let dataMatrix = doc.dataMatrix
    let matchingPatters = []
    let matches = []
    let xIndex = 0, value
    let xKeys = Object.keys(dataMatrix)

    while (xIndex < xKeys.length) {
      let xKey = xKeys[xIndex]
      let yIndex = 0
      let yKeys = Object.keys(dataMatrix[xKey])
      while (yIndex < yKeys.length) {
        let yKey = yKeys[yIndex]
        let elem = dataMatrix[xKey][yKey]

        if (rule.test(elem.text) === true) {
          value = rule.extract(elem.text)
          if (value) {
            words = this.detectWordsWithinAnnotation(value, elem)
            matches.push({
              struct: 'datamatrix',
              words,
              text: value,
              data: elem,
              position: {
                x: parseInt(xKey),
                y: parseInt(yKey)
              }
            })
          }
        }
        yIndex++
      }
      xIndex++
    }
    return matches
  }

  extractUsingBruteForce (rule, doc) {
    let matches = []
    let found
    if (typeof rule.bruteForceExtraction === 'function') {
      found = rule.bruteForceExtraction(doc)
      if (found !== null) {
        if (Array.isArray(found)) {
          found.forEach(f => matches.push(f))
        } else {
          console.log('found is ', found)
        }
      }
    }
    return matches
  }

  /**
   *
   * compare items, and choose the first one from top to bottom
   *
   */
  compareTopFirst (items) {
    if (items.length===1) { return items }

    if (items[0].struct != 'datamatrix') {
      return items
    }

    // sort ascending
    items.sort((a, b) => a.position.y - b.position.y)

    return [ items[0] ]
  }

  /**
   *
   * compare items, and choose the first one from bottom to top
   *
   */
  compareBottomFirst (items) {
    if (items.length===1) { return items }

    if (items[0].struct != 'datamatrix') {
      return items
    }

    // sort descending
    items.sort((a, b) => b.position.y - a.position.y)

    return [ items[0] ]
  }

  /**
   *
   * this method use the annotation in a paragraph from datamatrix, to detect words annotation out of a string.
   *
   */
  detectWordsWithinAnnotation (str, elem) {
    let words = elem.line.annotations

    // symbols does not includes spaces as characters, but as property
    // count spaces before search text starts
    let symbolsStart = elem.text.indexOf(str)
    let spaces = elem.text
      .substring(0, symbolsStart)
      .split(' ')
      .length - 1
    // and remove spaces from start
    symbolsStart -= spaces

    // do the same with the string end
    let symbolsLength = str.length
    let start = elem.text.indexOf(str)
    let end = start + symbolsLength
    spaces = elem.text
      .substring(start, end)
      .split(' ')
      .length - 1

    symbolsLength -= spaces

    let counter = 0
    let word
    let matchedWords = []
    let index = 0

    while (counter < (symbolsStart + symbolsLength) && index < words.length) {
      word = words[index]
      counter += word.symbols.length
      if (counter > symbolsStart && counter <= (symbolsStart + symbolsLength)) {
        matchedWords.push(word)
      }
      index++
    }

    return matchedWords
  }

  /**
   *
   * this method use the annotation of the whole document to detect words annotation out of a string.
   *
   */
  detectWordsWithinDocument (str, doc, from=undefined) {
    let words = doc.getWords()
    //let text = doc.getText(true)
    let text = doc.getTextFromSmartBlocks(true)

    if (from === undefined || typeof from !== 'number') {
      from = text.indexOf(str)
    }

    // symbols does not includes spaces as characters, but as property
    // count spaces before search text starts
    let symbolsStart = from
    let spaces = text
      .substring(0, symbolsStart)
      .split(' ')
      .length - 1
    // and remove spaces from 0 to start
    symbolsStart -= spaces

    // do the same with the string end
    let symbolsEnd = str.length
    let start = from
    let end = start + symbolsEnd
    spaces = text
      .substring(start, end)
      .split(' ')
      .length - 1
    // and remove spaces from start to end
    symbolsEnd -= spaces

    let counter = 0
    let word
    let matchedWords = []
    let index = 0

    while (counter < (symbolsStart + symbolsEnd) && index < words.length) {
      word = words[index]
      counter += word.symbols.length
      if (counter > symbolsStart && counter <= (symbolsStart + symbolsEnd)) {
        matchedWords.push(word)
      }
      index++
    }

    return matchedWords
  }

  calculateMatchesFrom (matches) {
    // matches[0] contains all the detected elements with the regexp
    // matches[1] should contain the 1st capturing group of the regexp. that is the last part of the regexp surrounded with ()
    // matches.index is the first character found of matches[0] within matches.input
    // our real index is
    let from = (matches.index + matches[0].indexOf(matches[1]))
    return from
  }
}

module.exports = Documento

class DataEntity {
  constructor (specs) {
    let { rule, props } = specs

    this.rule = rule
    this.props = props
    this.text = props.text
  }

  get value () {
    return this.text
  }

  set value (val) {
    this.text = val
  }

  toString () {
    return this.text
  }
}

class Entities {
  constructor () {
  }

  toJSON () {
    let entities = {}
    let key
    let keys = Object.getOwnPropertyNames(this)

    for (let i = 0; i < keys.length; i++) {
      key = keys[i]

      if (key !== 'tables') {
        if (Array.isArray(this[key])) {
          entities[key] = this[key].map(ent => ent.text)
        } else {
          entities[key] = null
        }
      } else {
        entities[key] = this[key]
      }
    }

    return entities
  }

  toObject () {
    return this.toJSON()
  }

  toString () {
    return JSON.stringify(this.toJSON())
  }
}
