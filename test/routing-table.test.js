'use strict'

const assert = require('assert')
const RoutingTable = require('../src/lib/routing-table')
const Route = require('../src/lib/route')

const ledgerA = 'http://ledgerB.example'
const mark = 'http://mark.example'
const mary = 'http://mary.example'

describe('RoutingTable', function () {
  describe('addRoute', function () {
    it('stores a route', function () {
      const table = new RoutingTable()
      const route = new Route([])
      table.addRoute(ledgerA, mark, route)
      assert.equal(table.destinations.get(ledgerA).get(mark), route)
    })
  })

  describe('removeRoute', function () {
    it('removes a route', function () {
      const table = new RoutingTable()
      table.addRoute(ledgerA, mark, new Route([]))
      table.removeRoute(ledgerA, mark)
      assert.equal(table.destinations.size, 0)
    })

    it('ignores nonexistent routes', function () {
      const table = new RoutingTable()
      table.removeRoute(ledgerA, mark)
    })
  })

  describe('findBestHopForSourceAmount', function () {
    it('returns the best hop', function () {
      const table = new RoutingTable()
      const routeMark = new Route([[0, 0], [100, 100]])
      const routeMary = new Route([[0, 0], [50, 60]])
      table.addRoute(ledgerA, mark, routeMark)
      table.addRoute(ledgerA, mary, routeMary)
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerA, 50),
        { bestHop: mary, bestValue: 60, bestRoute: routeMary })
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerA, 70),
        { bestHop: mark, bestValue: 70, bestRoute: routeMark })
      assert.deepEqual(table.findBestHopForSourceAmount(ledgerA, 200),
        { bestHop: mark, bestValue: 100, bestRoute: routeMark })
    })

    it('returns undefined when there is no route to the destination', function () {
      const table = new RoutingTable()
      assert.strictEqual(table.findBestHopForSourceAmount(ledgerA, 10), undefined)
    })
  })

  describe('findBestHopForDestinationAmount', function () {
    it('returns the best hop', function () {
      const table = new RoutingTable()
      const routeMark = new Route([[0, 0], [100, 100]], {one: 1})
      const routeMary = new Route([[0, 0], [50, 60]], {two: 2})
      table.addRoute(ledgerA, mark, routeMark)
      table.addRoute(ledgerA, mary, routeMary)
      assert.deepEqual(table.findBestHopForDestinationAmount(ledgerA, 60),
        { bestHop: mary, bestCost: 50, bestRoute: routeMary })
      assert.deepEqual(table.findBestHopForDestinationAmount(ledgerA, 70),
        { bestHop: mark, bestCost: 70, bestRoute: routeMark })
    })

    it('returns undefined when there is no route to the destination', function () {
      const table = new RoutingTable()
      assert.strictEqual(table.findBestHopForDestinationAmount(ledgerA, 10), undefined)
    })

    it('returns undefined when no route has a high enough destination amount', function () {
      const table = new RoutingTable()
      table.addRoute(ledgerA, mark, new Route([[0, 0], [100, 100]], {one: 1}))
      assert.strictEqual(table.findBestHopForDestinationAmount(ledgerA, 200), undefined)
    })
  })
})
