/* global describe, it */
var denodeify = require('denodeify')
var fs = require('fs')
var readFile = denodeify(fs.readFile)
var optimizeJs = require('../')
var assert = require('assert')

describe('main test suite', () => {
  it('test 1', () => {
    return Promise.all([
      readFile('test/cases/1/input.js', 'utf8'),
      readFile('test/cases/1/output.js', 'utf8')
    ]).then(results => {
      var input = results[0]
      var expected = results[1]
      var actual = optimizeJs(input)
      assert.equal(expected, actual)
    })
  })
})
