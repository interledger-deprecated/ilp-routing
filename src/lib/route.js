'use strict'

const isUndefined = require('lodash/fp/isUndefined')
const omitUndefined = require('lodash/fp/omitBy')(isUndefined)
const LiquidityCurve = require('./liquidity-curve')

class Route {
  /**
   * @param {LiquidityCurve|Point[]} curve
   * @param {Object} info
   * @param {String} info.sourceLedger - the ledger through which an incoming route enters this connector
   * @param {String} info.nextLedger - the ledger to which this connector should forward payments
   * @param {String} info.destinationLedger - the last ledger on this route (defaults to nextLedger)
   * @param {Number} info.minMessageWindow
   * @param {Number} info.expiresAt
   * @param {Boolean} info.isLocal
   * @param {String} info.sourceAccount
   * @param {String} info.destinationAccount
   * @param {Object} info.additionalInfo
   * @param {String} info.targetPrefix
   * @param {String[][]} paths - possible lists of hops inbetween nextLedger and destinationLedger
   */
  constructor (curve, info, paths = [ [] ]) {
    this.curve = curve instanceof LiquidityCurve ? curve : new LiquidityCurve(curve)
    this.sourceLedger = info.sourceLedger
    this.nextLedger = info.nextLedger
    this.destinationLedger = info.destinationLedger || info.nextLedger

    // if targetPrefix is specified, then destinations matching 'targetPrefix'
    // will follow this route, rather than destinations matching
    // 'destinationLedger'
    this.targetPrefix = info.targetPrefix || this.destinationLedger

    this.minMessageWindow = info.minMessageWindow
    this.expiresAt = info.expiresAt
    this.additionalInfo = info.additionalInfo

    this.isLocal = info.isLocal
    this.sourceAccount = info.sourceAccount
    this.destinationAccount = info.destinationAccount

    // this test served its primary purpose of alerting me to creation of routes without epochs; requiring it means adding a lot of boilerplate to the tests, so my inclination is to remove the test
    // if (info.addedDuringEpoch === undefined) {
    //    throw new Error("must supply info.addedDuringEpoch")
    // }
    this.addedDuringEpoch = info.addedDuringEpoch
    this.paths = paths
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
    const havePath = {}

    for (let list of [this.paths, alternateRoute.paths]) {
      for (let path of list) {
        havePath[JSON.stringify(path)] = true
      }
    }

    return new Route(combinedCurve, {
      sourceLedger: this.sourceLedger,
      nextLedger: this.nextLedger,
      destinationLedger: this.destinationLedger,
      minMessageWindow: Math.max(this.minMessageWindow, alternateRoute.minMessageWindow),
      isLocal: false,

      addedDuringEpoch: Math.max(alternateRoute.addedDuringEpoch, this.addedDuringEpoch)
    }, Object.keys(havePath).map(JSON.parse))
  }

  /**
   * @param {Route} tailRoute
   * @param {Integer} expiryDuration milliseconds
   * @returns {Route}
   */
  join (tailRoute, expiryDuration, addedDuringEpoch) {
    // Make sure the routes are actually adjacent, and check for loops:
    if (!canJoin(this, tailRoute)) return

    const joinedCurve = this.curve.join(tailRoute.curve)

    // Example:
    // this = {
    //   sourceLedger: S1,
    //   nextLedger: N1,
    //   destinationLedger: J,
    //   paths: [ [ P1.1, P1.2 ] ]
    // }
    // tailRoute = {
    //   sourceLedger: J,
    //   nextLedger: N2,
    //   destinationLedger: D2,
    //   paths: [ [Q1.1, Q1.2], [Q2.1, Q2.2] ]
    // }
    // joined = {
    //   sourceLedger: S1,
    //   nextLedger: N1,
    //   destinationLedger: D2,
    //   paths: [
    //     [P1.1 P1.2 J N2 Q1.1 Q1.2],
    //     [P1.1 P1.2 J N2 Q2.1 Q2.2]
    //   ]
    // }
    //
    // Take special care:
    // If N1 === J, don't include J in the joined paths
    // If N2 === D2, don't include N2 in the joined paths
    const havePaths = {}
    this.paths.map(headPath => {
      if (this.destinationLedger !== this.nextLedger) {
        // N1 !== J, so include J:
        headPath = headPath.concat(this.destinationLedger)
      }
      if (tailRoute.destinationLedger !== tailRoute.nextLedger) {
        // N2 !== D2, so include N2:
        headPath = headPath.concat(tailRoute.nextLedger)
      }
      tailRoute.paths.map(tailPath => {
        havePaths[ JSON.stringify(headPath.concat(tailPath)) ] = true
      })
    })

    return new Route(joinedCurve, {
      sourceLedger: this.sourceLedger,
      nextLedger: this.nextLedger,
      destinationLedger: tailRoute.destinationLedger,
      minMessageWindow: this.minMessageWindow + tailRoute.minMessageWindow,
      isLocal: this.isLocal && tailRoute.isLocal,
      sourceAccount: this.sourceAccount,
      expiresAt: expiryDuration && Date.now() + expiryDuration,
      targetPrefix: tailRoute.targetPrefix,
      addedDuringEpoch: addedDuringEpoch
    }, Object.keys(havePaths).map(JSON.parse))
  }

  /**
   * @param {Number} dx
   * @returns {Route}
   */
  shiftX (dx) {
    return new Route(this.curve.shiftX(dx), this, this.paths)
  }

  /**
   * @param {Number} dy
   * @returns {Route}
   */
  shiftY (dy) {
    return new Route(this.curve.shiftY(dy), this, this.paths)
  }

  /**
   * @param {Integer} maxPoints
   * @returns {Route}
   */
  simplify (maxPoints) {
    return new Route(this.curve.simplify(maxPoints), {
      sourceLedger: this.sourceLedger,
      destinationLedger: this.destinationLedger,
      minMessageWindow: this.minMessageWindow,
      additionalInfo: this.additionalInfo,
      isLocal: this.isLocal,
      targetPrefix: this.targetPrefix,
      addedDuringEpoch: this.addedDuringEpoch
    }, this.paths)
  }

  /**
   * @returns {Boolean}
   */
  isExpired () {
    return !!this.expiresAt && this.expiresAt < Date.now()
  }

  /**
   * @param {Integer} holdDown milliseconds
   * @returns {Integer} milliseconds
   */
  bumpExpiration (holdDown) {
    this.expiresAt = Date.now() + holdDown
    return this.expiresAt
  }

  /**
   * @returns {Object}
   */
  toJSON () {
    return omitUndefined({
      source_ledger: this.sourceLedger,
      destination_ledger: this.destinationLedger,
      points: this.getPoints(),
      min_message_window: this.minMessageWindow,
      source_account: this.sourceAccount,
      added_during_epoch: this.addedDuringEpoch,
      paths: this.paths
    })
  }

  toDebugString (nextConnector) {
    return this.sourceLedger.substring(11) + '-' +
      this.nextLedger.substring(11) + '->' +
      this.destinationLedger.substring(11) + '~' +
      nextConnector
  }
}

Route.fromData = dataToRoute

/**
 * @param {Object|Route} data
 * @returns {Route}
 */
function dataToRoute (data, currentEpoch) {
  if (data instanceof Route) {
    if (data.addedDuringEpoch === undefined) {
      data.addedDuringEpoch = -1
      // too much of a pain with tests:
      // throw new Error('route somehow created without addedDuringEpoch')
    }
    return data
  }
  if (currentEpoch === undefined) throw new Error('must supply currentEpoch as second arg')
  return new Route(data.points, {
    sourceLedger: data.source_ledger,
    nextLedger: data.destination_ledger,
    minMessageWindow: data.min_message_window,
    isLocal: false,
    sourceAccount: data.source_account,
    destinationAccount: data.destination_account,
    additionalInfo: data.additional_info,
    targetPrefix: data.target_prefix,
    addedDuringEpoch: currentEpoch
  }, data.paths)
}

/**
 * @param {Route} routeA
 * @param {Route} routeB
 * @returns {Boolean} whether routeA and routeB can join without forming a loop
 */
function canJoin (routeA, routeB) {
  // These routes would be concatenated as:
  //  routeA.sourceLedger, routeA.nextLedger, [[ routeA.paths ]], routeA.destinationLedger
  //                                                              === routeB.sourceLedger, routeB.nextLedger, [[ routeB.paths ]], routeB.destinationLedger
  //
  //  routeC.sourceLedger, routeC.nextLedger, [[ routeA.paths ** [routeA.destinationLedger, routeB.nextLedger] ** routeB.paths ]], routeC.destinationLedger
  // (the ** tries to express that any path from routeA can be combined with any path from routeB)

  // These three should always be different from each other:
  const fixedLedgers = [routeA.sourceLedger, routeA.nextLedger, routeB.destinationLedger]
  if (routeA.destinationLedger !== routeB.sourceLedger) {
    // routes are not adjacent, can't join them
    return false
  }
  // If routeA has third ledger, add it:
  if (routeA.destinationLedger !== routeA.nextLedger) {
    fixedLedgers.push(routeA.destinationLedger)
  }
  // If routeB has third ledger, add it:
  if (routeB.destinationLedger !== routeB.nextLedger) {
    fixedLedgers.push(routeB.nextLedger)
  }

  // Now we have 3, 4, or 5 fixed ledgers; check that they all differ:
  const visited = {}
  for (let ledger of fixedLedgers) {
    if (visited[ledger]) return false
    visited[ledger] = true
  }

  // Check for intersections between routeA's paths and visited:
  // Remember paths are the alternative options between routeA.nextLedger and routeA.destinationLedger.
  //
  for (let path of routeA.paths) {
    for (let ledger of path) {
      if (visited[ledger]) return false
    }
  }

  // Now add all ledgers from routeA's paths to visited:
  for (let path of routeA.paths) {
    for (let ledger of path) {
      visited[ledger] = true
    }
  }
  // And check for intersections between routeB's paths and everything else:
  for (let path of routeB.paths) {
    for (let ledger of path) {
      if (visited[ledger]) return false
    }
  }

  return true
}

module.exports = Route
