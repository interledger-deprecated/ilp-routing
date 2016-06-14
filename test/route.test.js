'use strict'

const assert = require('assert')
const sinon = require('sinon')
const Route = require('../src/lib/route')
const LiquidityCurve = require('../src/lib/liquidity-curve')

const START_DATE = 1434412800000 // June 16, 2015 00:00:00 GMT
const ledgerA = 'http://ledgerA.example'
const ledgerB = 'http://ledgerB.example'
const ledgerC = 'http://ledgerC.example'
const ledgerD = 'http://ledgerD.example'
const hopsABC = [ledgerA, ledgerB, ledgerC]
const hopsADC = [ledgerA, ledgerD, ledgerC]
const hopsBCD = [ledgerB, ledgerC, ledgerD]

const mark = 'http://mark.example'
const mary = 'http://mary.example'
const markA = ledgerA + '/accounts/mark'
const markC = ledgerC + '/accounts/mark'

describe('Route', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers(START_DATE)
  })

  describe('constructor', function () {
    it('sets up a curve and the hops', function () {
      const route = new Route([[0, 0], [100, 200]], hopsABC, {
        minMessageWindow: 3,
        expiresAt: 1234,
        connector: mark,
        sourceAccount: markA,
        destinationAccount: markC,
        additionalInfo: {foo: 'bar'}
      })

      assert.ok(route.curve instanceof LiquidityCurve)
      assert.deepEqual(route.hops, hopsABC)
      assert.equal(route.sourceLedger, ledgerA)
      assert.equal(route.nextLedger, ledgerB)
      assert.equal(route.destinationLedger, ledgerC)

      assert.equal(route.minMessageWindow, 3)
      assert.equal(route.expiresAt, 1234)
      assert.equal(route.connector, mark)
      assert.equal(route.sourceAccount, markA)
      assert.equal(route.destinationAccount, markC)
      assert.deepStrictEqual(route.additionalInfo, {foo: 'bar'})
    })
  })

  describe('LiquidityCurve methods', function () {
    const route = new Route([[10, 20], [100, 200]], hopsABC, {})
    describe('amountAt', function () {
      it('finds the corresponding amount', function () {
        assert.equal(route.amountAt(55), 110)
      })
    })

    describe('amountReverse', function () {
      it('finds the corresponding amount', function () {
        assert.equal(route.amountReverse(110), 55)
      })
    })

    describe('getPoints', function () {
      it('finds the corresponding amount', function () {
        assert.deepStrictEqual(route.getPoints(), [[10, 20], [100, 200]])
      })
    })
  })

  describe('combine', function () {
    const route1 = new Route([[0, 0], [100, 100]], hopsABC, { minMessageWindow: 1 })
    const route2 = new Route([[0, 0], [50, 60]], hopsADC, { minMessageWindow: 2 })
    const combinedRoute = route1.combine(route2)

    it('combines the curves', function () {
      assert.deepEqual(combinedRoute.getPoints(),
        [ [0, 0], [50, 60], [60, 60], [100, 100] ])
    })

    it('only uses the boundary ledgers in "hops"', function () {
      assert.deepEqual(combinedRoute.hops, [ledgerA, ledgerC])
    })

    it('picks the larger minMessageWindow', function () {
      assert.equal(combinedRoute.minMessageWindow, 2)
    })
  })

  describe('join', function () {
    it('succeeds if the routes are adjacent', function () {
      const route1 = new Route([ [0, 0], [200, 100] ], [ledgerA, ledgerB], {
        connector: mark,
        minMessageWindow: 1
      })
      const route2 = new Route([ [0, 0], [50, 60] ], hopsBCD, {
        connector: mary,
        minMessageWindow: 2
      })
      const joinedRoute = route1.join(route2, 1000)

      // It joins the curves
      assert.deepEqual(joinedRoute.getPoints(),
        [ [0, 0], [100, 60], [200, 60] ])
      // It concatenates the hops
      assert.deepEqual(joinedRoute.hops, [ledgerA, ledgerB, ledgerC, ledgerD])
      // It uses the head route's connector
      assert.equal(joinedRoute.connector, mark)
      // It combines the minMessageWindows
      assert.equal(joinedRoute.minMessageWindow, 3)
      // It sets an expiry in the future
      assert.ok(Date.now() < joinedRoute.expiresAt)
    })

    it('fails if the routes aren\'t adjacent', function () {
      const route1 = new Route([ [0, 0], [200, 100] ], [ledgerA, ledgerB], {})
      const route2 = new Route([ [0, 0], [50, 60] ], [ledgerC, ledgerD], {})
      assert.strictEqual(route1.join(route2, 0), undefined)
    })

    it('fails if the joined route would double back', function () {
      const route1 = new Route([ [0, 0], [200, 100] ], [ledgerB, ledgerA], {})
      const route2 = new Route([ [0, 0], [50, 60] ], hopsABC, {})
      assert.strictEqual(route1.join(route2, 0), undefined)
    })
  })

  describe('shiftY', function () {
    it('creates a shifted route', function () {
      const route1 = new Route([ [0, 0], [50, 60], [100, 100] ], [ledgerA, ledgerB], {connector: mark})
      const route2 = route1.shiftY(1)
      assert.equal(route2.connector, mark)
      assert.deepEqual(route2.curve.points,
        [ [0, 1], [50, 61], [100, 101] ])
    })
  })

  describe('isExpired', function () {
    it('doesn\'t expire routes by default', function () {
      const route1 = new Route([ [0, 0], [200, 100] ], [ledgerA, ledgerB], {})
      const route2 = new Route([ [0, 0], [200, 100] ], [ledgerA, ledgerB], {expiresAt: Date.now() + 1000})
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)

      this.clock.tick(2000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), true)
    })
  })
})
