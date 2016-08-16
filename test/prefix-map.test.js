'use strict'

const assert = require('assert')
const PrefixMap = require('../src/lib/prefix-map')

describe('PrefixMap', function () {
  beforeEach(function () {
    this.map = new PrefixMap()
  })

  describe('keys', function () {
    it('returns a sorted list of keys', function () {
      assert.deepEqual(this.map.keys(), [])
      this.map.insert('foo', {foo: 1})
      assert.deepEqual(this.map.keys(), ['foo'])
      this.map.insert('bar', {bar: 1})
      assert.deepEqual(this.map.keys(), ['bar', 'foo'])
    })
  })

  describe('size', function () {
    it('returns the number of items in the map', function () {
      assert.equal(this.map.size(), 0)
      this.map.insert('foo', {foo: 1})
      assert.equal(this.map.size(), 1)
    })
  })

  describe('resolve', function () {
    it('returns an exact match', function () {
      this.map.insert('foo', {foo: 1})
      this.map.insert('bar', {bar: 1})
      assert.deepEqual(this.map.resolve('foo'), {foo: 1})
      assert.deepEqual(this.map.resolve('bar'), {bar: 1})
    })

    it('returns a prefix match', function () {
      this.map.insert('foo', {foo: 1})
      assert.deepEqual(this.map.resolve('foo123'), {foo: 1})
      assert.deepEqual(this.map.resolve('foo12'), {foo: 1})
      assert.deepEqual(this.map.resolve('foo1'), {foo: 1})
    })

    it('returns null for no match', function () {
      this.map.insert('foo', {foo: 1})
      assert.strictEqual(this.map.resolve('a'), null)
      assert.strictEqual(this.map.resolve('z'), null)
    })

    it('supports a catch-all key', function () {
      this.map.insert('', {any: 1})
      this.map.insert('foo', {foo: 1})
      assert.deepEqual(this.map.resolve('foo'), {foo: 1})
      assert.deepEqual(this.map.resolve('fo'), {any: 1})
      assert.deepEqual(this.map.resolve('f'), {any: 1})
      assert.deepEqual(this.map.resolve(''), {any: 1})
    })
  })

  describe('get', function () {
    beforeEach(function () {
      this.map.insert('foo', {foo: 1})
    })

    it('returns an exact match', function () {
      assert.deepEqual(this.map.get('foo'), {foo: 1})
    })

    it('returns null for prefix or non-matches', function () {
      assert.deepEqual(this.map.get('foo123'), null)
      assert.deepEqual(this.map.get('bar'), null)
      assert.deepEqual(this.map.get(''), null)
    })
  })

  describe('each', function () {
    it('iterates items/keys', function () {
      this.map.insert('foo', {foo: 1})
      this.map.insert('bar', {bar: 1})
      const keys = []
      this.map.each(function (item, key) {
        assert.deepEqual(item, {[key]: 1})
        keys.push(key)
      })
      assert.deepEqual(keys, ['bar', 'foo'])
    })
  })

  describe('insert', function () {
    it('overwrites a value on double-insert', function () {
      this.map.insert('foo', {foo: 1})
      this.map.insert('foo', {foo: 2})
      assert.deepEqual(this.map.prefixes, ['foo'])
      assert.deepEqual(this.map.items, {foo: {foo: 2}})
    })
  })

  describe('delete', function () {
    it('removes a prefix and the corresponding item', function () {
      this.map.insert('foo', {foo: 1})
      this.map.insert('bar', {bar: 1})
      this.map.delete('bar')
      assert.deepEqual(this.map.prefixes, ['foo'])
      assert.deepEqual(this.map.items, {foo: {foo: 1}})
      this.map.delete('foobar')
      assert.deepEqual(this.map.prefixes, ['foo'])
      assert.deepEqual(this.map.items, {foo: {foo: 1}})
      this.map.delete('foo')
      assert.deepEqual(this.map.prefixes, [])
      assert.deepEqual(this.map.items, {})
    })
  })
})
