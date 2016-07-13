'use strict'

const debug = require('debug')('five-bells-routing:routing-table')

class RoutingTable {
  constructor () {
    this.destinations = new Map()
  }

  addRoute (destination, nextHop, route) {
    let routes = this.destinations.get(destination)
    if (!routes) {
      routes = new Map()
      this.destinations.set(destination, routes)
    }
    routes.set(nextHop, route)
  }

  removeRoute (destination, nextHop) {
    const routes = this.destinations.get(destination)
    if (!routes) return
    routes.delete(nextHop)
    if (routes.size === 0) this.destinations.delete(destination)
  }

  findBestHopForSourceAmount (destination, sourceAmount) {
    const routes = this.destinations.get(destination)
    if (!routes) {
      debug('destination %s is not in known destinations: %s',
        destination, Array.from(this.destinations.keys()))
      return undefined
    }

    let bestHop = null
    let bestValue = -1
    let bestRoute = null
    routes.forEach((route, nextHop) => {
      const value = route.amountAt(sourceAmount)
      if (value > bestValue) {
        bestHop = nextHop
        bestValue = value
        bestRoute = route
      }
    })

    return { bestHop, bestValue, bestRoute }
  }

  findBestHopForDestinationAmount (destination, destinationAmount) {
    const routes = this.destinations.get(destination)
    if (!routes) {
      debug('destination %s is not in known destinations: %s',
        destination, Array.from(this.destinations.keys()))
      return undefined
    }

    let bestHop = null
    let bestCost = Infinity
    let bestRoute = null
    routes.forEach((route, nextHop) => {
      const cost = route.amountReverse(destinationAmount)
      if (cost < bestCost) {
        bestHop = nextHop
        bestCost = cost
        bestRoute = route
      }
    })

    if (!bestHop) return undefined
    return { bestHop, bestCost, bestRoute }
  }
}

module.exports = RoutingTable
