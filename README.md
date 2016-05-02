# five-bells-routing

> ILP routing table implementation

## Usage

### Create a Route

``` js
const r = require('five-bells-routing')

const route = new r.Route(require('../test/fixtures/route-usd-xrp-gatehub.json'))
```

### Simplify a Route

``` js
const r = require('five-bells-routing')

const route = new r.Route(require('../test/fixtures/route-usd-xrp-gatehub.json'))
const simplified = route.simplify(3)

console.log(simplified.getPoints())
// prints [[0,0],[1999.59119,267657],[7236.133411,896480]]
```

### Combine two routes

``` js
const r = require('five-bells-routing')

const route1 = new r.Route(require('../test/fixtures/route-usd-xrp-gatehub.json'))
const route2 = new r.Route(require('../test/fixtures/route-usd-xrp-bitstamp.json'))
const route = route1.combine(route2).simplify(3)
console.log(route.getPoints())
// prints [[0,0],[4584.292323,612465],[14654.350698,1883992]]
```

``` js
const r = require('five-bells-routing')
const route1 = new r.Route([ [0, 0], [50, 60] ])
const route2 = new r.Route([ [0, 0], [100, 100] ])
const route = route1.combine(route2)

console.log(route.amountAt(50))
// prints 60
console.log(route.amountAt(60))
// prints 60
console.log(route.amountAt(70))
// prints 70
```

### Join two routes

``` js
const r = require('five-bells-routing')

const route1 = new r.Route(require('../test/fixtures/route-usd-xrp-gatehub.json'))
const route2 = new r.Route(require('../test/fixtures/route-xrp-jpy-tokyojpy.json'))
const route = route1.join(route2).simplify(3)
console.log(route.getPoints())
// prints [[0,0],[2736.957536,309417.18604060914],[Infinity,3942622.7]]
```

### Create a Routing Table

``` js
const r = require('five-bells-routing')

const route = {
  usdXrpGatehub: new r.Route(require('../test/fixtures/route-usd-xrp-gatehub.json')),
  usdXrpBitstamp: new r.Route(require('../test/fixtures/route-usd-xrp-bitstamp.json')),
  xrpJpyTokyoJpy: new r.Route(require('../test/fixtures/route-xrp-jpy-tokyojpy.json'))
}

const table = new r.RoutingTable()
table.addRoute('xrp', 'gatehub', route.usdXrpGatehub)
table.addRoute('xrp', 'bitstamp', route.usdXrpBitstamp)
table.addRoute('jpy', 'gatehub', route.usdXrpGatehub.join(route.xrpJpyTokyoJpy))
table.addRoute('jpy', 'bitstamp', route.usdXrpBitstamp.join(route.xrpJpyTokyoJpy))

console.log(table.findBestHopForSourceAmount('jpy', 210))
// prints { bestHop: 'gatehub', bestValue: 24205.50993427375, info: {} }
console.log(table.findBestHopForDestinationAmount('jpy', 24158))
// prints { bestHop: 'gatehub', bestCost: 209.586929865, info: {} }
```

``` js
const r = require('five-bells-routing')
const route1 = new r.Route([ [0, 0], [200, 100] ])
const route2 = new r.Route([ [0, 0], [50, 60] ])
route1.join(route2).amountAt(100)
// prints 60
```
