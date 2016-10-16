# ilp-routing

> ILP routing table implementation

## API Reference

### Route

`RouteData` refers to the [Routes schema](https://github.com/interledgerjs/five-bells-shared/blob/master/schemas/Routes.json) in five-bells-shared.

#### `new Route(curve, hops, info)`
#### `Route.fromData(routeData) ⇒ Route`
#### `route.amountAt(x) ⇒ Number`

Given a source amount, look up the corresponding destination amount.

#### `route.amountReverse(y) ⇒ Number`

Given a destination amount, look up the corresponding source amount.

#### `route.getPoints(y) ⇒ Point[]`

#### `route.combine(alternateRoute) ⇒ Route`

Combine two parallel routes.

#### `route.join(tailRoute) ⇒ Route`

Join two routes end-to-end.

#### `route.shiftY(dy) ⇒ Route`

Shift a route's curve up or down.

#### `route.simplify(maxPoints) ⇒ Route`

Simplify a route.

#### `route.isExpired() ⇒ Boolean`

Check if a route has expired.

#### `route.toJSON() ⇒ RouteData`

### RoutingTables

#### `new RoutingTables(baseURI, localRoutes, expiryDuration)`
#### `tables.addLocalRoutes(localRouteObjects)`
#### `tables.addRoute(routeObject) ⇒ Boolean`

Returns whether or not a new route was created (updates don't count).

#### `tables.removeExpiredRoutes()`
#### `tables.toJSON(maxPoints) ⇒ RouteData[]`
#### `tables.findBestHopForDestinationAmount(ledgerA, ledgerC, finalAmount) ⇒ Hop`
#### `tables.findBestHopForSourceAmount(ledgerA, ledgerC, sourceAmount) ⇒ Hop`
