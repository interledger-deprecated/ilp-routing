'use strict'

const assert = require('assert')
const LiquidityCurve = require('../src/lib/liquidity-curve')

describe('LiquidityCurve', function () {
  describe('constructor', function () {
    it('saves the points', function () {
      const points = [ [1, 2], [3, 4] ]
      const curve = new LiquidityCurve(points)
      assert.deepEqual(curve.points, points)
    })
  })

  describe('setPoints', function () {
    it('sets the points', function () {
      const curve = new LiquidityCurve([])
      const points = [ [1, 2], [3, 4] ]
      curve.setPoints(points)
      assert.deepEqual(curve.points, points)
    })

    it('throws InvalidLiquidityCurveError if a point has a negative x-coordinate', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [-1, 5], [1, 5] ])
      }, /InvalidLiquidityCurveError: Curve has point with negative x-coordinate/)
    })

    it('throws InvalidLiquidityCurveError if a point has a negative y-coordinate', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [1, -5], [2, 5] ])
      }, /InvalidLiquidityCurveError: Curve has point with negative y-coordinate/)
    })

    it('throws InvalidLiquidityCurveError if the x-coordinates are not strictly increasing', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [1, 1], [3, 3], [3, 5] ])
      }, /InvalidLiquidityCurveError: Curve x-coordinates must strictly increase in series/)
    })

    it('throws InvalidLiquidityCurveError if the y-coordinates are not increasing', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [1, 1], [3, 3], [5, 2] ])
      }, /InvalidLiquidityCurveError: Curve y-coordinates must increase in series/)
    })
  })

  describe('getPoints', function () {
    it('returns the points', function () {
      const points = [ [1, 2], [3, 4] ]
      const curve = new LiquidityCurve(points)
      assert.deepEqual(curve.getPoints(), points)
    })
  })

  describe('amountAt', function () {
    const curve = new LiquidityCurve([[10, 20], [100, 200]])

    it('returns 0 if "x" is too low', function () {
      assert.equal(curve.amountAt(0), 0)
      assert.equal(curve.amountAt(-10), 0)
    })

    it('returns the maximum if "x" is too high', function () {
      assert.equal(curve.amountAt(101), 200)
      assert.equal(curve.amountAt(1000), 200)
    })

    it('returns the linear interpolation of intermediate "x" values', function () {
      assert.equal(curve.amountAt(10), 20)
      assert.equal(curve.amountAt(11), 22)
      assert.equal(curve.amountAt(55), 110)
      assert.equal(curve.amountAt(100), 200)
    })

    it('returns an exact "y" value when possible', function () {
      const curve = new LiquidityCurve([[0, 0], [50, 100], [100, 1000]])
      assert.equal(curve.amountAt(50), 100)
    })
  })

  describe('amountReverse', function () {
    const curve = new LiquidityCurve([[10, 20], [100, 200]])

    it('returns the minimum "x" if "y" is too low', function () {
      assert.equal(curve.amountReverse(0), 10)
      assert.equal(curve.amountReverse(-10), 10)
    })

    it('returns Infinity if "y" is too high', function () {
      assert.equal(curve.amountReverse(201), Infinity)
      assert.equal(curve.amountReverse(1000), Infinity)
    })

    it('returns the linear interpolation of intermediate "y" values', function () {
      assert.equal(curve.amountReverse(20), 10)
      assert.equal(curve.amountReverse(22), 11)
      assert.equal(curve.amountReverse(110), 55)
      assert.equal(curve.amountReverse(200), 100)
    })
  })

  describe('combine', function () {
    it('finds an intersection between a slope and a flat line', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 60] ])
      const curve2 = new LiquidityCurve([ [0, 0], [100, 100] ])
      const combinedCurve = curve1.combine(curve2)

      assert.deepStrictEqual(combinedCurve.getPoints(),
        [ [0, 0], [50, 60], [60, 60], [100, 100] ])
      assert.equal(combinedCurve.amountAt(25), 30)
      assert.equal(combinedCurve.amountAt(50), 60)
      assert.equal(combinedCurve.amountAt(60), 60)
      assert.equal(combinedCurve.amountAt(70), 70)
    })

    it('ignores an empty curve', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 60] ])
      const curve2 = new LiquidityCurve([])
      assert.deepEqual(curve1.combine(curve2).getPoints(), [[0, 0], [50, 60]])
      assert.deepEqual(curve2.combine(curve1).getPoints(), [[0, 0], [50, 60]])
    })

    it('finds an intersection between two slopes', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [100, 1000] ])
      const curve2 = new LiquidityCurve([ [0, 0], [100 / 3, 450], [200 / 3, 550] ])
      const result = [ [0, 0], [100 / 3, 450], [50, 500], [200 / 3, 666.6666666666667], [100, 1000] ]
      assert.deepEqual(curve1.combine(curve2).getPoints(), result)
      assert.deepEqual(curve2.combine(curve1).getPoints(), result)
    })
  })

  describe('join', function () {
    it('composes two routes', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [200, 100] ])
      const curve2 = new LiquidityCurve([ [0, 0], [50, 60] ])
      const joinedCurve = curve1.join(curve2)

      assert.deepStrictEqual(joinedCurve.points,
        [ [0, 0], [100, 60] ])
      assert.equal(joinedCurve.amountAt(50), 30)
      assert.equal(joinedCurve.amountAt(100), 60)
      assert.equal(joinedCurve.amountAt(200), 60)
    })

    it('truncates the domain as necessary', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 100] ])
      const curve2 = new LiquidityCurve([ [0, 0], [200, 300] ])
      const joinedCurve = curve1.join(curve2)
      assert.deepEqual(joinedCurve.points,
        [ [0, 0], [50, 150] ])
    })

    it('handles joining with a right-shifted curve', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [10, 10] ])
      const curve2 = new LiquidityCurve([ [1, 1], [11, 11] ])
      const joinedCurve = curve1.join(curve2)
      assert.deepEqual(joinedCurve.points,
        [ [1, 1], [10, 10] ])
    })
  })

  describe('shiftX', function () {
    it('shifts all of the points\' Xs by the specified amount', function () {
      const curve = new LiquidityCurve([ [0, 0], [50, 60], [100, 100] ])
      assert.deepStrictEqual(curve.shiftX(1).points,
        [ [1, 0], [51, 60], [101, 100] ])
    })

    it('stays positive', function () {
      const curve = new LiquidityCurve([ [0, 0], [10, 10] ])
      assert.deepStrictEqual(curve.shiftX(-5).points,
        [ [0, 5], [5, 10] ])
    })

    it('shifts a single point and stays positive', function () {
      const curve = new LiquidityCurve([ [5, 5] ])
      assert.deepStrictEqual(curve.shiftX(-10).points,
        [ [0, 5] ])
    })
  })

  describe('shiftY', function () {
    it('shifts all of the points\' Ys by the specified amount', function () {
      const curve = new LiquidityCurve([ [0, 0], [50, 60], [100, 100] ])
      assert.deepStrictEqual(curve.shiftY(1).points,
        [ [0, 1], [50, 61], [100, 101] ])
    })

    it('stays positive', function () {
      const curve = new LiquidityCurve([ [0, 0], [10, 10] ])
      assert.deepStrictEqual(curve.shiftY(-5).points,
        [ [5, 0], [10, 5] ])
    })
  })
})
