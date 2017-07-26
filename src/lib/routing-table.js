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
   * If no prefix uniquely matches the target, return the entire `destinationAddress`.
   *
   * @param {IlpAddress} routePrefix
   * @param {IlpAddress} destinationAddress
   * @returns {IlpAddress}
   */
  getAppliesToPrefix (routePrefix, destinationAddress) {
    // Use `routePrefix` as the initial `appliesToPrefix`.
    // Extend it if it is too general.
    let appliesToPrefix = routePrefix
    this.destinations.each((routes, targetPrefix) => {
      if (targetPrefix === routePrefix) return
      while (targetPrefix.startsWith(appliesToPrefix)) {
        const nextSegmentEnd = destinationAddress.indexOf('.', appliesToPrefix.length)
        if (nextSegmentEnd === -1) {
          appliesToPrefix = destinationAddress
        } else {
          appliesToPrefix = destinationAddress.slice(0, nextSegmentEnd + 1)
        }
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

    let bestPath
    routes.forEach((route, nextHop) => {
      // If we have a route but not a curve, pick a route at random
      // and get a remote quote. In the future we may refactor this
      // so that multiple next hop options can be returned, and all
      // can be asked for a quote, but for now, it's just the last.
      bestPath = getBetterPath(bestPath, {
        nextHop,
        route,
        value: route.amountAt(sourceAmount),
        pathLength: route.maxPathLength()
      })
    })

    if (bestPath) {
      debug('findBestHopForSourceAmount to ' + destination + ' for ' + sourceAmount + ' found route through ' + bestPath.nextHop)
    } else {
      debug('findBestHopForSourceAmount could not find route to ' + destination + ' for ' + sourceAmount + '. Current routing table: ' + JSON.stringify(this.destinations.toJSON()))
    }

    return {
      bestHop: bestPath.nextHop,
      bestValue: bestPath.value && bestPath.value.toString(),
      bestRoute: bestPath.route
    }
  }

  findBestHopForDestinationAmount (destination, destinationAmount) {
    const routes = this.destinations.resolve(destination)
    if (!routes) {
      debug('destination %s is not in known destinations: %s',
        destination, this.destinations.keys())
      return undefined
    }

    let bestPath
    routes.forEach((route, nextHop) => {
      const cost = route.amountReverse(destinationAmount)
      if (cost.equals(Infinity)) return
      // If we have a route but not a curve, pick a route at random
      // and get a remote quote. In the future we may refactor this
      // so that multiple next hop options can be returned, and all
      // can be asked for a quote, but for now, it's just the last.
      bestPath = getBetterPath(bestPath, {
        nextHop,
        route,
        cost,
        pathLength: route.maxPathLength()
      })
    })

    if (bestPath) {
      debug('findBestHopForDestinationAmount to ' + destination + ' for ' + destinationAmount + ' found route through ' + bestPath.nextHop)
      return {
        bestHop: bestPath.nextHop,
        bestCost: bestPath.cost && bestPath.cost.toString(),
        bestRoute: bestPath.route
      }
    } else {
      debug('findBestHopForDestinationAmount could not find route to ' + destination + ' for ' + destinationAmount + '. Current routing table: ' + JSON.stringify(this.destinations.toJSON()))
      return undefined
    }
  }

  static _getBetterPath (currentPath, otherPath) { return getBetterPath(currentPath, otherPath) }
}

/**
 * If both hops score equally, return `currentPath`.
 * It doesn't actually matter which is returned in that case, so long as it is consistent.
 */
function getBetterPath (currentPath, otherPath) {
  if (!currentPath) return otherPath
  if (currentPath.pathLength < otherPath.pathLength) return currentPath
  if (otherPath.pathLength < currentPath.pathLength) return otherPath
  if (otherPath.value !== undefined) {
    if (!currentPath.value) return otherPath
    return otherPath.value.gt(currentPath.value) ? otherPath : currentPath
  }
  if (otherPath.cost !== undefined) {
    if (!currentPath.cost) return otherPath
    return otherPath.cost.lt(currentPath.cost) ? otherPath : currentPath
  }
  // No curve
  return currentPath
}

module.exports = RoutingTable
