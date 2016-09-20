#!/usr/bin/env node

'use strict'

var concat = require('concat-stream')
var optimizeJs = require('./')
var fs = require('fs')
var yargs = require('yargs')
var argv = yargs
  .usage('Usage: $0 [ options ]')
  .example('$0 input.js > output.js', 'optimize input.js')
  .example('$0 < input.js > output.js', 'read from stdin, write to stdout')
  .boolean('source-map')
  .describe('source-map', 'include source map')
  .help('h')
  .alias('h', 'help')
  .argv

var inStream = argv._[0] ? fs.createReadStream(argv._[0], 'utf8') : process.stdin
inStream.pipe(concat(function (buf) {
  var str = buf.toString('utf8')
  var opts = {
    sourceMap: argv['source-map']
  }
  try {
    var out = optimizeJs(str, opts)
    console.log(out)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})).on('error', function (err) {
  console.error(err)
  process.exit(1)
})
