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

console.log(__dirname)
// prints '/opt/workspace/five-bells-routing/.tmp'
console.log(require.resolve('../test/fixtures/route-usd-xrp-gatehub.json'))
// prints '/opt/workspace/five-bells-routing/test/fixtures/route-usd-xrp-gatehub.json'
console.log(require.resolve('../test/fixtures/route-usd-xrp-bitstamp.json'))
// prints '/opt/workspace/five-bells-routing/test/fixtures/route-usd-xrp-bitstamp.json'
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
// prints [[0,0],[3145.958076,352662.5329103215],[10726.26,757237.079362416]]
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
// prints { bestHop: 'gatehub', bestValue: 24158.461997982795 }
console.log(table.findBestHopForDestinationAmount('jpy', 24158))
// prints { bestHop: 'gatehub', bestCost: 209.9959702869346 }
```
