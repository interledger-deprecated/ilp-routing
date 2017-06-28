'use strict'

const assert = require('assert')
const sinon = require('sinon')
const Route = require('../src/lib/route')
const LiquidityCurve = require('../src/lib/liquidity-curve')

const START_DATE = 1434412800000 // June 16, 2015 00:00:00 GMT
const ledgerA = 'ledgerA.'
const ledgerB = 'ledgerB.'
const ledgerC = 'ledgerC.'
const ledgerD = 'ledgerD.'
const hopsABC = { sourceLedger: ledgerA, nextLedger: ledgerB, destinationLedger: ledgerC }
const hopsADC = { sourceLedger: ledgerA, nextLedger: ledgerD, destinationLedger: ledgerC }
const hopsBCD = { sourceLedger: ledgerB, nextLedger: ledgerC, destinationLedger: ledgerD }

const markA = ledgerA + 'mark'
const markC = ledgerC + 'mark'

describe('Route', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers(START_DATE)
  })

  describe('constructor', function () {
    it('sets up a curve and the hops', function () {
      const route = new Route([[0, 0], [100, 200]], Object.assign({
        minMessageWindow: 3,
        expiresAt: 1234,
        isLocal: true,
        sourceAccount: markA,
        destinationAccount: markC,
        additionalInfo: {foo: 'bar'}
      }, hopsABC))

      assert.ok(route.curve instanceof LiquidityCurve)
      assert.equal(route.sourceLedger, ledgerA)
      assert.equal(route.nextLedger, ledgerB)
      assert.equal(route.destinationLedger, ledgerC)
      assert.deepEqual(route.paths, [[]])

      assert.equal(route.targetPrefix, route.destinationLedger,
        'should default target prefix to destination ledger')

      assert.equal(route.minMessageWindow, 3)
      assert.equal(route.expiresAt, 1234)
      assert.equal(route.isLocal, true)
      assert.equal(route.sourceAccount, markA)
      assert.equal(route.destinationAccount, markC)
      assert.deepStrictEqual(route.additionalInfo, {foo: 'bar'})
    })

    it('allows targetPrefix=""', function () {
      const route = new Route([[0, 0], [100, 200]], Object.assign({
        minMessageWindow: 3,
        sourceAccount: markA,
        destinationAccount: markC,
        targetPrefix: ''
      }, hopsABC))
      assert.equal(route.targetPrefix, '')
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
    const route1 = new Route([[0, 0], [100, 100]], Object.assign({ minMessageWindow: 1 }, hopsABC), [['path1.']])
    const route2 = new Route([[0, 0], [50, 60]], Object.assign({ minMessageWindow: 2 }, hopsADC), [['path2a.'], ['path2b.']])
    const route3 = new Route([[0, 0], [50, 60]], Object.assign({ minMessageWindow: 2 }, hopsADC), [['path3a1.', 'path3a2.'], ['path3b.']])
    const combinedRoute = route1.combine(route2)
    const combinedFirstLonger = route3.combine(route1)
    const combinedSecondLonger = route1.combine(route3)

    it('combines the curves', function () {
      assert.deepEqual(combinedRoute.getPoints(),
        [[0, 0], [50, 60], [60, 60], [100, 100]])
    })

    it('picks second if first is longer', function () {
      assert.deepEqual(combinedFirstLonger.getPoints(),
        [[0, 0], [100, 100]])
      assert.equal(combinedFirstLonger.sourceLedger, ledgerA)
      assert.equal(combinedFirstLonger.nextLedger, ledgerB)
      assert.equal(combinedFirstLonger.destinationLedger, ledgerC)
      assert.deepEqual(combinedFirstLonger.paths, [ [ 'path1.' ] ])
    })

    it('picks first if second is longer', function () {
      assert.deepEqual(combinedSecondLonger.getPoints(),
        [[0, 0], [100, 100]])
      assert.equal(combinedSecondLonger.sourceLedger, ledgerA)
      assert.equal(combinedSecondLonger.nextLedger, ledgerB)
      assert.equal(combinedSecondLonger.destinationLedger, ledgerC)
      assert.deepEqual(combinedSecondLonger.paths, [ [ 'path1.' ] ])
    })

    it('only uses the boundary ledgers in "hops"', function () {
      assert.equal(combinedRoute.sourceLedger, ledgerA)
      assert.equal(combinedRoute.nextLedger, ledgerB)
      assert.equal(combinedRoute.destinationLedger, ledgerC)
      assert.deepEqual(combinedRoute.paths, [
        [ 'path1.' ],
        [ 'path2a.' ],
        [ 'path2b.' ]
      ])
    })

    it('picks the larger minMessageWindow', function () {
      assert.equal(combinedRoute.minMessageWindow, 2)
    })
  })

  describe('join', function () {
    it('succeeds if the routes are adjacent', function () {
      const route1 = new Route([[0, 0], [200, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        isLocal: true,
        minMessageWindow: 1
      }, [['path1a.'], ['path1b.']])
      const route2 = new Route([[0, 0], [50, 60]], Object.assign({
        isLocal: false,
        minMessageWindow: 2
      }, hopsBCD), [['path2a1.', 'path2a2.'], ['path2b.']])
      const joinedRoute = route1.join(route2, 1000)

      // It joins the curves
      assert.deepEqual(joinedRoute.getPoints(),
        [[0, 0], [100, 60]])
      // It concatenates the hops to ledgerA ledger, *[ 'path1a.' || 'path1b.' ]* ledgerC *[ ('path2a1.', 'path2a2.') || 'path2b.' ]* ledgerD
      assert.deepEqual(joinedRoute.sourceLedger, ledgerA)
      assert.deepEqual(joinedRoute.nextLedger, ledgerB)
      assert.deepEqual(joinedRoute.destinationLedger, ledgerD)
      assert.deepEqual(joinedRoute.paths, [
        [ 'path1a.', ledgerC, 'path2a1.', 'path2a2.' ],
        [ 'path1a.', ledgerC, 'path2b.' ],
        [ 'path1b.', ledgerC, 'path2a1.', 'path2a2.' ],
        [ 'path1b.', ledgerC, 'path2b.' ]
      ])
      // It isn't a local pair.
      assert.equal(joinedRoute.isLocal, false)
      // It combines the minMessageWindows
      assert.equal(joinedRoute.minMessageWindow, 3)
      // It sets an expiry in the future
      assert.ok(Date.now() < joinedRoute.expiresAt)
    })

    it('sets isLocal to true if both routes are local', function () {
      const route1 = new Route([[0, 0], [200, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        isLocal: true,
        minMessageWindow: 1
      })
      const route2 = new Route([[0, 0], [50, 60]], Object.assign({
        isLocal: true,
        minMessageWindow: 2
      }, hopsBCD))
      const joinedRoute = route1.join(route2, 1000)

      // It is a local pair.
      assert.equal(joinedRoute.isLocal, true)
    })

    it('fails if the routes aren\'t adjacent', function () {
      const route1 = new Route([[0, 0], [200, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB
      })
      const route2 = new Route([[0, 0], [50, 60]], {
        sourceLedger: ledgerC,
        nextLedger: ledgerD
      })
      assert.strictEqual(route1.join(route2, 0), undefined)
    })

    it('fails if the joined route would double back', function () {
      const route1 = new Route([[0, 0], [200, 100]], {
        sourceLedger: ledgerB,
        nextLedger: ledgerA
      })
      const route2 = new Route([[0, 0], [50, 60]], hopsABC)
      assert.strictEqual(route1.join(route2, 0), undefined)
    })
  })

  describe('shiftX', function () {
    it('creates a shifted route', function () {
      const route1 = new Route([[0, 0], [50, 60], [100, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        isLocal: true
      }, [['some.path.']])
      const route2 = route1.shiftX(1)
      assert.equal(route2.isLocal, true)
      assert.deepEqual(route2.curve.getPoints(),
        [[1, 0], [51, 60], [101, 100]])
      assert.deepEqual(route2.paths, [['some.path.']])
    })
  })

  describe('shiftY', function () {
    it('creates a shifted route', function () {
      const route1 = new Route([[0, 0], [50, 60], [100, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        isLocal: true
      }, [['some.path.']])
      const route2 = route1.shiftY(1)
      assert.equal(route2.isLocal, true)
      assert.deepEqual(route2.curve.getPoints(),
        [[0, 1], [50, 61], [100, 101]])
      assert.deepEqual(route2.paths, [['some.path.']])
    })
  })

  describe('isExpired', function () {
    it('doesn\'t expire routes by default', function () {
      const route1 = new Route([[0, 0], [200, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB
      })
      const route2 = new Route([[0, 0], [200, 100]], {
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        expiresAt: Date.now() + 1000
      })
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)

      this.clock.tick(2000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), true)
    })
  })

  describe('bumpExpiration', function () {
    it('doesn\'t expire routes that have been bumped, but they expire when specified', function () {
      const route1 = new Route([[0, 0], [200, 100]], { sourceLedger: ledgerA, nextLedger: ledgerB })
      const route2 = new Route([[0, 0], [200, 100]], { sourceLedger: ledgerA, nextLedger: ledgerB, expiresAt: Date.now() + 1000 })
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)

      route2.bumpExpiration(3000)
      this.clock.tick(2000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)
      this.clock.tick(5000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), true)
    })
  })
})
