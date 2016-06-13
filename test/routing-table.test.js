'use strict'

const assert = require('assert')
const RoutingTable = require('../src/lib/routing-table')
// Cheat to make the tests easier...
// RoutingTable only requires amountAt and amountReverse.
const Curve = require('../src/lib/liquidity-curve')

const ledgerB = 'http://ledgerB.example'
const mark = 'http://mark.example'
const mary = 'http://mary.example'

describe('RoutingTable', function () {
  describe('addRoute', function () {
    it('stores a route', function () {
      const table = new RoutingTable()
      const route = new Curve([])
      table.addRoute(ledgerB, mark, route)
      assert.equal(table.destinations.get(ledgerB).get(mark), route)
    })
  })

  describe('removeRoute', function () {
    it('removes a route', function () {
      const table = new RoutingTable()
      table.addRoute(ledgerB, mark, new Curve([]))
      table.removeRoute(ledgerB, mark)
      assert.equal(table.destinations.size, 0)
    })

    it('ignores nonexistent routes', function () {
      const table = new RoutingTable()
      table.removeRoute(ledgerB, mark)
    })
  })

  describe('findBestHopForSourceAmount', function () {
    it('returns the best hop', function () {
      const table = new RoutingTable()
      const routeMark = new Curve([[0, 0], [100, 100]])
      const routeMary = new Curve([[0, 0], [50, 60]])
      table.addRoute(ledgerB, mark, routeMark)
      table.addRoute(ledgerB, mary, routeMary)
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerB, 50),
        { bestHop: mary, bestValue: 60, bestRoute: routeMary })
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerB, 70),
        { bestHop: mark, bestValue: 70, bestRoute: routeMark })
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerB, 200),
        { bestHop: mark, bestValue: 100, bestRoute: routeMark })
    })

    it('returns undefined when there is no route to the destination', function () {
      const table = new RoutingTable()
      assert.strictEqual(table.findBestHopForSourceAmount(ledgerB, 10), undefined)
    })
  })

  describe('findBestHopForDestinationAmount', function () {
    it('returns the best hop', function () {
      const table = new RoutingTable()
      const routeMark = new Curve([[0, 0], [100, 100]])
      const routeMary = new Curve([[0, 0], [50, 60]])
      table.addRoute(ledgerB, mark, routeMark)
      table.addRoute(ledgerB, mary, routeMary)
      assert.deepEqual(table.findBestHopForDestinationAmount(ledgerB, 60),
        { bestHop: mary, bestCost: 50, bestRoute: routeMary })
      assert.deepEqual(table.findBestHopForDestinationAmount(ledgerB, 70),
        { bestHop: mark, bestCost: 70, bestRoute: routeMark })
    })

    it('returns undefined when there is no route to the destination', function () {
      const table = new RoutingTable()
      assert.strictEqual(table.findBestHopForDestinationAmount(ledgerB, 10), undefined)
    })

    it('returns undefined when no route has a high enough destination amount', function () {
      const table = new RoutingTable()
      table.addRoute(ledgerB, mark, new Curve([[0, 0], [100, 100]]))
      assert.strictEqual(table.findBestHopForDestinationAmount(ledgerB, 200), undefined)
    })
  })
})
