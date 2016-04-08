'use strict'

class RoutingTable {
  constructor () {
    this.destinations = new Map()
  }

  addRoute (destination, nextHop, metric) {
    let routes = this.destinations.get(destination)
    if (!routes) {
      routes = new Map()
      this.destinations.set(destination, routes)
    }
    routes.set(nextHop, metric)
  }

  removeRoute (destination, nextHop) {
    const routes = this.destinations.get(destination)
    if (!routes) return
    routes.delete(nextHop)
    if (routes.size === 0) this.destinations.delete(destination)
  }

  findBestHopForSourceAmount (destination, sourceAmount) {
    const routes = this.destinations.get(destination)
    if (!routes) return undefined

    let bestHop = null
    let bestValue = 0
    routes.forEach((route, nextHop) => {
      const value = route.amountAt(sourceAmount)
      if (value > bestValue) {
        bestHop = nextHop
        bestValue = value
      }
    })

    return { bestHop, bestValue }
  }

  findBestHopForDestinationAmount (destination, destinationAmount) {
    const routes = this.destinations.get(destination)
    if (!routes) return undefined

    let bestHop = null
    let bestCost = Infinity
    routes.forEach((route, nextHop) => {
      const cost = route.amountReverse(destinationAmount)
      if (cost < bestCost) {
        bestHop = nextHop
        bestCost = cost
      }
    })

    return { bestHop, bestCost }
  }
}

module.exports = RoutingTable
