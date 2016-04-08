'use strict'

const simplify = require('code42day-vis-why')

class Route {
  constructor (points) {
    this.setPoints(points)
  }

  setPoints (points) {
    this.points = points
  }

  getPoints () {
    return this.points
  }

  amountAt (x) {
    if (this.points[0][0] >= x) {
      return 0
    }
    if (this.points[this.points.length - 1][0] <= x) {
      return this.points[this.points.length - 1][1]
    }

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
    return new Route(simplify(this.points, maxPoints))
  }

  combine (route) {
    return new Route(
      this._combineWithPoints(route.points)
        .concat(route._combineWithPoints(this.points))
        .concat(this._intersect(route))
        .concat(route._intersect(this))
        .sort(comparePoints))
  }

  _combineWithPoints (points) {
    if (this.points.length === 0) return points
    return points.map((point) => [
      point[0],
      Math.max(point[1], this.amountAt(point[0]))
    ])
  }

  _intersect (route) {
    if (route.points.length === 0) return []
    return this.points.map((point) => {
      const otherX = route.amountReverse(point[1])
      return [otherX, this.amountAt(otherX)]
    }).filter(pointNotInfinity)
  }

  join (route) {
    return new Route(
      this.points
        .map((p) => [ p[0], route.amountAt(p[1]) ])
      .concat(route.points
        .map((p) => [ this.amountReverse(p[0]), p[1] ])
      ).sort(comparePoints))
  }
}

function pointNotInfinity (point) { return point[0] !== Infinity }
function comparePoints (a, b) { return a[0] - b[0] }

module.exports = Route
