'use strict'

const assert = require('assert')
const RoutingTables = require('../src/lib/routing-tables')
const sinon = require('sinon')

const START_DATE = 1434412800000 // June 16, 2015 00:00:00 GMT
const ledgerA = 'ledgerA.'
const ledgerB = 'ledgerB.'
const ledgerC = 'ledgerC.'
const ledgerD = 'ledgerD.'
const ledgerE = 'ledgerE.'

// connector users
const markA = ledgerA + 'mark'
const markB = ledgerB + 'mark'

describe('RoutingTables', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers(START_DATE)
    this.tables = new RoutingTables([{
      source_ledger: ledgerA,
      destination_ledger: ledgerB,
      min_message_window: 1,
      source_account: markA,
      destination_account: markB,
      points: [ [0, 0], [200, 100] ],
      additional_info: { rate_info: '0.5' }
    }, {
      source_ledger: ledgerB,
      destination_ledger: ledgerA,
      min_message_window: 1,
      source_account: markB,
      destination_account: markA,
      points: [ [0, 0], [100, 200] ],
      additional_info: { rate_info: '2.0' }
    }], 45000)
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('addLocalRoutes', function () {
    it('routes between multiple local pairs, but doesn\'t combine them', function () {
      this.tables.addLocalRoutes([
        {
          source_ledger: ledgerB,
          destination_ledger: ledgerC,
          source_account: markB,
          min_message_window: 1,
          points: [ [0, 0], [100, 200] ]
        }, {
          source_ledger: ledgerC,
          destination_ledger: ledgerD,
          source_account: markB,
          min_message_window: 1,
          points: [ [0, 0], [100, 200] ]
        }
      ])
      this.tables.addRoute({
        source_ledger: ledgerD,
        destination_ledger: ledgerE,
        source_account: ledgerD + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [100, 200] ]
      })

      // A → B → C
      assertSubset(this.tables.findBestHopForSourceAmount(ledgerA, ledgerC, 20), {
        destinationLedger: ledgerB,
        destinationCreditAccount: ledgerB + 'mark',
        finalAmount: '20',
        minMessageWindow: 2
      })
      // A → B → C → D → E
      // It can't just skip from A→D, because it isn't a pair, even though its components are local.
      assertSubset(this.tables.findBestHopForSourceAmount(ledgerA, ledgerE, 20), {
        destinationLedger: ledgerB,
        destinationCreditAccount: ledgerB + 'mark',
        finalAmount: '80',
        minMessageWindow: 4
      })
      // C → D → E
      assertSubset(this.tables.findBestHopForSourceAmount(ledgerC, ledgerE, 20), {
        destinationLedger: ledgerD,
        destinationCreditAccount: ledgerD + 'mary',
        finalAmount: '80',
        minMessageWindow: 2
      })
    })
  })

  describe('addRoute', function () {
    it('doesn\'t create a route from A→B→A', function () {
      assert.strictEqual(
        this.tables.sources.get(ledgerA).destinations.get(ledgerA),
        null)
    })

    it('doesn\'t create a route from A→C→B if A→C isnt local', function () {
      // Implicitly create A→C
      assert.equal(this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }), true)
      // This should *not* create A→C→B, because A→C isn't local.
      assert.equal(this.tables.addRoute({
        source_ledger: ledgerC,
        destination_ledger: ledgerB,
        source_account: ledgerC + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [200, 100] ]
      }), false)
      assert.strictEqual(
        this.tables.sources.get(ledgerA).destinations.get(ledgerB).get(ledgerC + 'mary'),
        undefined)
    })

    it('creates a route with a custom prefix, if supplied', function () {
      const route = {
        target_prefix: 'prefix.',
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerC + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }

      // will be stored in destinations under 'prefix.'
      assert.equal(this.tables.addRoute(route), true)

      assertSubset(
        this.tables.sources.get(ledgerA).destinations.get('prefix.').get(ledgerC + 'mary'),
        { destinationLedger: ledgerC, targetPrefix: 'prefix.' })
    })

    it('doesn\'t override local pair paths with a remote one', function () {
      assert.equal(this.tables.addRoute({
        source_ledger: ledgerA,
        destination_ledger: ledgerB,
        source_account: ledgerA + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [200, 9999] ]
      }), false)
      // Dont create a second A→B
      assert.strictEqual(
        this.tables.sources.get(ledgerA).destinations.get(ledgerB).get(ledgerA + 'mary'),
        undefined)
    })

    it('doesn\'t override simple local path A→B with A→C→B', function () {
      this.tables.addLocalRoutes([
        {
          source_ledger: ledgerA,
          destination_ledger: ledgerC,
          source_account: ledgerA + 'mark',
          min_message_window: 1,
          points: [ [0, 0], [100, 999] ]
        }, {
          source_ledger: ledgerC,
          destination_ledger: ledgerB,
          source_account: ledgerC + 'mark',
          min_message_window: 1,
          points: [ [0, 0], [100, 999] ]
        }
      ])
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerB, 100),
        { bestHop: markB, bestValue: 50 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerB, 200),
        { bestHop: markB, bestValue: 100 })
    })
  })

  describe('_findBestHopForSourceAmount', function () {
    it('finds the best next hop when there is one route', function () {
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerB, 0),
        { bestHop: markB, bestValue: 0 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerB, 100),
        { bestHop: markB, bestValue: 50 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerB, 200),
        { bestHop: markB, bestValue: 100 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerB, 300),
        { bestHop: markB, bestValue: 100 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerB, ledgerA, 100),
        { bestHop: markA, bestValue: 200 })
    })

    it('finds the best next hop when there are multiple hops', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [200, 100] ]
      })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 100),
        { bestHop: ledgerB + 'mary', bestValue: 25 })
    })

    it('finds the best next hop when there are multiple routes', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'martin',
        min_message_window: 1,
        points: [ [0, 0], [100, 100] ]
      })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 100),
        { bestHop: ledgerB + 'mary', bestValue: 60 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 150),
        { bestHop: ledgerB + 'martin', bestValue: 75 })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 200),
        { bestHop: ledgerB + 'martin', bestValue: 100 })
    })
  })

  describe('_findBestHopForDestinationAmount', function () {
    it('finds the best next hop when there is one route', function () {
      assertSubset(
        this.tables._findBestHopForDestinationAmount(ledgerA, ledgerB, 0),
        { bestHop: markB, bestCost: 0 })
      assertSubset(
        this.tables._findBestHopForDestinationAmount(ledgerA, ledgerB, 50),
        { bestHop: markB, bestCost: 100 })
      assertSubset(
        this.tables._findBestHopForDestinationAmount(ledgerA, ledgerB, 100),
        { bestHop: markB, bestCost: 200 })
      assert.equal(
        this.tables._findBestHopForDestinationAmount(ledgerA, ledgerB, 150),
        undefined)
      assertSubset(
        this.tables._findBestHopForDestinationAmount(ledgerB, ledgerA, 200),
        { bestHop: markA, bestCost: 100 })
    })
  })

  describe('removeExpiredRoutes', function () {
    it('expires old routes', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })

      // expire nothing
      assert.equal(this.tables.toJSON(10).length, 3)
      this.tables.removeExpiredRoutes()
      assert.equal(this.tables.toJSON(10).length, 3)

      this.clock.tick(45001)
      let lll = this.tables.removeExpiredRoutes()
      assert.deepStrictEqual(lll, [ledgerC])
      assert.equal(this.tables.toJSON(10).length, 2)
    })

    it('doesn\'t expire noExpire routes', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }, true) // noExpire

      // expire nothing
      assert.equal(this.tables.toJSON(10).length, 3)
      this.tables.removeExpiredRoutes()
      assert.equal(this.tables.toJSON(10).length, 3)

      this.clock.tick(45001)
      this.tables.removeExpiredRoutes()
      // it shouldn't have expired
      assert.equal(this.tables.toJSON(10).length, 3)
    })
  })

  describe('bumpConnector', function () {
    it('resets expiration to a time in the future', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })
      assert.equal(this.tables.toJSON(10).length, 3)
      // assume removeExpiredRoutes is working
      this.clock.tick(45001)
      this.tables.bumpConnector(ledgerB + 'mary', 12345)
      this.tables.removeExpiredRoutes()
      assert.equal(this.tables.toJSON(10).length, 3)
    })
  })

  describe('invalidateConnector', function () {
    it('removes routes with a nextHop depending on a given connector', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'martin',
        min_message_window: 1,
        points: [ [0, 0], [100, 100] ]
      })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 100),
        { bestHop: ledgerB + 'mary', bestValue: 60 })
      this.tables.invalidateConnector(ledgerB + 'mary')
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 100),
        { bestHop: ledgerB + 'martin' })
      let lll = this.tables.invalidateConnector(ledgerB + 'martin')
      assert.deepStrictEqual(lll, [ledgerC])
    })
  })

  describe('invalidateConnectorsRoutesTo', function () {
    it('removes routes to a specific ledger, with a nextHop depending on a given connector', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerD,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'martin',
        min_message_window: 1,
        points: [ [0, 0], [100, 100] ]
      })
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 100),
        { bestHop: ledgerB + 'mary', bestValue: 60 })
      this.tables.invalidateConnectorsRoutesTo(ledgerB + 'mary', ledgerD)
      assertSubset(
        this.tables._findBestHopForSourceAmount(ledgerA, ledgerC, 100),
        { bestHop: ledgerB + 'mary', bestValue: 60 })
    })
  })

  describe('removeLedger', function () {
    it('removes all of a ledger\'s routes', function () {
      this.tables.addLocalRoutes([{
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }, {
        source_ledger: ledgerA,
        destination_ledger: ledgerC,
        source_account: ledgerA + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }, {
        source_ledger: ledgerC,
        destination_ledger: ledgerA,
        source_account: ledgerC + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }, {
        source_ledger: ledgerC,
        destination_ledger: ledgerB,
        source_account: ledgerC + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }])

      // remove the new route
      assert.equal(this.tables.toJSON(10).length, 6)
      this.tables.removeLedger(ledgerC)
      assert.equal(this.tables.toJSON(10).length, 2)
    })

    it('removes no other ledger\'s routes', function () {
      this.tables.addLocalRoutes([{
        source_ledger: ledgerC,
        destination_ledger: ledgerA,
        source_account: ledgerC + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      }])

      // remove nonexistant ledger
      assert.equal(this.tables.toJSON(10).length, 3)
      this.tables.removeLedger(ledgerC)
      assert.equal(this.tables.toJSON(10).length, 2)
    })
  })

  describe('toJSON', function () {
    it('returns a list of routes', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'mary',
        min_message_window: 1,
        points: [ [0, 0], [50, 60] ]
      })
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        source_account: ledgerB + 'martin',
        min_message_window: 2, // this min_message_window is higher, so it is used
        points: [ [0, 0], [100, 100] ]
      })

      assert.deepStrictEqual(this.tables.toJSON(10), [
        {
          source_ledger: ledgerB,
          destination_ledger: ledgerA,
          min_message_window: 1,
          source_account: markB,
          points: [ [0, 0], [100, 200] ],
          added_during_epoch: 0,
          paths: [ [] ]
        }, {
          source_ledger: ledgerA,
          destination_ledger: ledgerC,
          min_message_window: 3,
          source_account: markA,
          points: [
            [0, 0], /* .. mary .. */
            [100, 60], /* .. mary (max) .. */
            [120, 60], /* .. mark .. */
            [200, 100] /* .. mark (max) */
          ],
          added_during_epoch: 2,
          paths: [ [] ]
        }, {
          source_ledger: ledgerA,
          destination_ledger: ledgerB,
          min_message_window: 1,
          source_account: markA,
          points: [ [0, 0], [200, 100] ],
          added_during_epoch: 0,
          paths: [ [] ]
        }
      ])
    })

    ;[
      {
        desc: 'finds an intersection between a segment a tail',
        mary: [ [0, 0], [100, 1000] ],
        martin: [ [0, 0], [10, 500] ],
        output: [
          [0, 0], /* .. martin .. */
          [20, 500], /* .. martin (max) .. */
          [100, 500], /* .. mary .. */
          [200, 1000] /* .. mary (max) .. */
        ]
      },
      {
        desc: 'finds an intersection between two segments with slope > 0',
        mary: [ [0, 0], [100, 1000] ],
        martin: [ [0, 0], [100 / 3, 450], [200 / 3, 550] ],
        output: [
          [0, 0], /* .. martin (segment 1) .. */
          [200 / 3, 450], /* .. martin (segment 2) .. */
          [100, 500], /* .. mary .. */
          [400 / 3, 666.6666666666667], /* .. mary (redundant point) .. */
          [200, 1000] /* .. mary .. (max) */
        ]
      }
    ].forEach(function (test) {
      it(test.desc, function () {
        this.tables.addRoute({
          source_ledger: ledgerB,
          destination_ledger: ledgerC,
          source_account: ledgerB + 'mary',
          min_message_window: 1,
          points: test.mary
        })
        this.tables.addRoute({
          source_ledger: ledgerB,
          destination_ledger: ledgerC,
          source_account: ledgerB + 'martin',
          min_message_window: 1,
          points: test.martin
        })

        assert.deepStrictEqual(this.tables.toJSON(10)[1], {
          source_ledger: ledgerA,
          destination_ledger: ledgerC,
          min_message_window: 2,
          source_account: markA,
          points: test.output,
          added_during_epoch: 2,
          paths: [ [] ]
        })
      })
    }, this)

    it('throws TypeError if maxPoints is not a number', function () {
      assert.throws(() => {
        this.tables.toJSON()
      }, /TypeError: RoutingTables#toJSON maxPoints must be a positive number/)
    })

    it('throws TypeError if maxPoints is negative', function () {
      assert.throws(() => {
        this.tables.toJSON(-5)
      }, /TypeError: RoutingTables#toJSON maxPoints must be a positive number/)
    })
  })

  describe('findBestHopForDestinationAmount', function () {
    it('finds the best route when there is one path', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        min_message_window: 1,
        source_account: ledgerB + 'mary',
        points: [ [0, 0], [200, 100] ]
      })
      assert.deepEqual(
        this.tables.findBestHopForDestinationAmount(ledgerA, ledgerC, '25'),
        {
          isFinal: false,
          isLocal: false,
          sourceLedger: ledgerA,
          sourceAmount: '100',
          destinationLedger: ledgerB,
          destinationAmount: '50',
          destinationCreditAccount: ledgerB + 'mary',
          finalLedger: ledgerC,
          finalAmount: '25',
          minMessageWindow: 2,
          liquidityCurve: [ [0, 0], [200, 50] ]
        })
    })

    it('finds the best route when there is one hop', function () {
      assert.deepStrictEqual(
        this.tables.findBestHopForDestinationAmount(ledgerA + 'alice', ledgerB + 'bob', '50'),
        {
          isFinal: true,
          isLocal: true,
          sourceLedger: ledgerA,
          sourceAmount: '100',
          destinationLedger: ledgerB,
          destinationAmount: '50',
          destinationCreditAccount: null,
          finalLedger: ledgerB,
          finalAmount: '50',
          minMessageWindow: 1,
          additionalInfo: {rate_info: '0.5'},
          liquidityCurve: [ [0, 0], [200, 100] ]
        })
    })

    it('finds the best route when there is a remote path', function () {
      this.tables.addRoute({
        source_ledger: ledgerB,
        destination_ledger: ledgerC,
        min_message_window: 1,
        source_account: ledgerB + 'mary',
        points: [ [0, 0], [200, 100] ]
      })
      assert.deepEqual(
        this.tables.findBestHopForDestinationAmount(ledgerA, ledgerC + 'subledger1.bob', '25'),
        {
          isFinal: false,
          isLocal: false,
          sourceLedger: ledgerA,
          sourceAmount: '100',
          destinationLedger: ledgerB,
          destinationAmount: '50',
          destinationCreditAccount: ledgerB + 'mary',
          finalLedger: ledgerC,
          finalAmount: '25',
          minMessageWindow: 2,
          liquidityCurve: [ [0, 0], [200, 50] ]
        })
    })
  })

  describe('findBestHopForSourceAmount', function () {
    it('finds the best route when there is one hop', function () {
      assert.deepStrictEqual(
        this.tables.findBestHopForSourceAmount(ledgerA, ledgerB, '100'),
        {
          isFinal: true,
          isLocal: true,
          sourceLedger: ledgerA,
          sourceAmount: '100',
          destinationLedger: ledgerB,
          destinationAmount: '50',
          destinationCreditAccount: null,
          finalLedger: ledgerB,
          finalAmount: '50',
          minMessageWindow: 1,
          additionalInfo: {rate_info: '0.5'},
          liquidityCurve: [ [0, 0], [200, 100] ]
        })
    })
  })
})

// Like assert.deepStrictEqual, but allow missing top-level keys in `actual`.
function assertSubset (actual, expect) {
  for (const key in expect) {
    assert.deepStrictEqual(actual[key], expect[key])
  }
}
