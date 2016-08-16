'use strict'

const assert = require('assert')
const PrefixTree = require('../src/lib/prefix-tree')

describe('PrefixTree', function () {
  beforeEach(function () {
    this.tree = new PrefixTree()
  })

  describe('keys', function () {
    it('returns a sorted list of keys', function () {
      assert.deepEqual(this.tree.keys(), [])
      this.tree.insert('foo', {foo: 1})
      assert.deepEqual(this.tree.keys(), ['foo'])
      this.tree.insert('bar', {bar: 1})
      assert.deepEqual(this.tree.keys(), ['bar', 'foo'])
    })
  })

  describe('size', function () {
    it('returns the number of items in the tree', function () {
      assert.equal(this.tree.size(), 0)
      this.tree.insert('foo', {foo: 1})
      assert.equal(this.tree.size(), 1)
    })
  })

  describe('resolve', function () {
    it('returns an exact match', function () {
      this.tree.insert('foo', {foo: 1})
      this.tree.insert('bar', {bar: 1})
      assert.deepEqual(this.tree.resolve('foo'), {foo: 1})
      assert.deepEqual(this.tree.resolve('bar'), {bar: 1})
    })

    it('returns a prefix match', function () {
      this.tree.insert('foo', {foo: 1})
      assert.deepEqual(this.tree.resolve('foo123'), {foo: 1})
      assert.deepEqual(this.tree.resolve('foo12'), {foo: 1})
      assert.deepEqual(this.tree.resolve('foo1'), {foo: 1})
    })

    it('returns null for no match', function () {
      this.tree.insert('foo', {foo: 1})
      assert.strictEqual(this.tree.resolve('a'), null)
      assert.strictEqual(this.tree.resolve('z'), null)
    })

    it('supports a catch-all key', function () {
      this.tree.insert('', {any: 1})
      this.tree.insert('foo', {foo: 1})
      assert.deepEqual(this.tree.resolve('foo'), {foo: 1})
      assert.deepEqual(this.tree.resolve('fo'), {any: 1})
      assert.deepEqual(this.tree.resolve('f'), {any: 1})
      assert.deepEqual(this.tree.resolve(''), {any: 1})
    })
  })

  describe('get', function () {
    beforeEach(function () {
      this.tree.insert('foo', {foo: 1})
    })

    it('returns an exact match', function () {
      assert.deepEqual(this.tree.get('foo'), {foo: 1})
    })

    it('returns null for prefix or non-matches', function () {
      assert.deepEqual(this.tree.get('foo123'), null)
      assert.deepEqual(this.tree.get('bar'), null)
      assert.deepEqual(this.tree.get(''), null)
    })
  })

  describe('each', function () {
    it('iterates items/keys', function () {
      this.tree.insert('foo', {foo: 1})
      this.tree.insert('bar', {bar: 1})
      const keys = []
      this.tree.each(function (item, key) {
        assert.deepEqual(item, {[key]: 1})
        keys.push(key)
      })
      assert.deepEqual(keys, ['bar', 'foo'])
    })
  })

  describe('insert', function () {
    it('overwrites a value on double-insert', function () {
      this.tree.insert('foo', {foo: 1})
      this.tree.insert('foo', {foo: 2})
      assert.deepEqual(this.tree.prefixes, ['foo'])
      assert.deepEqual(this.tree.items, {foo: {foo: 2}})
    })
  })

  describe('delete', function () {
    it('removes a prefix and the corresponding item', function () {
      this.tree.insert('foo', {foo: 1})
      this.tree.insert('bar', {bar: 1})
      this.tree.delete('bar')
      assert.deepEqual(this.tree.prefixes, ['foo'])
      assert.deepEqual(this.tree.items, {foo: {foo: 1}})
      this.tree.delete('foobar')
      assert.deepEqual(this.tree.prefixes, ['foo'])
      assert.deepEqual(this.tree.items, {foo: {foo: 1}})
      this.tree.delete('foo')
      assert.deepEqual(this.tree.prefixes, [])
      assert.deepEqual(this.tree.items, {})
    })
  })
})
