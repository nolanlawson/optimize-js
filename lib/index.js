'use strict'

var acorn = require('acorn')
var MagicString = require('magic-string')
var walk = require('estree-walker').walk

function optimizeJs (jsString, opts) {
  opts = opts || {}
  var ast = acorn.parse(jsString)
  var magicString = new MagicString(jsString)

  walk(ast, {
    enter: function (node, parent) {
      // assuming this node is an argument to a function, return true if it itself
      // is already padded with parentheses
      function isPaddedArgument (node) {
        var idx = parent.arguments.indexOf(node)
        if (idx === 0) { // first arg
          if (prePreChar === '(' && preChar === '(' && postChar === ')') { // already padded
            return true
          }
        } else if (idx === parent.arguments.length - 1) { // last arg
          if (preChar === '(' && postChar === ')' && postPostChar === ')') { // already padded
            return true
          }
        } else { // middle arg
          if (preChar === '(' && postChar === ')') { // already padded
            return true
          }
        }
        return false
      }

      if (node.type === 'FunctionExpression') {
        var prePreChar = jsString.charAt(node.start - 2)
        var preChar = jsString.charAt(node.start - 1)
        var postChar = jsString.charAt(node.end)
        var postPostChar = jsString.charAt(node.end + 1)

        if (parent && parent.type === 'CallExpression') {
          // this function is getting called itself or
          // it is getting passed in to another call expression
          // the else statement is strictly never hit, but I think the code is easier to read this way
          /* istanbul ignore else */
          if (parent.arguments && parent.arguments.indexOf(node) !== -1) {
            // function passed in to another function. these are almost _always_ executed, e.g.
            // UMD bundles, Browserify bundles, Node-style errbacks, Promise then()s and catch()s, etc.
            if (!isPaddedArgument(node)) { // don't double-pad
              magicString = magicString.insertLeft(node.start, '(')
                .insertRight(node.end, ')')
            }
          } else if (parent.callee === node) {
            // this function is getting immediately invoked, e.g. function(){}()
            if (preChar !== '(') {
              magicString.insertLeft(node.start, '(')
                .insertRight(node.end, ')')
            }
          }
        }
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
