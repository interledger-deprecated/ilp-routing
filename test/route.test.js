'use strict'

const assert = require('assert')
const Route = require('../src/lib/route')

describe('Route', function () {
  describe('setPoints', function () {
    it('sets the route\'s points', function () {
      const route = new Route([])
      const points = []
      route.setPoints(points)
      assert.equal(route.points, points)
    })
  })

  describe('getPoints', function () {
    it('returns the route\'s points', function () {
      const points = []
      const route = new Route(points)
      assert.equal(route.getPoints(), points)
    })
  })

  describe('amountAt', function () {
    const route = new Route([[10, 20], [100, 200]])

    it('returns 0 if "x" is too low', function () {
      assert.equal(route.amountAt(0), 0)
      assert.equal(route.amountAt(-10), 0)
    })

    it('returns the maximum if "x" is too high', function () {
      assert.equal(route.amountAt(101), 200)
      assert.equal(route.amountAt(1000), 200)
    })

    it('returns the linear interpolation of intermediate "x" values', function () {
      assert.equal(route.amountAt(10), 20)
      assert.equal(route.amountAt(11), 22)
      assert.equal(route.amountAt(55), 110)
      assert.equal(route.amountAt(100), 200)
    })

    it('returns an exact "y" value when possible', function () {
      const route2 = new Route([[0, 0], [50, 100], [100, 1000]])
      assert.equal(route2.amountAt(50), 100)
    })
  })

  describe('amountReverse', function () {
    const route = new Route([[10, 20], [100, 200]])

    it('returns the minimum "x" if "y" is too low', function () {
      assert.equal(route.amountReverse(0), 10)
      assert.equal(route.amountReverse(-10), 10)
    })

    it('returns Infinity if "y" is too high', function () {
      assert.equal(route.amountReverse(201), Infinity)
      assert.equal(route.amountReverse(1000), Infinity)
    })

    it('returns the linear interpolation of intermediate "y" values', function () {
      assert.equal(route.amountReverse(20), 10)
      assert.equal(route.amountReverse(22), 11)
      assert.equal(route.amountReverse(110), 55)
      assert.equal(route.amountReverse(200), 100)
    })
  })

  describe('combine', function () {
    it('finds an intersection between a slope and a flat line', function () {
      const route1 = new Route([ [0, 0], [50, 60] ])
      const route2 = new Route([ [0, 0], [100, 100] ])
      const route = route1.combine(route2)

      assert.deepStrictEqual(route.getPoints(),
        [ [0, 0], [50, 60], [60, 60], [100, 100] ])
      assert.equal(route.amountAt(25), 30)
      assert.equal(route.amountAt(50), 60)
      assert.equal(route.amountAt(60), 60)
      assert.equal(route.amountAt(70), 70)
    })

    it('ignores an empty curve', function () {
      const route1 = new Route([ [0, 0], [50, 60] ])
      const route2 = new Route([])
      assert.deepEqual(route1.combine(route2).getPoints(), [[0, 0], [50, 60]])
      assert.deepEqual(route2.combine(route1).getPoints(), [[0, 0], [50, 60]])
    })

    it('ignores duplicate points', function () {
      const route1 = new Route([ [0, 0], [50, 60], [50, 60] ])
      const route2 = new Route([ [0, 0], [0, 0], [100, 100] ])
      assert.deepEqual(route1.combine(route2).getPoints(),
        [ [0, 0], [50, 60], [60, 60], [100, 100] ])
    })

    it('finds an intersection between two slopes', function () {
      const route1 = new Route([ [0, 0], [100, 1000] ])
      const route2 = new Route([ [0, 0], [100 / 3, 450], [200 / 3, 550] ])
      const result = [ [0, 0], [100 / 3, 450], [50, 500], [200 / 3, 666.6666666666667], [100, 1000] ]
      assert.deepEqual(route1.combine(route2).getPoints(), result)
      assert.deepEqual(route2.combine(route1).getPoints(), result)
    })
  })

  describe('join', function () {
    it('composes two routes', function () {
      const route1 = new Route([ [0, 0], [200, 100] ])
      const route2 = new Route([ [0, 0], [50, 60] ])
      const route = route1.join(route2)

      assert.deepStrictEqual(route.points,
        [ [0, 0], [100, 60], [200, 60] ])
      assert.equal(route.amountAt(50), 30)
      assert.equal(route.amountAt(100), 60)
      assert.equal(route.amountAt(200), 60)
    })

    it('truncates the domain as necessary', function () {
      const route1 = new Route([ [0, 0], [50, 100] ])
      const route2 = new Route([ [0, 0], [200, 300] ])
      const route = route1.join(route2)
      assert.deepEqual(route.points,
        [ [0, 0], [50, 150] ])
    })
  })
})
