'use strict'

const assert = require('assert')
const RoutingTable = require('../src/lib/routing-table')
// Cheat to make the tests easier...
// RoutingTable only requires amountAt and amountReverse.
const Curve = require('../src/lib/liquidity-curve')

const ledgerB = 'ledgerB.'
const markB = ledgerB + 'mark'
const maryB = ledgerB + 'mary'

describe('RoutingTable', function () {
  describe('addRoute', function () {
    it('stores a route', function () {
      const table = new RoutingTable()
      const route = new Curve([])
      table.addRoute(ledgerB, markB, route)
      assert.equal(table.destinations.get(ledgerB).get(markB), route)
    })
  })

  describe('removeRoute', function () {
    it('removes a route', function () {
      const table = new RoutingTable()
      table.addRoute(ledgerB, markB, new Curve([]))
      table.removeRoute(ledgerB, markB)
      assert.equal(table.destinations.size(), 0)
    })

    it('ignores nonexistent routes', function () {
      const table = new RoutingTable()
      table.removeRoute(ledgerB, markB)
    })
  })

  describe('findBestHopForSourceAmount', function () {
    it('returns the best hop', function () {
      const table = new RoutingTable()
      const routeMark = new Curve([[0, 0], [100, 100]])
      const routeMary = new Curve([[0, 0], [50, 60]])
      table.addRoute(ledgerB, markB, routeMark)
      table.addRoute(ledgerB, maryB, routeMary)
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerB, 50),
        { bestHop: maryB, bestValue: 60, bestRoute: routeMary })
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerB, 70),
        { bestHop: markB, bestValue: 70, bestRoute: routeMark })
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerB, 200),
        { bestHop: markB, bestValue: 100, bestRoute: routeMark })
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
      table.addRoute(ledgerB, markB, routeMark)
      table.addRoute(ledgerB, maryB, routeMary)
      assert.deepEqual(table.findBestHopForDestinationAmount(ledgerB, 60),
        { bestHop: maryB, bestCost: 50, bestRoute: routeMary })
      assert.deepEqual(table.findBestHopForDestinationAmount(ledgerB, 70),
        { bestHop: markB, bestCost: 70, bestRoute: routeMark })
    })

    it('returns undefined when there is no route to the destination', function () {
      const table = new RoutingTable()
      assert.strictEqual(table.findBestHopForDestinationAmount(ledgerB, 10), undefined)
    })

    it('returns undefined when no route has a high enough destination amount', function () {
      const table = new RoutingTable()
      table.addRoute(ledgerB, markB, new Curve([[0, 0], [100, 100]]))
      assert.strictEqual(table.findBestHopForDestinationAmount(ledgerB, 200), undefined)
    })
  })
})
