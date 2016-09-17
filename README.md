optimize-js [![Build Status](https://travis-ci.org/nolanlawson/optimize-js.svg?branch=master)](https://travis-ci.org/nolanlawson/optimize-js) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
========

Optimize a JavaScript file for faster execution, by wrapping all immediately-invoked functions in parentheses.

Install
---

    npm install -g optimize-js

Usage
---

    optimize-js input.js > output.js

Why?
----

Modern JavaScript engines like V8, Chakra, and SpiderMonkey have a heuristic where they pre-parse functions before doing a full parse.
This pre-parse merely checks for syntax errors while avoiding the cost of a full expensive parse 
(binding all variables, JITing, etc.). This heuristic is based on the assumption that most JavaScript functions are never executed,
or aren't immediately executed, meaning that the preparse avoids a slow startup time.

Unfortunately this assumption breaks down in the case of immediately-invoked function expressions (IIFEs), such as these:

```js
(function () { console.log('executed!') })();
(function () { console.log('executed Crockford-style!') }());
!function () { console.log('executed UglifyJS-style!') }();
```
 
 The good news is that JS engines have a _further_ optimization for these IIFEs,
 where they try to detect such IIFEs and skip the preparse step. The bad news is that their heuristics don't always worked,
 because they're based on the greedy method of checking for a `'('` or `'!'` symbol immediately to the left of the function. (They
 avoid anything more intricate because it would be tantamount to parsing the entire function expression anyway.)
 
 Luckily, because the `'('` optimization for IIFEs is so well-established, we can exploit this during our build process by
 parsing the entire JavaScript file (a luxury the browser tries to avoid) and inserting parentheses in the cases where we _know_
 the function will be immediately executed. That's what `optimize-js` does.

CLI
----

```
Usage: optimize-js [ options ]

Options:
  --source-map  include source map                                     [boolean]
  -h, --help    Show help                                              [boolean]

Examples:
  optimize-js input.js > output.js    optimize input.js
  optimize-js < input.js > output.js  read from stdin, write to stdout
```

JavaScript API
----

```js
var optimizeJs = require('optimize-js');
var input = "!function() {console.log('wrap me!'})";
var output = optimizeJs(input); // "(function() {console.log('wrap me!'})()"
```

You can also pass in arguments:
```js
var optimizeJs = require('optimize-js');
var input = "!function() {console.log('wrap me!'})";
var output = optimizeJs(input, {
  sourceMap: true
}); // now the output has source maps
```

 FAQs
 ----

 ### Is this intended for library authors?

 No, this is intended as part of a final build step, preferably as a final step after any minification. If you ship your library optimized with `optimize-js`, then it's very likely that Uglify will undo the optimization and remove any parentheses.

 ### But... you're adding bytes!

 Yes, `optimize-js` may add as many as two bytes (horror!) per function, which amounts to almost nothing once you take gzip into account.

### Why not paren-wrap every single function?

As described above, the "preparsing" optimization in browsers is a very good idea for the vast majority of the web, where most functions aren't immediately executed. However, since `optimize-js` knows when your functions are immediately executed (or can make reasonable guesses), it can be more judicious in applying the paren-hack.
