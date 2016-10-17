'use strict'

const LiquidityCurve = require('./liquidity-curve')

class Route {
  /**
   * @param {LiquidityCurve|Point[]} curve
   * @param {String[]} hops A list of ledgers. Must have *at least* 2 elements.
   * @param {Object} info
   * @param {Number} info.minMessageWindow
   * @param {Number} info.expiresAt
   * @param {Boolean} info.isLocal
   * @param {String} info.sourceAccount
   * @param {String} info.destinationAccount
   * @param {Object} info.additionalInfo
   */
  constructor (curve, hops, info) {
    this.curve = curve instanceof LiquidityCurve ? curve : new LiquidityCurve(curve)
    this.hops = hops
    this.sourceLedger = hops[0]
    this.nextLedger = hops[1]
    this.destinationLedger = hops[hops.length - 1]

    this.minMessageWindow = info.minMessageWindow
    this.expiresAt = info.expiresAt
    this.additionalInfo = info.additionalInfo

    this.isLocal = info.isLocal
    this.sourceAccount = info.sourceAccount
    this.destinationAccount = info.destinationAccount
  }

  // Proxy some functions to the LiquidityCurve.
  amountAt (x) { return this.curve.amountAt(x) }
  amountReverse (y) { return this.curve.amountReverse(y) }
  getPoints () { return this.curve.getPoints() }

  /**
   * @param {Route} alternateRoute
   * @returns {Route}
   */
  combine (alternateRoute) {
    const combinedCurve = this.curve.combine(alternateRoute.curve)
    const combinedHops = this._simpleHops()
    return new Route(combinedCurve, combinedHops, {
      minMessageWindow: Math.max(this.minMessageWindow, alternateRoute.minMessageWindow),
      isLocal: false
    })
  }

  /**
   * @param {Route} tailRoute
   * @param {Integer} expiryDuration milliseconds
   * @returns {Route}
   */
  join (tailRoute, expiryDuration) {
    // Sanity check: make sure the routes are actually adjacent.
    if (this.destinationLedger !== tailRoute.sourceLedger) return

    // Don't create A→B→A.
    // In addition, ensure that it doesn't double back, i.e. B→A→B→C.
    if (intersect(this.hops, tailRoute.hops) > 1) return

    const joinedCurve = this.curve.join(tailRoute.curve)
    const joinedHops = this.hops.concat(tailRoute.hops.slice(1))
    return new Route(joinedCurve, joinedHops, {
      minMessageWindow: this.minMessageWindow + tailRoute.minMessageWindow,
      isLocal: this.isLocal && tailRoute.isLocal,
      sourceAccount: this.sourceAccount,
      expiresAt: Date.now() + expiryDuration
    })
  }

  /**
   * @param {Number} dy
   * @returns {Route}
   */
  shiftY (dy) {
    return new Route(this.curve.shiftY(dy), this.hops, this)
  }

  /**
   * @param {Integer} maxPoints
   * @returns {Route}
   */
  simplify (maxPoints) {
    return new Route(this.curve.simplify(maxPoints), this._simpleHops(), {
      minMessageWindow: this.minMessageWindow,
      additionalInfo: this.additionalInfo,
      isLocal: this.isLocal
    })
  }

  /**
   * @returns {Boolean}
   */
  isExpired () {
    return !!this.expiresAt && this.expiresAt < Date.now()
  }

  /**
   * @returns {Object}
   */
  toJSON () {
    return {
      source_ledger: this.sourceLedger,
      destination_ledger: this.destinationLedger,
      points: this.getPoints(),
      min_message_window: this.minMessageWindow,
      source_account: this.sourceAccount
    }
  }

  _simpleHops () {
    return [this.sourceLedger, this.destinationLedger]
  }
}

Route.fromData = dataToRoute

/**
 * @param {Object|Route} data
 * @returns {Route}
 */
function dataToRoute (data) {
  if (data instanceof Route) return data
  return new Route(data.points, [
    data.source_ledger,
    data.destination_ledger
  ], {
    minMessageWindow: data.min_message_window,
    isLocal: false,
    sourceAccount: data.source_account,
    destinationAccount: data.destination_account,
    additionalInfo: data.additional_info
  })
}

/**
 * @param {Array} listA
 * @param {Array} listB
 * @returns {Integer} the number of items that listA and listB share
 */
function intersect (listA, listB) {
  let common = 0
  for (const itemA of listA) {
    if (listB.indexOf(itemA) !== -1) common++
  }
  return common
}

module.exports = Route
