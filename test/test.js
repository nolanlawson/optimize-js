/* global describe, it */
var denodeify = require('denodeify')
var fs = require('fs')
var readFile = denodeify(fs.readFile)
var optimizeJs = require('../')
var assert = require('assert')
var testCases = fs.readdirSync('test/cases')

describe('main test suite', function () {
  testCases.forEach(testCase => {
    it('test ' + testCase, function () {
      return Promise.all([
        readFile('test/cases/' + testCase + '/input.js', 'utf8'),
        readFile('test/cases/' + testCase + '/output.js', 'utf8')
      ]).then(function (results) {
        var input = results[0]
        var expected = results[1]
        var actual = optimizeJs(input)
        assert.equal(expected, actual)
      })
    })
  })
})
