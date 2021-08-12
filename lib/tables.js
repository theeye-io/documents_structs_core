
const Constants = require('./constants')
const Helpers = require('./helpers')

class TablesSet {
  constructor () {
  }

  toObject(){
    let props = Object.getOwnPropertyNames(this)
    let plain = {}
    props.forEach(prop => {
      plain[prop] = this[prop].table.toObject()
    })
  }
}

module.exports = function (rulez, page) {
  let tables = new TablesSet()
  let rule
  let table

  if (!rulez || rulez.length===0) {
    return tables
  }

  /**
   *
   * by default, detection use a TOP-DOWN direction walk through all the elements
   * then the walk pattern can be:
   * > LEFT-RIGHT
   * > RIGHT-LEFT
   * > TOTAL-WIDTH
   * using page borders as left and right bounds
   *
   * Also could be posible to implement an elements walk within a bounding box
   *
   * @property {Array} section 0 = start, 1 = end
   *
   */
  const collectElementsWithinSection = (specs) => {
    let section = specs.section
    let detection = specs.detection || Constants.LEFT_RIGHT

    let topBoundary = section[0].line.annotations[0].boundingBox.vertices
    let bottomBoundary = section[1].line.annotations[ section[1].line.annotations.length - 1 ].boundingBox.vertices

    let topX = topBoundary[0].x
    let topY = topBoundary[0].y
    let bottomY = bottomBoundary[3].y

    let detections = detectPatterns([
      {
        test (elem) {
          let vert = elem.data.line.annotations[elem.data.line.annotations.length - 1].boundingBox.vertices
          let pointA
          let pointB
          let contained

          if (detection===Constants.LEFT_RIGHT) {
            pointA = vert[1]
            pointB = vert[2]

            contained = (
              pointA.x > topX &&
              (
                (pointA.y > topY && pointA.y < bottomY) ||
                (pointB.y > topY && pointB.y < bottomY)
              )
            )
          } else if (detection===Constants.RIGHT_LEFT) {
            pointA = vert[0]
            pointB = vert[3]

            contained = (
              pointA.x < topX &&
              (
                (pointA.y > topY && pointA.y < bottomY) ||
                (pointB.y > topY && pointB.y < bottomY)
              )
            )
          } else if (detection===Constants.TOTAL_WIDTH) {
            // choose diagonal points of bbox
            pointA = vert[0]
            pointB = vert[2]

            // ignore X position
            contained = (
              (pointA.y > topY && pointA.y < bottomY) ||
              (pointB.y > topY && pointB.y < bottomY)
            )
          }

          return contained
        }
      }
    ], page)[0]

    return detections
  }

  /**
   *
   * detect data boundaries given a set of patterns
   *
   */
  const buildTable = (setup) => {
    let { boundariesPatterns, detectPattern } = setup
    // search table bounding box
    let detections = detectPatterns(boundariesPatterns, page)
    let start = detections[0]
    let end = detections[1]

    if (!start || !end) {
      // cannot detect table without boundaries
      console.error('table start/end not detected')
      return 
    }

    // parse detections. use detected locations
    if (start.length > 1) {
      // bottom detected items first
      start.sort((a, b) => b.position.y - a.position.y)
    }
    if (end.length > 1) {
      // bottom detected items first
      end.sort((a, b) => b.position.y - a.position.y)
    }

    start = start[0]
    end = end[0]

    let section = [
      page.dataMatrix[start.position.x][start.position.y],
      page.dataMatrix[end.position.x][end.position.y]
    ]

    let elems = collectElementsWithinSection({
      section,
      detection: detectPattern
    })

    //removeMatchingBoundaries(elems, setup.boundariesDelete)

    let table = new SmartTable ({ page })
    table.build(elems)
    return table
  }

  const removeMatchingBoundaries = (elems, boundariesDelete) => {
    if (boundariesDelete && boundariesDelete.length > 0) {
      boundariesDelete.forEach(pattern => {
        let index = 0
        let elem
        let bound
        while (index < elems.length) {
          elem = elems[index]
          if (pattern.test(elem.data.text) === true) {
            elems.splice(index, 1)
          } else {
            index++
          }
        }
      })
    }
  }

  for (let index = 0; index < rulez.length; index++) {
    rule = rulez[index]
    table = buildTable(rule)

    tables[rule.label] = {
      label: rule.label,
      table
    }
  }

  return tables
}

/**
 * return detections in same index as patterns come
 */
const detectPatterns = (patterns, page) => {
  let dataMatrix = page.dataMatrix
  let found = []
  let xIndex = 0
  let xKeys = Object.keys(dataMatrix)

  const testPatterns = (elem) => {
    for (let i = 0; i < patterns.length; i++) {
      let pattern = patterns[i]
      let compareValue = elem

      if (pattern instanceof RegExp) {
        compareValue = elem.data.text
      }

      if (pattern.test(compareValue) === true) {
        if (found[i] === undefined) {
          found[i] = []
        }

        found[i].push(elem)
      }
    }
  }

  while (xIndex < xKeys.length) {
    let xKey = xKeys[xIndex]

    let yIndex = 0
    let yKeys = Object.keys(dataMatrix[xKey])

    while (yIndex < yKeys.length) {
      let yKey = yKeys[yIndex]
      let data = dataMatrix[xKey][yKey]

      testPatterns({
        data,
        position: {
          x: parseInt(xKey),
          y: parseInt(yKey)
        }
      })

      yIndex++
    }

    xIndex++
  }

  return found
}

class CellItem {
  constructor (specs) {
    this.props = specs.props
    this.ratio = specs.ratio
    this.text = specs.props.data.text
    this.props.struct = 'table'
    this.props.words = specs.props.data.line.annotations
  }

  // to plain object
  toObject () {
    return {
      ratio: this.ratio,
      text: this.text,
      props: {
        block: this.props.data.block,
        paragraph: this.props.data.paragraph
      }
    }
  }

  toJSON () {
    return this.text
  }

  toString () {
    return JSON.stringify(this.toObject())
  }
}

const SmartTable = (function(){

  class SmartTable {
    constructor (specs) {
      this.page = specs.page
      this.rows = []
      this.undetected = [] // dont know which cell should put the element

      // this array will be filled with estimated calculated ranges.
      // array index corresponds to column index
      this.columnsBounds = []
    }

    build (elements) {
      let rows = estimateRows(elements)

      this.estimateHeaders(rows)

      // try to generate table cells using vertical alignment of data
      this.buildCellsUsingVerticalAlignment(rows)
      if (this.undetected.length > 0) {
        let elems = this.undetected.splice(0, this.undetected.length)
        this.buildCellsUsingEstimatedColumnBounds(elems)
      }
    }

    estimateHeaders (rows) {
      // use first row as table header
      let headers = regroupColumnsHeaders(rows[0]) // use first row data as headers
      // fill the first table row with what we estimate are the headers
      this.rows[0] = headers
    }

    estimateColumnsBoundsUsingContent () {
      let row, rowIndex
      let col, colIndex
      let bounds, mid
      let cells = []
      let headers = this.rows[0]
      let columnsBounds = this.columnsBounds

      /**
       *
       * given the obtained columns bounds,
       * maximize the limits using the mid value of the distance
       * between consecutive columns limit.
       *
       */
      const maximizeColumnsBounds = () => {
        let colIndex = 0
        let bounds, nextBounds
        let width = this.page.annotation[0].fullTextAnnotation.pages[0].width

        while (colIndex < columnsBounds.length) {
          bounds = columnsBounds[colIndex]
          nextBounds = columnsBounds[colIndex + 1]

          if (!nextBounds) {
            bounds[1].x = width // max width
            bounds[2].x = width // max width
          } else {
            if (colIndex === 0) {
              bounds[0].x = 0
              bounds[3].x = 0
            }

            mid = bounds[1].x + (nextBounds[0].x - bounds[1].x) / 2

            bounds[1].x = mid
            bounds[2].x = mid
            nextBounds[0].x = mid
            nextBounds[3].x = mid
          }

          colIndex++
        }
      }

      colIndex = 0
      while (colIndex < headers.length) {
        rowIndex = 0
        while (rowIndex < this.rows.length) {
          if (this.rows[rowIndex] && this.rows[rowIndex][colIndex]) {
            cells.push(this.rows[rowIndex][colIndex])
          }
          rowIndex++
        }

        columnsBounds[colIndex] = cells.reduce((bounds, cell) => {
          if (!cell) {
            return bounds
          }

          let vertices = Helpers.annotationsVertices(cell[0].props.data.line.annotations)
          if (!bounds) {
            bounds = []
            bounds[0] = { x: vertices[0].x }
            bounds[3] = { x: vertices[0].x }

            bounds[1] = { x: vertices[1].x }
            bounds[2] = { x: vertices[1].x }
          } else {
            bounds[0] = { x: Math.min(bounds[0].x, vertices[0].x) }
            bounds[3] = { x: Math.min(bounds[0].x, vertices[0].x) }

            bounds[1] = { x: Math.max(bounds[1].x, vertices[1].x) }
            bounds[2] = { x: Math.max(bounds[1].x, vertices[1].x) }
          }
          return bounds
        }, null)

        cells = []
        colIndex++
      }

      // adjust maximum columns bounds
      maximizeColumnsBounds()
    }

    pushUndetected (index, elem) {
      if (!this.undetected[index]) {
        this.undetected[index] = []
      }
      this.undetected[index].push(elem)
    }

    /**
     *
     * @param {Number} fase on higher iteration assume the column
     *
     */
    handleElementDetections (detections, row, elem, fase=1) {
      let detection
      let cellItem
      let criteria

      const assignColumn = (detection) => {
        if (!this.rows[row]) {
          this.rows[row] = []
        }
        if (!this.rows[row][detection.col]) {
          this.rows[row][detection.col] = []
        }
        cellItem = new CellItem({
          props: elem,
          ratio: detection.ratio
        })
        this.rows[row][detection.col].push(cellItem)
      }

      if (detections.length === 1) {
        detection = detections[0]
        if (
          detection &&
          detection.ratio > Constants.TABLE_COLUMN_DETECTION_RATIO_OF_CONFIDENCE
        ) {
          assignColumn(detection)
        } else {
          if (fase!==2) {
            this.pushUndetected(row, elem)
          } else {
            assignColumn(detection)
          }
        }
      } else if (detections.length === 0) {
        if (fase!==2) {
          this.pushUndetected(row, elem)
        } else {
          // detect nearest column
        }
      } else {
        // more than 1 detection
        if (fase!==2) {
          this.pushUndetected(row, elem)
        } else {
          let maxDetection
          detections.forEach(detection => {
            if (maxDetection === undefined || detection.ratio > maxDetection.ratio) {
              maxDetection = detection
            }
          })
          assignColumn(maxDetection)
        }
      }
    }

    buildCellsUsingVerticalAlignment (rows) {
      // row 0 contains headers
      let rowIndex = 1, elem
      let detection, detections
      let columns, colIndex
      let headers = this.rows[0]

      while (rowIndex < rows.length) {
        columns = rows[rowIndex]
        colIndex = 0
        while (colIndex < columns.length) {
          elem = columns[colIndex]
          detections = detectElementsVerticalIntersectionRatio(elem, elementsBounds(headers))
          this.handleElementDetections(detections, rowIndex, elem,/* iteration */ 1)
          colIndex++
        }
        rowIndex++
      }
    }

    buildCellsUsingEstimatedColumnBounds (rows) {
      let rowIndex = 0, elem
      let detection, detections
      let columns, colIndex

      this.estimateColumnsBoundsUsingContent()

      while (rowIndex < rows.length) {
        columns = rows[rowIndex]
        if (columns!==undefined) {
          colIndex = 0
          while (colIndex < columns.length) {
            elem = columns[colIndex]
            detections = detectElementsVerticalIntersectionRatio(elem, this.columnsBounds)
            this.handleElementDetections(detections, rowIndex, elem,/* iteration */ 2)
            colIndex++
          }
        }
        rowIndex++
      }
    }

    extractData () {
      let tableCells = []
      let columns, rows = this.rows
      let rowIndex, colIndex
      let cell
      let elems

      rowIndex = 0

      while (rowIndex < rows.length) {
        tableCells[rowIndex] = []
        columns = rows[rowIndex]
        if (columns!==undefined) {
          colIndex = 0
          while (colIndex < columns.length) {
            tableCells[rowIndex][colIndex] = ''
            elems = columns[colIndex]
            if (elems!==undefined) {
              if (elems.length > 0) {
                cell = elems.map(el => el.props.data.text)
                tableCells[rowIndex][colIndex] = cell.join(' ')
              }
            }
            colIndex++
          }
        }
        rowIndex++
      }

      return tableCells
    }

    toObject () {
      return JSON.parse(this.toJSON())
    }

    toJSON () {
      return JSON.stringify(this.rows)
    }

    toString () {
      return this.toJSON()
    }
  }

  const estimateRows = (elems) => {
    let rows = []
    // sort rows using top-left Y position of each bbox
    elems.sort((l1, l2) => l1.position.y - l2.position.y)

    compare(elems, rows)

    // sort rows using top-left Y position of each bbox
    rows.sort((l1, l2) => l1[0].position.y - l2[0].position.y)
    return rows
  }

  // elems are ordered using bbox top-right position in X axis
  const compare = (elems, rows) => {
    if (elems.length===0) { return rows }

    let ratio
    let elem = elems.splice(0,1)[0]
    let index = 0
    let matched = [ elem ]

    while (index < elems.length) {
      let cmpElem = elems[index]

      ratio = Helpers.segmentsIntersectionRatio(
        Helpers.annotationsVertices(elem.data.line.annotations),
        Helpers.annotationsVertices(cmpElem.data.line.annotations),
        Constants.HORIZONTAL_SEGMENTS
      )

      if (ratio > 0) {
        // do not increase index, to reprocess current new index
        matched.push( elems.splice(index, 1)[0] )
      } else {
        index++
      }
    }

    rows.push(matched)

    return compare(elems, rows)
  }

  const elementsBounds = (eles) => {
    return eles.map(el => {
      item = el[0].props // take one item. each cell could contain more than one word or being multiline
      bounds = Helpers.annotationsVertices(item.data.line.annotations)
      return bounds
    })
  }

  /**
   *
   * @return {Array} detected columns and ratios
   *
   **/
  const detectElementsVerticalIntersectionRatio = (elem, bounds) => {
    let index = 0
    let elementBounds
    let boundRatio
    let found = []

    while (index < bounds.length) {
      bound = bounds[index]
      elementBounds = Helpers.annotationsVertices(elem.data.line.annotations)

      boundRatio = Helpers.segmentsIntersectionRatio(
        bound,
        elementBounds,
        Constants.VERTICAL_SEGMENTS
      )

      if (boundRatio > 0) { // is aligned with the header
        found.push({ ratio: boundRatio, col: index })
      }

      index++
    }

    return found
  }

  /**
   *
   * use the first estimated row as headers, and group them into columns.
   * each header could have 1 or more words
   *
   */
  const regroupColumnsHeaders = (data) => {
    // data is ordered using the X position
    let elIndex = 0
    let headerIndex
    let item, cell, ratio
    let header, headers = []
    let cellItem

    while (elIndex < data.length) {
      item = data[elIndex]
      cell = null

      headerIndex = 0
      while (headerIndex < headers.length) {
        header = headers[headerIndex][0]
        ratio = Helpers.segmentsIntersectionRatio(
          Helpers.annotationsVertices(header.props.data.line.annotations),
          Helpers.annotationsVertices(item.data.line.annotations),
          Constants.VERTICAL_SEGMENTS
        )

        if (ratio > 0) {
          cell = headerIndex
        }

        headerIndex++
      }

      cellItem = new CellItem({ props: item, ratio })
      if (!cell) {
        cellItem.ratio = 1
        headers[ headerIndex ] = [ cellItem ]
      } else {
        headers[ headers.length - 1 ].push( cellItem )
      }

      elIndex++
    }

    headers.sort((c1, c2) => c1[0].props.position.x - c2[0].props.position.x)

    return headers
  }
  // not in use
  //const recalculateColumnBounds = (current, diff) => {
  //  let bounds = [ {}, {}, {}, {} ]
  //  bounds[0].x = Math.min(current[0].x, diff[0].x)
  //  bounds[3].x = Math.min(current[3].x, diff[3].x)
  //  bounds[1].x = Math.max(current[1].x, diff[1].x)
  //  bounds[2].x = Math.max(current[2].x, diff[2].x)
  //  return bounds
  //}

  return SmartTable

})()
