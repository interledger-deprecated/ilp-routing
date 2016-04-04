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
    const combinedPoints = this.points.concat(route.points)
    combinedPoints.sort((a, b) => a[0] - b[0])
    return new Route(combinedPoints.map((p) => [
      p[0],
      Math.max(this.amountAt(p[0]), route.amountAt(p[0]))
    ]))
  }

  join (route) {
    const combinedPoints = this.points.concat(route.points)
    combinedPoints.sort((a, b) => a[0] - b[0])
    return new Route(combinedPoints.map((p) => [
      p[0],
      route.amountAt(this.amountAt(p[0]))
    ]))
  }
}

module.exports = Route
