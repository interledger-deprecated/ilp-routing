'use strict'

const sortedIndex = require('lodash/sortedIndex')

/**
 * A key-value map where the members' keys represent prefixes.
 *
 * Example:
 *   const map = new PrefixMap()
 *   map.insert("foo", 1)
 *   map.insert("bar", 2)
 *   map.get("foo")     // ⇒ 1
 *   map.get("foo.bar") // ⇒ 1 ("foo" is the longest known prefix of "foo.bar")
 *   map.get("bar")     // ⇒ 2
 *   map.get("bar.foo") // ⇒ 2 ("bar" is the longest known prefix of "bar.foo")
 *   map.get("random")  // ⇒ null
 */
class PrefixMap {
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
    const index = sortedIndex(this.prefixes, key) - 1
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
        sortedIndex(this.prefixes, prefix), 0, prefix)
    }
    this.items[prefix] = item
    return item
  }

  delete (prefix) {
    const index = sortedIndex(this.prefixes, prefix)
    if (this.prefixes[index] === prefix) this.prefixes.splice(index, 1)
    delete this.items[prefix]
  }
}

module.exports = PrefixMap
