'use strict'

const assert = require('assert')
const LiquidityCurve = require('../src/lib/liquidity-curve')

describe('LiquidityCurve', function () {
  describe('constructor', function () {
    it('saves the points', function () {
      const points = [ [1, 2], [3, 4] ]
      const curve = new LiquidityCurve(points)
      assert.deepEqual(curve.points, points)
    })
  })

  describe('setPoints', function () {
    it('sets the points', function () {
      const curve = new LiquidityCurve([])
      const points = [ [1, 2], [3, 4] ]
      curve.setPoints(points)
      assert.deepEqual(curve.points, points)
    })

    it('throws InvalidLiquidityCurveError if a point has a negative x-coordinate', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [-1, 5], [1, 5] ])
      }, /InvalidLiquidityCurveError: Curve has point with negative x-coordinate/)
    })

    it('throws InvalidLiquidityCurveError if a point has a negative y-coordinate', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [1, -5], [2, 5] ])
      }, /InvalidLiquidityCurveError: Curve has point with negative y-coordinate/)
    })

    it('throws InvalidLiquidityCurveError if the x-coordinates are not strictly increasing', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [1, 1], [3, 3], [3, 5] ])
      }, /InvalidLiquidityCurveError: Curve x-coordinates must strictly increase in series/)
    })

    it('throws InvalidLiquidityCurveError if the y-coordinates are not increasing', function () {
      const curve = new LiquidityCurve([])
      assert.throws(() => {
        curve.setPoints([ [1, 1], [3, 3], [5, 2] ])
      }, /InvalidLiquidityCurveError: Curve y-coordinates must increase in series/)
    })
  })

  describe('getPoints', function () {
    it('returns the points', function () {
      const points = [ [1, 2], [3, 4] ]
      const curve = new LiquidityCurve(points)
      assert.deepEqual(curve.getPoints(), points)
    })
  })

  describe('amountAt', function () {
    const curve = new LiquidityCurve([[10, 20], [100, 200]])

    it('returns 0 if "x" is too low', function () {
      assert.equal(curve.amountAt(0), 0)
      assert.equal(curve.amountAt(-10), 0)
    })

    it('returns the maximum if "x" is too high', function () {
      assert.equal(curve.amountAt(101), 200)
      assert.equal(curve.amountAt(1000), 200)
    })

    it('returns the linear interpolation of intermediate "x" values', function () {
      assert.equal(curve.amountAt(10), 20)
      assert.equal(curve.amountAt(11), 22)
      assert.equal(curve.amountAt(55), 110)
      assert.equal(curve.amountAt(100), 200)
    })

    it('returns an exact "y" value when possible', function () {
      const curve = new LiquidityCurve([[0, 0], [50, 100], [100, 1000]])
      assert.equal(curve.amountAt(50), 100)
    })
  })

  describe('amountReverse', function () {
    const curve = new LiquidityCurve([[10, 20], [100, 200]])

    it('returns the minimum "x" if "y" is too low', function () {
      assert.equal(curve.amountReverse(0), 10)
      assert.equal(curve.amountReverse(-10), 10)
    })

    it('returns Infinity if "y" is too high', function () {
      assert.equal(curve.amountReverse(201), Infinity)
      assert.equal(curve.amountReverse(1000), Infinity)
    })

    it('returns the linear interpolation of intermediate "y" values', function () {
      assert.equal(curve.amountReverse(20), 10)
      assert.equal(curve.amountReverse(22), 11)
      assert.equal(curve.amountReverse(110), 55)
      assert.equal(curve.amountReverse(200), 100)
    })
  })

  describe('combine', function () {
    it('doesnt create non-increasing y coordinates', function () {
      // these values are from logs of the alpha-network, where non-increasing y coordinates were happening:
      const curve1 = new LiquidityCurve([
        [ 3.1106513517718273e-9, 0 ],
        [ 3.1823209022210673e-9, 6.554011045591627e-11 ],
        [ 3.8945426576388946e-8, 3.2770055227955495e-8 ],
        [ 910129733768357, 833960056822929.9 ],
        [ 100000000000000000, 91630898967551630 ]
      ])
      const curve2 = new LiquidityCurve([
       [ 1.098235347143601e-9, 0 ],
       [ 908309474300820.4, 833960056822929.8 ]
      ])
      assert.deepEqual(curve1.combine(curve2).points, [
        [ 1.098235347143601e-9, 0 ],
        [ 3.1106513517718273e-9, 1.8476902565207704e-9 ],
        [ 3.1823209022210673e-9, 1.9134933160023747e-9 ],
        [ 3.8945426576388946e-8, 3.47492199973205e-8 ],
        [ 908309474300820.4, 833960056822929.8 ],
        [ 910129733768356.9, 833960056822929.8 ],
        [ 910129733768357, 833960056822929.9 ],
        [ 100000000000000000, 91630898967551630 ]
      ])

      const curve3 = new LiquidityCurve([
        [0.00020060160400962244, 0],
        [0.00040200802808986955, 0.00020060160400962241],
        [0.000503014056202274, 0.0003012040120336898],
        [0.0007056337687421677, 0.000503014056202274],
        [0.0007496108045235741, 0.0005468153597486979],
        [0.0007924267074637062, 0.0005894601703406812],
        [0.0008072482652727131, 0.0006042225012046833],
        [0.0009090663980688507, 0.0007056337687421676],
        [0.000996207552844874, 0.000792426707463706],
        [0.0010110885752192891, 0.000807248265272713],
        [0.00111331520563055, 0.0009090663980688504],
        [0.001215746699028607, 0.001011088575219289],
        [0.001318383465960528, 0.0011133152056305498],
        [0.0013183834659605282, 0.0011133152056305498],
        [0.0013183834659605284, 0.00111331520563055],
        [0.0014262022291075132, 0.0012207031249999996],
        [0.00244140625, 0.002231850390625],
        [0.0026518028542054043, 0.002441406249999999],
        [0.0027573174891837716, 0.002546499248496993],
        [1000000000000, 996003999999.9998]
      ])
      const curve4 = new LiquidityCurve([
        [0.00020060160400962244, 0],
        [0.00040200802808986955, 0.00020060160400962241],
        [0.000648111582914527, 0.0004457217290292006],
        [0.0008072482652727131, 0.0006042225012046833],
        [0.0009090663980688507, 0.0007056337687421677],
        [0.000996207552844874, 0.0007924267074637062],
        [0.0010110885752192891, 0.000807248265272713],
        [0.001140318692563842, 0.000935961979068357],
        [0.001215746699028607, 0.001011088575219289],
        [0.001318383465960528, 0.0011133152056305498]
      ])
      assert.deepEqual(curve3.combine(curve4).points, [
        [0.00020060160400962244, 0],
        [0.00040200802808986955, 0.00020060160400962241],
        [0.000503014056202274, 0.0003012040120336898],
        [0.000648111582914527, 0.00044572172902920067],
        [0.0007056337687421677, 0.000503014056202274],
        [0.0007496108045235741, 0.0005468153597486979],
        [0.0007924267074637062, 0.0005894601703406812],
        [0.0008072482652727131, 0.0006042225012046833],
        [0.0009090663980688507, 0.0007056337687421677],
        [0.000996207552844874, 0.0007924267074637062],
        [0.0010110885752192891, 0.000807248265272713],
        [0.001065340909090909, 0.0008612838068181818],
        [0.00111331520563055, 0.0009090663980688505],
        [0.001140318692563842, 0.000935961979068357],
        [0.001215746699028607, 0.001011088575219289],
        [0.001318383465960528, 0.0011133152056305498],
        [0.0013183834659605282, 0.0011133152056305498],
        [0.0013183834659605284, 0.0011133152056305498],
        [0.0013183834659605286, 0.0011133152056305498],
        [0.0014262022291075132, 0.0012207031249999996],
        [0.00244140625, 0.002231850390625],
        [0.0026518028542054043, 0.002441406249999999],
        [0.0027573174891837716, 0.002546499248496993],
        [1000000000000, 996003999999.9998]
      ])
    })
    it('finds an intersection between a slope and a flat line', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 60] ])
      const curve2 = new LiquidityCurve([ [0, 0], [100, 100] ])
      const combinedCurve = curve1.combine(curve2)

      assert.deepStrictEqual(combinedCurve.getPoints(),
        [ [0, 0], [50, 60], [60, 60], [100, 100] ])
      assert.equal(combinedCurve.amountAt(25), 30)
      assert.equal(combinedCurve.amountAt(50), 60)
      assert.equal(combinedCurve.amountAt(60), 60)
      assert.equal(combinedCurve.amountAt(70), 70)
    })

    it('ignores an empty curve', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 60] ])
      const curve2 = new LiquidityCurve([])
      assert.deepEqual(curve1.combine(curve2).getPoints(), [[0, 0], [50, 60]])
      assert.deepEqual(curve2.combine(curve1).getPoints(), [[0, 0], [50, 60]])
    })

    it('finds an intersection between two slopes', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [100, 1000] ])
      const curve2 = new LiquidityCurve([ [0, 0], [100 / 3, 450], [200 / 3, 550] ])
      const result = [ [0, 0], [100 / 3, 450], [50, 500], [200 / 3, 666.6666666666667], [100, 1000] ]
      assert.deepEqual(curve1.combine(curve2).getPoints(), result)
      assert.deepEqual(curve2.combine(curve1).getPoints(), result)
    })
  })

  describe('join', function () {
    it('composes two routes', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [200, 100] ])
      const curve2 = new LiquidityCurve([ [0, 0], [50, 60] ])
      const joinedCurve = curve1.join(curve2)

      assert.deepStrictEqual(joinedCurve.points,
        [ [0, 0], [100, 60] ])
      assert.equal(joinedCurve.amountAt(50), 30)
      assert.equal(joinedCurve.amountAt(100), 60)
      assert.equal(joinedCurve.amountAt(200), 60)
    })

    it('truncates the domain as necessary', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [50, 100] ])
      const curve2 = new LiquidityCurve([ [0, 0], [200, 300] ])
      const joinedCurve = curve1.join(curve2)
      assert.deepEqual(joinedCurve.points,
        [ [0, 0], [50, 150] ])
    })

    it('handles joining with a right-shifted curve', function () {
      const curve1 = new LiquidityCurve([ [0, 0], [10, 10] ])
      const curve2 = new LiquidityCurve([ [1, 1], [11, 11] ])
      const joinedCurve = curve1.join(curve2)
      assert.deepEqual(joinedCurve.points,
        [ [1, 1], [10, 10] ])
    })
  })

  describe('shiftX', function () {
    it('shifts all of the points\' Xs by the specified amount', function () {
      const curve = new LiquidityCurve([ [0, 0], [50, 60], [100, 100] ])
      assert.deepStrictEqual(curve.shiftX(1).points,
        [ [1, 0], [51, 60], [101, 100] ])
    })

    it('stays positive', function () {
      const curve = new LiquidityCurve([ [0, 0], [10, 10] ])
      assert.deepStrictEqual(curve.shiftX(-5).points,
        [ [0, 5], [5, 10] ])
    })

    it('shifts a single point and stays positive', function () {
      const curve = new LiquidityCurve([ [5, 5] ])
      assert.deepStrictEqual(curve.shiftX(-10).points,
        [ [0, 5] ])
    })
  })

  describe('shiftY', function () {
    it('shifts all of the points\' Ys by the specified amount', function () {
      const curve = new LiquidityCurve([ [0, 0], [50, 60], [100, 100] ])
      assert.deepStrictEqual(curve.shiftY(1).points,
        [ [0, 1], [50, 61], [100, 101] ])
    })

    it('stays positive', function () {
      const curve = new LiquidityCurve([ [0, 0], [10, 10] ])
      assert.deepStrictEqual(curve.shiftY(-5).points,
        [ [5, 0], [10, 5] ])
    })
  })
})
