optimize-js [![Build Status](https://travis-ci.org/nolanlawson/optimize-js.svg?branch=master)](https://travis-ci.org/nolanlawson/optimize-js) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
========

Optimize a JavaScript file for faster execution, by wrapping all immediately-invoked functions in parentheses.

Install
---

    npm install -g optimize-js

Usage
---

    optimize-js input.js > output.js

Example input:

```js
!function (){}()
function runIt(fun){ fun() }
runIt(function (){})
```

Example output:

```js
!(function (){})()
function runIt(fun){ fun() }
runIt((function (){}))
```

Why?
----

Modern JavaScript engines like V8, Chakra, and SpiderMonkey have a heuristic where they pre-parse most 
functions before doing a full parse.
The pre-parse step merely checks for syntax errors while avoiding the cost of a full parse 
(binding variables, JITing, etc.).

This heuristic is based on the assumption that, on the average web page, most JavaScript functions are never
executed or are lazily executed.
So a pre-parse can prevent a slower startup time by only checking for what the browser absolutely needs
to know about the function (i.e. whether it's syntactically well-formed or not).

Unfortunately this assumption breaks down in the case of immediately-invoked function expressions (IIFEs), such as these:

```js
(function () { console.log('executed!') })();
(function () { console.log('executed Crockford-style!') }());
!function () { console.log('executed UglifyJS-style!') }();
```

Since the function is immediately executed, there's no point in parsing it twice. The pre-parse, in these cases, would just be extra overhead.

The good news is that JS engines have a _further_ optimization,
where they try to detect such IIFEs and skip the pre-parse step. Hooray!

The bad news, though, is that these heuristics don't always work,
because they're based on a greedy method of checking for a `'('` token immediately to the left of the function. (The parser
avoids anything more intricate because it would be tantamount to parsing the entire function expression, negating any potential performance
boost). In cases like these, including
popular module formats like UMD/Browserify/Webpack/etc., the browser will actually parse the function _twice_, first as a pre-parse and second
as a full parse. This means that the JavaScript code runs much more slowly overall, because more time is spent parsing than needs to be.

Luckily, because the `'('` optimization for IIFEs is so well-established, we can exploit this during our build process by
parsing the entire JavaScript file in advance (a luxury the browser can't afford) and inserting parentheses in the cases where we _know_
the function will be immediately executed (or where we have a good hunch). That's what `optimize-js` does.

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

### How does it work?

The current implementation is to parse the syntax tree and check for functions that:

1. Are immediately-invoked via any kind of call statement (`function(){}()`, `!function(){}()`, etc.)
2. Are passed in directly as arguments to another function

The first method is an easy win – those functions are eagerly executed. The second method is more of a herustic, but tends
to be a safe bet given common patterns like Node-style errbacks, Promise chains, and UMD/Browserify/Webpack module declarations. 

In all such cases, `optimise-js` wraps the function in parentheses.

### But... you're adding bytes!

Yes, `optimize-js` might add up to two whole bytes (horror!) per function, which amounts to almost nothing once you
take gzip into account. To prove it, here are the gzipped sizes for the libraries I use in the benchmark:

| Script | Size (bytes |
| ---- | --- |
| benchmarks/ember.min.js | 126957 |
| benchmarks/ember.min.optimized.js | 127134 |
| benchmarks/immutable.min.js | 15782 |
| benchmarks/immutable.min.optimized.js | 15809 |
| benchmarks/jquery.min.js | 30450 |
| benchmarks/jquery.min.optimized.js | 30524 |
| benchmarks/lodash.min.js | 24528 |
| benchmarks/lodash.min.optimized.js | 24577 |
| benchmarks/pouchdb.min.js | 45298 |
| benchmarks/pouchdb.min.optimized.js | 45426 |
| benchmarks/three.min.js | 125070 |
| benchmarks/three.min.optimized.js | 125129 |

### Is `optimize-js` intended for library authors?

Yes! If you are already shipping a bundled, minified version of your library, then there's no reason not to also 
apply `optimize-js` (assuming you benchmark it and it does indeed help!). However if your users ever apply an additional layer of minification (notably with Uglify), then the parenthesis-wrapping optimization will be undone.

Ideally, `optimize-js` should be run _after_ Uglify, since Uglify strips extra parentheses and also [negates IIFEs by default](https://github.com/mishoo/UglifyJS2/issues/640).

Note that because `optimize-js` optimizes for some patterns that are based on heuristics rather than _known_ eagerly-invoked
functions, it may actually hurt your performance in some cases. Be sure to check that it actually helps your own code,
using something like:

```js
var start = performance.now();
// your code goes here...
var end = performance.now();
console.log('took ' + (end - start) + 'ms');
```

### Shouldn't this be Uglify's job?

Possibly! This is a free and open-source library, so I encourage anybody to borrow the code or the good ideas. :)

### Why not paren-wrap every single function?

As described above, the pre-parsing optimization in browsers is a very good idea for the vast majority of the web, where most functions 
aren't immediately executed. However, since `optimize-js` knows when your functions are immediately executed (or can make reasonable
guesses), it can be more judicious in applying the paren hack.

### Does this really work for every JavaScript engine?

For JavaScriptCore (Safari), I'm not sure. For Chakra, it [actually does optimize](https://github.com/mishoo/UglifyJS2/issues/640#issuecomment-247792319) the Uglify-style `!function(){}` format, but it's
the only one I'm aware of that does that. `optimize-js` also optimizes some patterns that currently no JavaScript engine
does the IIFE optimization for (e.g. `function(){}();`).