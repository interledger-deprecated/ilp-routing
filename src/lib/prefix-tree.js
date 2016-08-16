'use strict'

const _ = require('lodash')

class PrefixTree {
  constructor () {
    this.prefixes = []
    this.items = {}
  }

  keys () { return this.prefixes }
  size () { return this.prefixes.length }

  resolve (key) {
    // Exact match
    if (this.items[key]) return this.items[key]
    // key match
    const index = _.sortedIndex(this.prefixes, key) - 1
    if (index === -1) return null
    const prefix = this.prefixes[index]
    if (!key.startsWith(prefix)) return null
    return this.items[prefix]
  }

  get (prefix) { return this.items[prefix] || null }

  /**
   * @param {function(item, key)} fn
   */
  each (fn) {
    for (const prefix of this.prefixes) {
      fn(this.items[prefix], prefix)
    }
  }

  insert (prefix, item) {
    if (!this.items[prefix]) {
      this.prefixes.splice(
        _.sortedIndex(this.prefixes, prefix), 0, prefix)
    }
    this.items[prefix] = item
    return item
  }

  delete (prefix) {
    const index = _.sortedIndex(this.prefixes, prefix)
    if (this.prefixes[index] === prefix) this.prefixes.splice(index, 1)
    delete this.items[prefix]
  }
}

module.exports = PrefixTree
