'use strict'

const simplify = require('code42day-vis-why')

class LiquidityCurve {
  constructor (points) {
    this.setPoints(points)
  }

  setPoints (points) {
    let prev
    this.points = points.slice()
    for (let i = 0; i < this.points.length; i++) {
      let point = this.points[i]
      if (point[0] < 0) throw new InvalidLiquidityCurveError('Curve has point with negative x-coordinate')
      if (point[1] < 0) throw new InvalidLiquidityCurveError('Curve has point with negative y-coordinate')
      if (prev && point[0] <= prev[0]) {
        throw new InvalidLiquidityCurveError('Curve x-coordinates must strictly increase in series')
      }
      if (prev && point[1] < prev[1]) {
        throw new InvalidLiquidityCurveError('Curve y-coordinates must increase in series')
      }
      prev = point
    }
  }

  getPoints () {
    return this.points
  }

  amountAt (x) {
    if (x < this.points[0][0]) return 0
    if (x === this.points[0][0]) return this.points[0][1]
    const lastPoint = this.points[this.points.length - 1]
    if (lastPoint[0] <= x) return lastPoint[1]

    let i; for (i = 0; this.points[i][0] < x; i++) ;

    const pointA = this.points[i - 1]
    const pointB = this.points[i]
    return (pointB[1] - pointA[1]) / (pointB[0] - pointA[0]) * (x - pointA[0]) +
      pointA[1]
  }

  amountReverse (y) {
    if (this.points[0][1] >= y) {
      return this.points[0][0]
    }
    if (this.points[this.points.length - 1][1] < y) {
      return Infinity
    }

    let i; for (i = 0; this.points[i][1] < y; i++) ;

    const pointA = this.points[i - 1]
    const pointB = this.points[i]
    return (pointB[0] - pointA[0]) / (pointB[1] - pointA[1]) * (y - pointA[1]) +
      pointA[0]
  }

  /**
   * Simplify route to contain a maximum number of points.
   *
   * Uses the Visvalingam-Whyatt line simplification algorithm.
   */
  simplify (maxPoints) {
    return new LiquidityCurve(simplify(this.points, maxPoints))
  }

  /**
   * Combine two parallel routes, generating a new curve consisting of the best
   * segments of each.
   *
   * @param {LiquidityCurve} curve
   * @returns {LiquidityCurve}
   */
  combine (curve) {
    return new LiquidityCurve(
      this._mapToMax(curve.points)
        .concat(curve._mapToMax(this.points))
        .concat(this._crossovers(curve))
        .sort(comparePoints)
        .filter(omitDuplicates))
  }

  /**
   * A._mapToMax(B) to find [AB, A]
   * B._mapToMax(A) to find [AB, B]
   *
   * │              B
   * │    A a a a a a
   * │   a    b
   * │  a  b
   * │ AB
   * └────────────────
   */
  _mapToMax (points) {
    if (this.points.length === 0) return points
    return points.map((point) => [
      point[0],
      Math.max(point[1], this.amountAt(point[0]))
    ])
  }

  /**
   * A._crossovers(B) to find [AB, ●]
   *
   * │              B
   * │    A a a a●a a
   * │   a    b
   * │  a  b
   * │ AB
   * └────────────────
   */
  _crossovers (curve) {
    if (this.points.length === 0 || curve.points.length === 0) return []
    const endA = this.points[this.points.length - 1]
    const endB = curve.points[curve.points.length - 1]
    let pointsA = this.points
    let pointsB = curve.points
    if (endA[0] < endB[0]) pointsA = pointsA.concat([ [endB[0], endA[1]] ])
    if (endB[0] < endA[0]) pointsB = pointsB.concat([ [endA[0], endB[1]] ])

    const result = []
    this._eachOverlappingSegment(pointsA, pointsB, (lineA, lineB) => {
      const solution = intersectLineSegments(lineA, lineB)
      if (solution) result.push(solution)
    })
    return result
  }

  /**
   * @param {Point[]} pointsA
   * @param {Point[]} pointsB
   * @param {function(lineA, lineB)} each
   */
  _eachOverlappingSegment (pointsA, pointsB, each) {
    let cursor = 1
    for (let indexA = 1; indexA < pointsA.length; indexA++) {
      const lineA = toLine(pointsA[indexA - 1], pointsA[indexA])
      for (let indexB = cursor; indexB < pointsB.length; indexB++) {
        const lineB = toLine(pointsB[indexB - 1], pointsB[indexB])
        if (lineB.x1 < lineA.x0) { cursor++; continue }
        if (lineA.x1 < lineB.x0) break
        each(lineA, lineB)
      }
    }
  }

  /**
   * Compose two routes end-to-end: A→B.join(B→C) becomes A→C.
   * @param {LiquidityCurve} curve
   * @returns {LiquidityCurve}
   */
  join (curve) {
    const leftPoints = []
    const minX = curve.points[0][0]
    const maxX = curve.points[curve.points.length - 1][0]
    this.points.forEach((p) => {
      // If `p.y` is not within `curve`'s domain, don't use it to form the new curve.
      if (minX <= p[1] && p[1] <= maxX) {
        leftPoints.push([ p[0], curve.amountAt(p[1]) ])
      }
    })

    return new LiquidityCurve(
      leftPoints
        .concat(curve.points
          .map((p) => [ this.amountReverse(p[0]), p[1] ])
        )
        .sort(comparePoints)
        .filter(omitInfinity)
        .filter(omitDuplicates)
    )
  }

  shiftX (dx) {
    let shiftedPoints = this.points.map((p) => [ p[0] + dx, p[1] ])
    if (dx >= 0) return new LiquidityCurve(shiftedPoints)

    for (let i = shiftedPoints.length - 1; i >= 0; i--) {
      if (shiftedPoints[i][0] < 0) {
        shiftedPoints = shiftedPoints.slice(i + 1)
        shiftedPoints.unshift([0, this.amountAt(-dx)])
        break
      }
    }
    return new LiquidityCurve(shiftedPoints)
  }

  shiftY (dy) {
    let shiftedPoints = this.points.map((p) => [ p[0], p[1] + dy ])
    if (dy >= 0) return new LiquidityCurve(shiftedPoints)

    for (let i = shiftedPoints.length - 1; i >= 0; i--) {
      if (shiftedPoints[i][1] < 0) {
        shiftedPoints = shiftedPoints.slice(i + 1)
        shiftedPoints.unshift([this.amountReverse(-dy), 0])
        break
      }
    }
    return new LiquidityCurve(shiftedPoints)
  }
}

function comparePoints (a, b) { return a[0] - b[0] }

function omitInfinity (point) { return point[0] !== Infinity }

function omitDuplicates (point, i, points) {
  return i === 0 || (point[0] !== points[i - 1][0])
}

/**
 *      y₁ - y₀       x₁y₀ - x₀y₁
 * y = ───────── x + ───────────── = mx + b
 *      x₁ - x₀         x₁ - x₀
 */
function toLine (pA, pB) {
  const x0 = pA[0]; const x1 = pB[0]
  const y0 = pA[1]; const y1 = pB[1]
  const dx = x1 - x0
  const m = (y1 - y0) / dx
  const b = (x1 * y0 - x0 * y1) / dx
  return {m, b, x0, x1}
}

/**
 * y = m₀x + b₀ = m₁x + b₁
 *
 *      b₁ - b₀
 * x = ───────── ; line0.x₀ ≤ x ≤ line0.x₁ and line1.x₀ ≤ x ≤ line1.x₁
 *      m₀ - m₁
 */
function intersectLineSegments (line0, line1) {
  if (line0.m === line1.m) return
  if (isNaN(line0.m) || isNaN(line1.m)) return
  const x = (line1.b - line0.b) / (line0.m - line1.m)
  const y = line0.m * x + line0.b
  // Verify that the solution is in the domain.
  if (x < line0.x0 || line0.x1 < x) return
  if (x < line1.x0 || line1.x1 < x) return
  return [x, y]
}

class InvalidLiquidityCurveError extends Error {
  constructor (message) {
    super(message)
    this.name = 'InvalidLiquidityCurveError'
  }
}

module.exports = LiquidityCurve
