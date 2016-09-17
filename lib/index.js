'use strict'

var acorn = require('acorn')
var walk = require('walk-ast')
var MagicString = require('magic-string')

function optimizeJs (jsString, opts) {
  opts = opts || {}
  var ast = acorn.parse(jsString)
  var magicString = new MagicString(jsString)

  walk(ast, function (node) {
    if (node.type === 'FunctionExpression') {
      var preChar = jsString.charAt(node.start - 1)
      var postChar = jsString.charAt(node.end)
      if (preChar === '!' && postChar === '(') {
        // uglify-style !function(){}() expression
        magicString.overwrite(node.start - 1, node.start, '(')
          .insertRight(node.end, ')')
      }
    }
  })
  var out = magicString.toString()
  if (opts.sourceMap) {
    out += '\n//# sourceMappingURL=' + magicString.generateMap().toUrl()
  }
  return out
}

module.exports = optimizeJs
