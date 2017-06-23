'use strict'

const PrefixMap = require('./prefix-map')
const debug = require('debug')('ilp-routing:routing-table')

class RoutingTable {
  /**
   * `nextHop` and `bestHop` are `IlpAddress`s referring to the connector's account
   * on the source ledger.
   */
  constructor () {
    this.destinations = new PrefixMap()
  }

  addRoute (destination, nextHop, route) {
    let routes = this.destinations.get(destination)
    if (!routes) {
      routes = new Map()
      this.destinations.insert(destination, routes)
    }
    routes.set(nextHop, route)
  }

  /**
   * @returns {Boolean} True if connectivity has been lost
   */
  removeRoute (destination, nextHop) {
    const routes = this.destinations.get(destination)
    if (!routes) return false
    routes.delete(nextHop)
    if (routes.size === 0) {
      this.destinations.delete(destination)
      return true
    }
    return false
  }

  /**
   * Compute a curve quote's `appliesToPrefix`, which is the shortest prefix
   * that uniquely matches the target.
   *
   * @param {IlpAddress} routePrefix
   * @param {IlpAddress} destinationAccount
   * @returns {IlpAddress}
   */
  getAppliesToPrefix (routePrefix, destinationAccount) {
    // Use `routePrefix` as the initial `appliesToPrefix`, and extend it as
    // needed if it is too general.
    let appliesToPrefix = routePrefix
    this.destinations.each((routes, targetPrefix) => {
      if (targetPrefix === routePrefix) return
      if (targetPrefix.startsWith(appliesToPrefix)) {
        appliesToPrefix = destinationAccount.slice(
          0, getPrefixLength(targetPrefix, appliesToPrefix) + 1)
      }
    })
    return appliesToPrefix
  }

  findBestHopForSourceAmount (destination, sourceAmount) {
    const routes = this.destinations.resolve(destination)
    if (!routes) {
      debug('destination %s is not in known destinations: %s',
        destination, this.destinations.keys())
      return undefined
    }

    let bestHop = null
    let bestValue = null
    let bestRoute = null
    routes.forEach((route, nextHop) => {
      const value = route.amountAt(sourceAmount)
      // If we have a route but not a curve, pick a route at random
      // and get a remote quote. In the future we may refactor this
      // so that multiple next hop options can be returned, and all
      // can be asked for a quote, but for now, it's just the last.
      if (value === undefined || !bestValue || value.gt(bestValue)) {
        bestHop = nextHop
        bestValue = value && value.toString()
        bestRoute = route
      }
    })

    if (bestHop) {
      debug('findBestHopForSourceAmount to ' + destination + ' for ' + sourceAmount + ' found route through ' + bestHop)
    } else {
      debug('findBestHopForSourceAmount could not find route to ' + destination + ' for ' + sourceAmount + '. Current routing table: ' + JSON.stringify(this.destinations.toJSON()))
    }

    return { bestHop, bestValue, bestRoute }
  }

  findBestHopForDestinationAmount (destination, destinationAmount) {
    const routes = this.destinations.resolve(destination)
    if (!routes) {
      debug('destination %s is not in known destinations: %s',
        destination, this.destinations.keys())
      return undefined
    }

    let bestHop = null
    let bestCost = Infinity
    let bestRoute = null
    routes.forEach((route, nextHop) => {
      const cost = route.amountReverse(destinationAmount)
      // If we have a route but not a curve, pick a route at random
      // and get a remote quote. In the future we may refactor this
      // so that multiple next hop options can be returned, and all
      // can be asked for a quote, but for now, it's just the last.
      if (cost === undefined || cost.lt(bestCost)) {
        bestHop = nextHop
        bestCost = cost && cost.toString()
        bestRoute = route
      }
    })

    if (bestHop) {
      debug('findBestHopForDestinationAmount to ' + destination + ' for ' + destinationAmount + ' found route through ' + bestHop)
      return { bestHop, bestCost, bestRoute }
    } else {
      debug('findBestHopForDestinationAmount could not find route to ' + destination + ' for ' + destinationAmount + '. Current routing table: ' + JSON.stringify(this.destinations.toJSON()))
      return undefined
    }
  }
}

function getPrefixLength (str1, str2) {
  const length = Math.min(str1.length, str2.length)
  for (let i = 0; i < length; i++) {
    if (str1[i] !== str2[i]) return i
  }
  return length
}

module.exports = RoutingTable
