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
    let bestValue = -1
    let routeInfo = null
    routes.forEach((route, nextHop) => {
      const value = route.amountAt(sourceAmount)
      if (value > bestValue) {
        bestHop = nextHop
        bestValue = value
        routeInfo = route.info
      }
    })

    return { bestHop, bestValue, info: routeInfo }
  }

  findBestHopForDestinationAmount (destination, destinationAmount) {
    const routes = this.destinations.get(destination)
    if (!routes) return undefined

    let bestHop = null
    let bestCost = Infinity
    let routeInfo = null
    routes.forEach((route, nextHop) => {
      const cost = route.amountReverse(destinationAmount)
      if (cost < bestCost) {
        bestHop = nextHop
        bestCost = cost
        routeInfo = route.info
      }
    })

    if (!bestHop) return undefined
    return { bestHop, bestCost, info: routeInfo }
  }
}

module.exports = RoutingTable
