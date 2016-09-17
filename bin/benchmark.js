var Benchmark = require('benchmark')
var fs = require('fs')
var optimizeJs = require('..')
var path = require('path')

var benchmarks = fs.readdirSync('./benchmarks')

benchmarks.forEach(function (benchmark) {
  var unoptimized = fs.readFileSync(path.join('benchmarks', benchmark, 'index.js'), 'utf8')
  var optimized = optimizeJs(unoptimized)

  var suite = new Benchmark.Suite()
  suite.add(benchmark, function () {
    /*eslint-disable no-eval */
    eval(unoptimized)
  }).add(benchmark + ' w/ optimize-js', function () {
    /*eslint-disable no-eval */
    eval(optimized)
  }).on('cycle', function (event) {
    console.log(String(event.target))
  }).on('error', function (err) {
    console.log(err)
  }).on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  }).run()
})
