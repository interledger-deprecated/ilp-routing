'use strict'

const debug = require('debug')('five-bells-routing:routing-tables')

const Route = require('./route')
const RoutingTable = require('./routing-table')
// A next hop of PAIR distinguishes a local pair A→B from a complex route
// that just happens to be local, i.e. when A→C & C→B are local pairs.
const PAIR = 'PAIR'

class RoutingTables {
  /**
   * @param {String} baseURI
   * @param {Object[]} localRoutes
   * @param {Integer} expiryDuration milliseconds
   */
  constructor (baseURI, localRoutes, expiryDuration) {
    this.baseURI = baseURI
    this.expiryDuration = expiryDuration
    this.sources = {} // { "sourceLedger" => RoutingTable }
    this.accounts = {} // { "connector;ledger" => accountURI }
    this.addLocalRoutes(localRoutes)
  }

  /**
   * @param {RouteData[]|Route[]} localRoutes - Each local route should include the optional
   *   `destinationAccount` parameter. `connector` should always be `baseURI`.
   */
  addLocalRoutes (_localRoutes) {
    const localRoutes = _localRoutes.map(Route.fromData)
    for (const localRoute of localRoutes) {
      const table = this.sources[localRoute.sourceLedger] ||
        (this.sources[localRoute.sourceLedger] = new RoutingTable())
      table.addRoute(localRoute.destinationLedger, PAIR, localRoute)
    }
    localRoutes.forEach((route) => this.addRoute(route))
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
    this.accounts[route.connector + ';' + route.sourceLedger] = route.sourceAccount
    if (route.destinationAccount) {
      this.accounts[route.connector + ';' + route.destinationLedger] = route.destinationAccount
    }

    let added = false
    this.eachSource((tableFromA, ledgerA) => {
      added = this._addRouteFromSource(tableFromA, ledgerA, route) || added
    })
    return added
  }

  _addRouteFromSource (tableFromA, ledgerA, routeFromBToC) {
    const ledgerB = routeFromBToC.sourceLedger
    const ledgerC = routeFromBToC.destinationLedger
    const connectorFromBToC = routeFromBToC.connector
    let added = false

    // Don't create local route A→B→C if local route A→C already exists.
    if (this.baseURI === connectorFromBToC && this._getLocalPairRoute(ledgerA, ledgerC)) return
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
  eachSource (fn) {
    for (const ledgerA in this.sources) {
      fn(this.sources[ledgerA], ledgerA)
    }
  }

  /**
   * @param {function(routeFromAToB, ledgerA, ledgerB, nextHop)} fn
   */
  eachRoute (fn) {
    this.eachSource((tableFromA, ledgerA) => {
      for (const ledgerB of tableFromA.destinations.keys()) {
        const routesFromAToB = tableFromA.destinations.get(ledgerB)
        for (const nextHop of routesFromAToB.keys()) {
          const routeFromAToB = routesFromAToB.get(nextHop)
          fn(routeFromAToB, ledgerA, ledgerB, nextHop)
        }
      }
    })
  }

  /**
   * @param {Integer} maxPoints
   * @returns {Routes}
   */
  toJSON (maxPoints) {
    const routes = []
    this.eachSource((table, sourceLedger) => {
      for (const destinationLedger of table.destinations.keys()) {
        const routesByConnector = table.destinations.get(destinationLedger)
        const combinedRoute = combineRoutesByConnector(routesByConnector, maxPoints)
        const combinedRouteData = combinedRoute.toJSON()
        combinedRouteData.connector = this.baseURI
        combinedRouteData.source_account = this._getAccount(this.baseURI, sourceLedger)
        routes.push(combinedRouteData)
      }
    })
    return routes
  }

  _getAccount (connector, ledger) {
    return this.accounts[connector + ';' + ledger]
  }

  _getLocalPairRoute (ledgerA, ledgerB) {
    return this._getRoute(ledgerA, ledgerB, PAIR)
  }

  _getRoute (ledgerA, ledgerB, connector) {
    const routesFromAToB = this.sources[ledgerA].destinations.get(ledgerB)
    if (!routesFromAToB) return
    return routesFromAToB.get(connector)
  }

  /**
   * Find the best intermediate ledger (`ledgerB`) to use after `ledgerA` on
   * the way to `ledgerC`.
   * This connector must have `[ledgerA, ledgerB]` as a pair.
   *
   * @param {URI} ledgerA
   * @param {URI} ledgerC
   * @param {String} finalAmount
   * @returns {Object}
   */
  findBestHopForDestinationAmount (ledgerA, ledgerC, finalAmount) {
    const nextHop = this._findBestHopForDestinationAmount(ledgerA, ledgerC, +finalAmount)
    if (!nextHop) return
    const ledgerB = nextHop.bestRoute.nextLedger
    const routeFromAToB = this._getLocalPairRoute(ledgerA, ledgerB)
    const isFinal = ledgerB === ledgerC
    return {
      isFinal: isFinal,
      connector: nextHop.bestHop,
      sourceLedger: ledgerA,
      sourceAmount: nextHop.bestCost.toString(),
      destinationLedger: ledgerB,
      destinationAmount: routeFromAToB.amountAt(nextHop.bestCost).toString(),
      destinationCreditAccount: isFinal ? null : this._getAccount(nextHop.bestHop, ledgerB),
      finalLedger: ledgerC,
      finalAmount: finalAmount,
      minMessageWindow: nextHop.bestRoute.minMessageWindow,
      additionalInfo: isFinal ? nextHop.bestRoute.additionalInfo : undefined
    }
  }

  /**
   * @param {URI} ledgerA
   * @param {URI} ledgerC
   * @param {String} sourceAmount
   * @returns {Object}
   */
  findBestHopForSourceAmount (ledgerA, ledgerC, sourceAmount) {
    const nextHop = this._findBestHopForSourceAmount(ledgerA, ledgerC, +sourceAmount)
    if (!nextHop) return
    const ledgerB = nextHop.bestRoute.nextLedger
    const routeFromAToB = this._getLocalPairRoute(ledgerA, ledgerB)
    const isFinal = ledgerB === ledgerC
    return {
      isFinal: isFinal,
      connector: nextHop.bestHop,
      sourceLedger: ledgerA,
      sourceAmount: sourceAmount,
      destinationLedger: ledgerB,
      destinationAmount: routeFromAToB.amountAt(+sourceAmount).toString(),
      destinationCreditAccount: isFinal ? null : this._getAccount(nextHop.bestHop, ledgerB),
      finalLedger: ledgerC,
      finalAmount: nextHop.bestValue.toString(),
      minMessageWindow: nextHop.bestRoute.minMessageWindow,
      additionalInfo: isFinal ? nextHop.bestRoute.additionalInfo : undefined
    }
  }

  _findBestHopForSourceAmount (source, destination, amount) {
    debug('searching best hop from %s to %s for %s (by src amount)', source, destination, amount)
    if (!this.sources[source]) {
      debug('source %s is not in known sources: %s',
        source, Object.keys(this.sources))
      return undefined
    }
    return this._rewriteLocalHop(
      this.sources[source].findBestHopForSourceAmount(destination, amount))
  }

  _findBestHopForDestinationAmount (source, destination, amount) {
    debug('searching best hop from %s to %s for %s (by dst amount)', source, destination, amount)
    if (!this.sources[source]) {
      debug('source %s is not in known sources: %s',
        source, Object.keys(this.sources))
      return undefined
    }
    return this._rewriteLocalHop(
      this.sources[source].findBestHopForDestinationAmount(destination, amount))
  }

  _rewriteLocalHop (hop) {
    if (hop && hop.bestHop === PAIR) hop.bestHop = this.baseURI
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
