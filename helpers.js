const Constants = require('./constants')

const Helpers = {

  elementsBoundingBox (elems) {
    let elem, bbox
    let bounds
    for (let index=0; index < elems.length; index++) {
      bbox = elems[index]
      if (!bounds) {
        bounds = bbox
      } else {
        bounds = maxbbox(bounds, bbox)
      }
    }
    return bounds
  },

  /**
   *
   * points are clockwise ordered
   * @param {Object} v1 vertices boundingbox
   * @param {Object} v2 vertices boundingbox
   * @param {String} alignment the type of alignment to test or try to detect
   * @return {Boolean}
   *
   */
  areAlignedVertices (v1, v2, alignment, err=undefined) {
    if (v1 === v2) {
      return true
    }

    if (!alignment) {
      throw new Error('Tell desired alignment. We don\'t know yet how to determine alignment')
    }

    if (alignment === Constants.BOTTOM_HORIZONTAL_ALIGNED) {
      return bottomHorizontalAligned(v1, v2, err)
    }

    if (alignment === Constants.TOP_HORIZONTAL_ALIGNED) {
      return topHorizontalAligned(v1, v2, err)
    }

    throw new Error(`desired alignment ${alignment} is unknown`)
  },

  /**
   *
   * computer vision is not very precise.
   * so we need to be sure that bounding box lines are paralell to axis
   * to get a better comparison ratio
   *
   * this process results in a slightly bigger bounding box with aligned vertices
   *
   */
  rectifyBBox (bbox) {
    // horizontal top
    if (bbox[0].y != bbox[1].y) {
      let ymin = Math.min(bbox[0].y, bbox[1].y)
      bbox[0].y = ymin
      bbox[1].y = ymin
    }

    // horizontal bottom
    if (bbox[3].y != bbox[2].y) {
      let ymax = Math.max(bbox[3].y, bbox[2].y)
      bbox[3].y = ymax
      bbox[2].y = ymax
    }

    // vertical right
    if (bbox[1].x != bbox[2].x) {
      let xmax = Math.max(bbox[1].x, bbox[2].x)
      bbox[1].x = xmax
      bbox[2].x = xmax
    }

    // vertical left
    if (bbox[0].x != bbox[3].x) {
      let xmin = Math.min(bbox[0].x, bbox[3].x)
      bbox[0].x = xmin
      bbox[3].x = xmin
    }

    return bbox
  },

  /**
   * detect ratio of intersection of two bbox segments.
   *
   * @param {Array} bbox1 contains pairs of x,y vertices
   * @param {Array} bbox2 contains pairs of x,y vertices
   * @param {String} alignment null, HORIZONTAL_SEGMENTS, VERTICAL_SEGMENTS
   */
  segmentsIntersectionRatio (bbox1, bbox2, alignment = null) {
    if (bbox1 === bbox2) { return 1 }

    const rectBbox1 = Helpers.rectifyBBox(JSON.parse(JSON.stringify(bbox1)))
    const rectBbox2 = Helpers.rectifyBBox(JSON.parse(JSON.stringify(bbox2)))

    if (JSON.stringify(rectBbox1) === JSON.stringify(rectBbox2)) {
      return 1
    }

    if (alignment === Constants.HORIZONTAL_SEGMENTS) {
      return horizontalIntersectionRatio (rectBbox1, rectBbox2)
    }

    if (alignment === Constants.VERTICAL_SEGMENTS) {
      return verticalIntersectionRatio (rectBbox1, rectBbox2)
    }

    if (!alignment) {
      return intersectionRatio (rectBbox1, rectBbox2)
    }
  },

  /**
   *
   * extract cornes from an array of annotations with element having boundBox.vertices prop
   *
   */
  annotationsVertices (annotations) {
    let start = annotations[0].boundingBox.vertices
    let end = annotations[annotations.length - 1].boundingBox.vertices

    return [ start[0], end[1], end[2], start[3] ]
  },

  contiguousWords (w1, w2) {
    let v1 = w1.boundingBox.vertices
    let v2 = w2.boundingBox.vertices

    return ( v1[1].x <= v2[0].x && v1[2].x <= v2[3].x )
  },

  boundingBoxHeight (vert) {
    return Math.abs(vert[3].y - vert[0].y)
  },

  boundingBoxWidth (vert) {
    return Math.abs(vert[1].x - vert[0].x)
  },

  /**
   * Build a bounding box using the starting and ending coordinates.
   * Starting coordinates corresponding to the top left point
   * Ending coordinates corresponding to the bottom right point
   * @param {Array<Array>} b begin x,y
   * @param {Array<Array>} e end x,y
   *
   */
  buildBoundingBox (b, e) {
    return (
      [
        { x: b.x, y: b.y },
        { x: e.x, y: b.y },
        { x: e.x, y: e.y },
        { x: b.x, y: e.y }
      ]
    )
  }

}

module.exports = Helpers

const maxbbox = (bboxA, bboxB) => {
  let max = [{},{},{},{}]
  //VERTICES_TOP_LEFT. POINT 0
  let pA0 = bboxA[0] , pB0 = bboxB[0]
  if (pA0.x <= pB0.x) { max[0].x = pA0.x }
  else { max[0].x = pB0.x }

  if (pA0.y <= pB0.y) { max[0].y = pA0.y }
  else { max[0].y = pB0.y }

  //VERTICES_TOP_RIGTH. POINT 1
  let pA1 = bboxA[1] , pB1 = bboxB[1]
  if (pA1.x >= pB1.x) { max[1].x = pA1.x }
  else { max[1].x = pB1.x }

  if (pA1.y <= pB1.y) { max[1].y = pA1.y }
  else { max[1].y = pB1.y }

  //VERTICES_BOTTOM_LEFT. POINT 2
  let pA2 = bboxA[2] , pB2 = bboxB[2]
  if (pA2.x >= pB2.x) { max[2].x = pA2.x }
  else { max[2].x = pB2.x }

  if (pA2.y >= pB2.y) { max[2].y = pA2.y }
  else { max[2].y = pB2.y }

  //VERTICES_BOTTOM_RIGTH. POINT 3
  let pA3 = bboxA[3] , pB3 = bboxB[3]
  if (pA3.x <= pB3.x) { max[3].x = pA3.x }
  else { max[3].x = pB3.x }

  if (pA3.y >= pB3.y) { max[3].y = pA3.y }
  else { max[3].y = pB3.y }
  
  return max
}

/**
 *
 * @return {Boolean}
 *
 */
const adjacentWords = (w1, w2) => {
  return false
}

/**
 *
 * horizontal and vertical
 *
 */
const intersectionRatio = (bbox1, bbox2) => {
  let ratios = [
    horizontalIntersectionRatio(bbox1, bbox2),
    verticalIntersectionRatio(bbox1, bbox2)
  ]
  return (ratios[0] === 1 && ratios[1] === 1) ? 1 : 0
}

const horizontalIntersectionRatio = (bbox1, bbox2) => {
  let a0 = bbox1[0].y
  let a1 = bbox1[3].y
  let b0 = bbox2[0].y
  let b1 = bbox2[3].y

  return segmentsComparisonRatio(a0, a1, b0, b1)
}

const verticalIntersectionRatio = (bbox1, bbox2) => {
  let a0 = bbox1[0].x
  let a1 = bbox1[1].x
  let b0 = bbox2[0].x
  let b1 = bbox2[1].x

  return segmentsComparisonRatio(a0, a1, b0, b1)
}

const segmentsComparisonRatio = (a0, a1, b0, b1) => {
  // not intersection
  if (a1 < b0 || b1 < a0) { return 0 }

  // same segments. totally aligned
  if (a0 === b0 && a1 === b1) { return 1 }

  // one segment is contained into the other
  if ( (a0 <= b0 && a1 >= b1) || (a0 >= b0 && a1 <= b1) ) { return 1 }

  // touches at least the borders. B is to the left of A
  if (b0 < a0 && a0 <= b1 && b1 < a1) {
    return (b1 - a0) / (a1 - a0)
  }

  // touches at least the borders. A is to the left of B
  if (a0 < b0 && b0 <= a1 && a1 < b1) {
    return (a1 - b0) / (a1 - a0)
  }

  // no intersection at all
  return 0
}

/**
 *
 * using error on calculation of bounding boxes
 *
 */
const bottomHorizontalAligned = (v1, v2, err) => {
  //let v1 = v1.boundingBox.vertices
  //let v2 = w2.boundingBox.vertices
  let hasProximity

  let aligned = [
    v2[2].y,
    v1[3].y,
    v2[3].y
  ].every(el => el === v1[2].y)

  if (aligned) {
    return true
  } else {
    hasProximity = isAproxUsingError(
      {
        y1: v1[3].y,
        y2: v1[2].y
      }, {
        y1: v2[3].y,
        y2: v2[2].y
      },
      err
    )

    return hasProximity
  }
}

const topHorizontalAligned = (v1, v2, err) => {
  //let v1 = v1.boundingBox.vertices
  //let v2 = w2.boundingBox.vertices
  let hasProximity

  let aligned = [
    v2[0].y,
    v1[0].y,
    v2[1].y
  ].every(el => el === v1[1].y)

  if (aligned) {
    return true
  } else {
    hasProximity = isAproxUsingError(
      {
        y1: v1[0].y,
        y2: v1[1].y
      }, {
        y1: v2[0].y,
        y2: v2[1].y
      },
      err
    )

    return hasProximity
  }
}

/**
 *
 * use error to determine if both lines are aligned
 *
 * @param {Number} err this number is in pixels
 *
 */
const isAproxUsingError = (line1, line2, err=3) => {
  let ln1err, ln2err
  let ln1avg, ln2avg

  if (line1.y1 != line1.y2) {
    ln1avg = Math.round((line1.y1 + line1.y2) / 2)
    ln1err = Math.round(Math.abs(line1.y1 - line1.y2))
  } else {
    ln1avg = line1.y1
    ln1err = 0
  }

  if (line2.y1 != line2.y2) {
    ln2avg = Math.round((line2.y1 + line2.y2) / 2)
    ln2err = Math.round(Math.abs(line2.y1 - line2.y2))
  } else {
    ln2avg = line2.y1
    ln2err = 0
  }

  // user line difference err
  if (ln1err>err) { err = ln1err }

  return ln2avg <= (ln1avg + err) && ln2avg >= (ln1avg - err)
}
