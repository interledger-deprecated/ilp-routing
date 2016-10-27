'use strict'

const debug = require('debug')('ilp-routing:routing-tables')

const PrefixMap = require('./prefix-map')
const Route = require('./route')
const RoutingTable = require('./routing-table')
// A next hop of PAIR distinguishes a local pair A→B from a complex route
// that just happens to be local, i.e. when A→C & C→B are local pairs.
const PAIR = 'PAIR'

class RoutingTables {
  /**
   * @param {Object[]} localRoutes
   * @param {Integer} expiryDuration milliseconds
   */
  constructor (localRoutes, expiryDuration) {
    this.expiryDuration = expiryDuration
    this.sources = new PrefixMap() // { "sourceLedger" => RoutingTable }
    this.localAccounts = {} // { "ledger" ⇒ accountURI }
    this.addLocalRoutes(localRoutes)
  }

  /**
   * @param {RouteData[]|Route[]} localRoutes - Each local route should include the optional
   *   `destinationAccount` parameter.
   */
  addLocalRoutes (_localRoutes) {
    const localRoutes = _localRoutes.map(Route.fromData)
    for (const localRoute of localRoutes) {
      localRoute.isLocal = true
      const table = this.sources.get(localRoute.sourceLedger) ||
        this.sources.insert(localRoute.sourceLedger, new RoutingTable())
      table.addRoute(localRoute.destinationLedger, PAIR, localRoute)

      this.localAccounts[localRoute.sourceLedger] = localRoute.sourceAccount
      if (localRoute.destinationAccount) {
        this.localAccounts[localRoute.destinationLedger] = localRoute.destinationAccount
      }
    }
    localRoutes.forEach((route) => this.addRoute(route))
  }

  removeLedger (ledger) {
    const removeList = []
    this.eachRoute((routeFromAToB, ledgerA, ledgerB, nextHop) => {
      if (ledgerA === ledger || ledgerB === ledger) {
        removeList.push({ ledgerA, ledgerB, nextHop })
      }
    })
    removeList.forEach((route) => {
      this._removeRoute(route.ledgerA, route.ledgerB, route.nextHop)
    })
  }

  /**
   * Given a `route` B→C, create a route A→C for each source ledger A with a
   * local route to B.
   *
   * @param {Route|RouteData} _route from ledger B→C
   * @returns {Boolean} whether or not a new route was added
   */
  addRoute (_route) {
    const route = Route.fromData(_route)
    let added = false
    this.eachSource((tableFromA, ledgerA) => {
      added = this._addRouteFromSource(tableFromA, ledgerA, route) || added
    })
    if (added) debug('add route matching', route.targetPrefix, ':', route.sourceAccount, route.destinationLedger)
    return added
  }

  _addRouteFromSource (tableFromA, ledgerA, routeFromBToC) {
    const ledgerB = routeFromBToC.sourceLedger
    const ledgerC = routeFromBToC.targetPrefix
    const connectorFromBToC = routeFromBToC.sourceAccount
    let added = false

    // Don't create local route A→B→C if local route A→C already exists.
    if (routeFromBToC.isLocal && this._getLocalPairRoute(ledgerA, ledgerC)) return
    // Don't create A→B→C when A→B is not a local pair.
    const routeFromAToB = this._getLocalPairRoute(ledgerA, ledgerB)
    if (!routeFromAToB) return

    // Make sure the routes can be joined.
    const routeFromAToC = routeFromAToB.join(routeFromBToC, this.expiryDuration)
    if (!routeFromAToC) return

    if (!this._getRoute(ledgerA, ledgerC, connectorFromBToC)) added = true
    tableFromA.addRoute(ledgerC, connectorFromBToC, routeFromAToC)

    // Given pairs A↔B,B→C; on addRoute(C→D) create A→D after creating B→D.
    if (added) added = this.addRoute(routeFromAToC) || added
    return added
  }

  _removeRoute (ledgerB, ledgerC, connectorFromBToC) {
    this.eachSource((tableFromA, ledgerA) => {
      if (ledgerA !== ledgerB) return
      tableFromA.removeRoute(ledgerC, connectorFromBToC)
    })
  }

  removeExpiredRoutes () {
    this.eachRoute((routeFromAToB, ledgerA, ledgerB, nextHop) => {
      if (routeFromAToB.isExpired()) {
        this._removeRoute(ledgerA, ledgerB, nextHop)
      }
    })
  }

  /**
   * @param {function(tableFromA, ledgerA)} fn
   */
  eachSource (fn) { this.sources.each(fn) }

  /**
   * @param {function(routeFromAToB, ledgerA, ledgerB, nextHop)} fn
   */
  eachRoute (fn) {
    this.eachSource((tableFromA, ledgerA) => {
      tableFromA.destinations.each((routesFromAToB, ledgerB) => {
        for (const nextHop of routesFromAToB.keys()) {
          const routeFromAToB = routesFromAToB.get(nextHop)
          fn(routeFromAToB, ledgerA, ledgerB, nextHop)
        }
      })
    })
  }

  /**
   * @param {Integer} maxPoints
   * @returns {Routes}
   */
  toJSON (maxPoints) {
    const routes = []
    this.eachSource((table, sourceLedger) => {
      table.destinations.each((routesByConnector, destinationLedger) => {
        const combinedRoute = combineRoutesByConnector(routesByConnector, maxPoints)
        const combinedRouteData = combinedRoute.toJSON()
        combinedRouteData.source_account = this.localAccounts[combinedRoute.sourceLedger]
        routes.push(combinedRouteData)
      })
    })
    return routes
  }

  _getLocalPairRoute (ledgerA, ledgerB) {
    return this._getRoute(ledgerA, ledgerB, PAIR)
  }

  _getRoute (ledgerA, ledgerB, nextHop) {
    const routesFromAToB = this.sources.get(ledgerA).destinations.get(ledgerB)
    if (!routesFromAToB) return
    return routesFromAToB.get(nextHop)
  }

  /**
   * Find the best intermediate ledger (`nextLedger`) to use after `sourceLedger` on
   * the way to `finalLedger`.
   * This connector must have `[sourceLedger, nextLedger]` as a pair.
   *
   * @param {IlpAddress} sourceAddress
   * @param {IlpAddress} finalAddress
   * @param {String} finalAmount
   * @returns {Object}
   */
  findBestHopForDestinationAmount (sourceAddress, finalAddress, finalAmount) {
    const nextHop = this._findBestHopForDestinationAmount(sourceAddress, finalAddress, +finalAmount)
    if (!nextHop) return
    // sourceLedger is the longest known prefix of sourceAddress (likewise for
    // finalLedger/finalAddress).
    const sourceLedger = nextHop.bestRoute.sourceLedger
    const finalLedger = nextHop.bestRoute.destinationLedger
    const nextLedger = nextHop.bestRoute.nextLedger
    const routeFromAToB = this._getLocalPairRoute(sourceLedger, nextLedger)
    const isFinal = nextLedger === finalLedger
    return {
      isFinal: isFinal,
      isLocal: nextHop.bestRoute.isLocal,
      sourceLedger: sourceLedger,
      sourceAmount: nextHop.bestCost.toString(),
      destinationLedger: nextLedger,
      destinationAmount: routeFromAToB.amountAt(nextHop.bestCost).toString(),
      destinationCreditAccount: isFinal ? null : nextHop.bestHop,
      finalLedger: finalLedger,
      finalAmount: finalAmount,
      minMessageWindow: nextHop.bestRoute.minMessageWindow,
      additionalInfo: isFinal ? nextHop.bestRoute.additionalInfo : undefined
    }
  }

  /**
   * @param {IlpAddress} sourceAddress
   * @param {IlpAddress} finalAddress
   * @param {String} sourceAmount
   * @returns {Object}
   */
  findBestHopForSourceAmount (sourceAddress, finalAddress, sourceAmount) {
    const nextHop = this._findBestHopForSourceAmount(sourceAddress, finalAddress, +sourceAmount)
    if (!nextHop) return
    const sourceLedger = nextHop.bestRoute.sourceLedger
    const finalLedger = nextHop.bestRoute.destinationLedger
    const nextLedger = nextHop.bestRoute.nextLedger
    const routeFromAToB = this._getLocalPairRoute(sourceLedger, nextLedger)
    const isFinal = nextLedger === finalLedger
    return {
      isFinal: isFinal,
      isLocal: nextHop.bestRoute.isLocal,
      sourceLedger: sourceLedger,
      sourceAmount: sourceAmount,
      destinationLedger: nextLedger,
      destinationAmount: routeFromAToB.amountAt(+sourceAmount).toString(),
      destinationCreditAccount: isFinal ? null : nextHop.bestHop,
      finalLedger: finalLedger,
      finalAmount: nextHop.bestValue.toString(),
      minMessageWindow: nextHop.bestRoute.minMessageWindow,
      additionalInfo: isFinal ? nextHop.bestRoute.additionalInfo : undefined
    }
  }

  _findBestHopForSourceAmount (source, destination, amount) {
    debug('searching best hop from %s to %s for %s (by src amount)', source, destination, amount)
    const table = this.sources.resolve(source)
    if (!table) {
      debug('source %s is not in known sources: %s',
        source, Object.keys(this.sources.prefixes))
      return undefined
    }
    return this._rewriteLocalHop(
      table.findBestHopForSourceAmount(destination, amount))
  }

  _findBestHopForDestinationAmount (source, destination, amount) {
    debug('searching best hop from %s to %s for %s (by dst amount)', source, destination, amount)
    const table = this.sources.resolve(source)
    if (!table) {
      debug('source %s is not in known sources: %s',
        source, Object.keys(this.sources.prefixes))
      return undefined
    }
    return this._rewriteLocalHop(
      table.findBestHopForDestinationAmount(destination, amount))
  }

  _rewriteLocalHop (hop) {
    if (hop && hop.bestHop === PAIR) {
      hop.bestHop = this.localAccounts[hop.bestRoute.destinationLedger]
    }
    return hop
  }
}

function combineRoutesByConnector (routesByConnector, maxPoints) {
  const routes = routesByConnector.values()
  let totalRoute = routes.next().value
  for (const subRoute of routes) {
    totalRoute = totalRoute.combine(subRoute)
  }
  return totalRoute.simplify(maxPoints)
}

module.exports = RoutingTables
