const Helpers = require('./helpers')

class Rule {
  constructor (doc, options) {
    Object.assign(this, options)

    this.doc = doc

    let pattern = (options.pattern || null)
    if (pattern) {
      if ( !(pattern instanceof RegExp) ) {
        if (typeof pattern === 'string') {
          pattern = new RegExp(pattern)
        } else {
          throw new Error(`invalid pattern ${pattern}`)
        }
      }
    }
    this.pattern = pattern
  }

  toJSON () {
    // remove doc
    return Object.assign({}, this, { doc: null })
  }

  toString () {
    return JSON.stringify( this.toJSON() )
  }

  acceptFindings (findings) {
    if (!findings || !Array.isArray(findings)) { return false }
    return (findings.length > 0)
  }

  test (item) {
    const testFn = (item) => {
      if (!this.pattern) {
        return false
      }
      return this.pattern.test(item)
    }

    let fn = (this.testFn||testFn)

    return fn.call(this, item)
  }

  extract (value) {
    const extractFn = (value) => {
      if (!this.pattern) {
        return value
      }
      const found = value.match(this.pattern)
      const group = found[ this.matchingGroup || 1 ]
      return group // assume only one matching group
    }

    let fn = (this.extractFn||extractFn)

    return fn.call(this, value)
  }

  filterFindings (items) {
    const filterFn = (items) => {
      return items
    }

    const filter = (this.filterFn || filterFn)

    if (typeof filter === 'function') {
      return filter.call(this, items)
    } else {
      if (typeof filter === 'object' && filter.name) {
        const filterInterface = FilterInterface[filter.name]
        return filterInterface.call(this, items, filter.options)
      } else {
        return filterFn(items)
      }
    }
  }

  get beginOfDocument () {
    return { x: 0, y: 0 }
  }

  get endOfDocument () {
    return {
      x: this.doc.page().width,
      y: this.doc.page().height
    }
  }
}

module.exports = Rule

/**
 *
 * Add method on demand to Rule instance
 *
 */
const FilterInterface = {
  section: function (items, options) {

    const { beginOfDocument, endOfDocument } = this

    // the 'this' context is binded to a Rule instance

    const buildBbox = (coords) => {
      const begin = buildCoordinates(coords.begin)
      const end = buildCoordinates(coords.end)

      return Helpers.buildBoundingBox( begin, end )
    }

    const buildCoordinates = (specs, coord = null) => {
      if (typeof specs === 'string') {
        // keyword
        if (specs === 'beginOfDocument') {
          if (coord === null) { return beginOfDocument }
          if (coord === 'x') { return beginOfDocument.x }
          if (coord === 'y') { return beginOfDocument.y }
        }
        if (specs === 'endOfDocument') {
          if (coord === null) { return endOfDocument }
          if (coord === 'x') { return endOfDocument.x }
          if (coord === 'y') { return endOfDocument.y }
        }
      } else if (typeof specs === 'object') {
        if (coord === null) {
          const coords = {}
          coords.x = buildCoordinates(specs.x, 'x')
          coords.y = buildCoordinates(specs.y, 'y')
          return coords
        } else {
          return buildCoordinatesSpecs(specs, coord)
        }
      }
    }

    const buildCoordinatesSpecs = (specs, coord) => {
      if (!specs.type) {
        throw new Error('filter definition error. section type required. "relative" supported')
      }

      if (specs.type !== 'relative') {
        throw new Error(`unsupported type ${specs.type}`)
      }

      const coords = relativeSection(specs)
      return coords[coord]
    }

    const relativeSection = (options) => {
      const { to, percentage } = options
      const { endOfDocument } = this

      if (to === 'endOfDocument') {
        return {
          x: Math.ceil( (endOfDocument.x * percentage) / 100 ),
          y: Math.ceil( (endOfDocument.y * percentage) / 100 )
        }
      }

      throw new Error('invalid section definition. use endOfDocument')
    }

    const sectionbbox = buildBbox(options.coordinates)

    const filtered = items.filter(item => {
      const intersectionRatio = Helpers.segmentsIntersectionRatio(
        sectionbbox,
        item.words[0].boundingBox.vertices
      )

      return intersectionRatio > 0.8
    })

    return filtered
  }
}
