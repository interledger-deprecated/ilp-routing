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
// prints [[0,0],[8034.771375,1068903],[14654.350698,1883992]]
```

### Join two routes

``` js
const r = require('five-bells-routing')

const route1 = new r.Route(require('../test/fixtures/route-usd-xrp-gatehub.json'))
const route2 = new r.Route(require('../test/fixtures/route-xrp-jpy-tokyojpy.json'))
const route = route1.join(route2).simplify(3)
console.log(route.getPoints())
// prints [[0,0],[2736.957536,309417.18604060914],[7236.133411,757237.079362416]]
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
const jpyGatehub = route.usdXrpGatehub.join(route.xrpJpyTokyoJpy)
table.addRoute('jpy', 'gatehub', jpyGatehub)
table.addRoute('jpy', 'bitstamp', route.usdXrpBitstamp.join(route.xrpJpyTokyoJpy))

console.log(table.findBestHopForSourceAmount('jpy', 210))
// prints { bestHop: 'gatehub', bestValue: 24205.50993427375, bestRoute: jpyGatehub }
console.log(table.findBestHopForDestinationAmount('jpy', 24158))
// prints { bestHop: 'gatehub', bestCost: 209.586929865, bestRoute: jpyGatehub }
```
