'use strict'

var acorn = require('acorn')
var walk = require('walk-ast')
var MagicString = require('magic-string')

function optimizeJs (jsString, opts) {
  opts = opts || {}
  var ast = acorn.parse(jsString)
  var magicString = new MagicString(jsString)

  function walkIt (node) {
    if (node.type === 'FunctionExpression') {
      handleFunctionExpression(node)
    }
  }

  function handleFunctionExpression (node) {
    var prePreChar = jsString.charAt(node.start - 2)
    var preChar = jsString.charAt(node.start - 1)
    var postChar = jsString.charAt(node.end)
    var postPostChar = jsString.charAt(node.end + 1)

    // assuming this node is an argument to a function or an element in an array,
    // return true if it itself is already padded with parentheses
    function isPaddedArgument (node) {
      var parentArray = node.parentNode.arguments ? node.parentNode.arguments : node.parentNode.elements
      var idx = parentArray.indexOf(node)
      if (idx === 0) { // first arg
        if (prePreChar === '(' && preChar === '(' && postChar === ')') { // already padded
          return true
        }
      } else if (idx === parentArray.length - 1) { // last arg
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

    function isCallExpression (node) {
      return node && node.type === 'CallExpression'
    }

    function isArrayExpression (node) {
      return node && node.type === 'ArrayExpression'
    }

    // returns true iff node is an argument to a function call expression.
    function isArgumentToFunctionCall (node) {
      return isCallExpression(node.parentNode) &&
        node.parentNode.arguments.length &&
        node.parentNode.arguments.indexOf(node) !== -1
    }

    // returns true iff node is an element of an array literal which is in turn
    // an argument to a function call expression.
    function isElementOfArrayArgumentToFunctionCall (node) {
      return isArrayExpression(node.parentNode) &&
        node.parentNode.elements.indexOf(node) !== -1 &&
        isArgumentToFunctionCall(node.parentNode)
    }

    // returns true iff node is an IIFE.
    function isIIFE (node) {
      return isCallExpression(node.parentNode) &&
        node.parentNode.callee === node
    }

    // tries to divine if this function is a webpack module wrapper.
    // returns true iff node is an element of an array literal which is in turn
    // an argument to a function call expression, and that function call
    // expression is an IIFE.
    function isProbablyWebpackModule (node) {
      return isElementOfArrayArgumentToFunctionCall(node) &&
        node.parentNode && // array literal
        node.parentNode.parentNode && // CallExpression
        node.parentNode.parentNode.callee && // function that is being called
        node.parentNode.parentNode.callee.type === 'FunctionExpression'
    }

    if (isArgumentToFunctionCall(node) || isProbablyWebpackModule(node)) {
      // function passed in to another function, either as an argument, or as an element
      // of an array argument. these are almost _always_ executed, e.g. webpack bundles,
      // UMD bundles, Browserify bundles, Node-style errbacks, Promise then()s and catch()s, etc.
      if (!isPaddedArgument(node)) { // don't double-pad
        magicString = magicString.insertLeft(node.start, '(')
          .insertRight(node.end, ')')
      }
    } else if (isIIFE(node)) {
      // this function is getting immediately invoked, e.g. function(){}()
      if (preChar !== '(') {
        magicString.insertLeft(node.start, '(')
          .insertRight(node.end, ')')
      }
    }
  }

  walk(ast, walkIt)
  var out = magicString.toString()
  if (opts.sourceMap) {
    out += '\n//# sourceMappingURL=' + magicString.generateMap().toUrl()
  }
  return out
}

module.exports = optimizeJs
