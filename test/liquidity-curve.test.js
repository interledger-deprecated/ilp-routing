'use strict'

const assert = require('assert')
const LiquidityCurve = require('../src/lib/liquidity-curve')

describe('LiquidityCurve', function () {
  describe('constructor', function () {
    it('saves the points', function () {
      const points = []
      const curve = new LiquidityCurve(points)
      assert.equal(curve.points, points)
    })
  })

  describe('setPoints', function () {
    it('sets the points', function () {
      const curve = new LiquidityCurve([])
      const points = []
      curve.setPoints(points)
      assert.equal(curve.points, points)
    })
  })

  describe('getPoints', function () {
    it('returns the points', function () {
      const points = []
      const curve = new LiquidityCurve(points)
      assert.equal(curve.getPoints(), points)
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

    it('ignores duplicate points', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 60], [50, 60] ])
      const curve2 = new LiquidityCurve([ [0, 0], [0, 0], [100, 100] ])
      assert.deepEqual(curve1.combine(curve2).getPoints(),
        [ [0, 0], [50, 60], [60, 60], [100, 100] ])
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
        [ [0, 0], [100, 60], [200, 60] ])
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
  })

  describe('shiftY', function () {
    it('shifts all of the points\' Ys by the specified amount', function () {
      const curve = new LiquidityCurve([ [0, 0], [50, 60], [100, 100] ])
      assert.deepStrictEqual(curve.shiftY(1).points,
        [ [0, 1], [50, 61], [100, 101] ])
    })
  })
})
