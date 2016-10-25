optimize-js [![Build Status](https://travis-ci.org/nolanlawson/optimize-js.svg?branch=master)](https://travis-ci.org/nolanlawson/optimize-js) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
========

Optimize a JavaScript file for faster initial execution and parsing, by wrapping all immediately-invoked functions or likely-to-be-invoked functions in parentheses.

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

Benchmark overview
----

| Browser | Typical speed boost using `optimize-js` |
| ---- | ----- |
| Chrome 52 | 57.09% |
| Edge 14 | 28.88% |
| Firefox 48 | 12.49% |
| Safari 10 | 6.54% |

For benchmark details, see [benchmarks](#benchmarks).

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
var input = "!function() {console.log('wrap me!')}";
var output = optimizeJs(input); // "!(function() {console.log('wrap me!')})()"
```

You can also pass in arguments:
```js
var optimizeJs = require('optimize-js');
var input = "!function() {console.log('wrap me!')}";
var output = optimizeJs(input, {
  sourceMap: true
}); // now the output has source maps
```

Why?
----

Modern JavaScript engines like V8, Chakra, and SpiderMonkey have a heuristic where they pre-parse most 
functions before doing a full parse.
The pre-parse step merely checks for syntax errors while avoiding the cost of a full parse.

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

The good news is that JS engines have a _further_ optimization,
where they try to detect such IIFEs and skip the pre-parse step. Hooray!

The bad news, though, is that these heuristics don't always work,
because they're based on a greedy method of checking for a `'('` token immediately to the left of the function. (The parser
avoids anything more intricate because it would amount to parsing the whole thing, negating the benefit of the pre-parse). 
In cases without the paren (which include
common module formats like UMD/Browserify/Webpack/etc.), the browser will actually parse the function _twice_, first as a pre-parse and second
as a full parse. This means that the JavaScript code runs much more slowly overall, because more time is spent parsing than needs to be. See ["The cost of small modules"](https://nolanlawson.com/2016/08/15/the-cost-of-small-modules/) for an idea of how bad this can get.

Luckily, because the `'('` optimization for IIFEs is so well-established, we can exploit this during our build process by
parsing the entire JavaScript file in advance (a luxury the browser can't afford) and inserting parentheses in the cases where we _know_
the function will be immediately executed (or where we have a good hunch). That's what `optimize-js` does.

More details on the IIFE optimization can be found in [this discussion](https://github.com/mishoo/UglifyJS2/issues/886). Some of my thoughts on the virtues of compile-time optimizations can be found in [this post](https://gist.github.com/nolanlawson/e73c61da78ffb39e4fc034a62ce8b263).

FAQs
----

### How does it work?

The current implementation is to parse to a syntax tree and check for functions that:

1. Are immediately-invoked via any kind of call statement (`function(){}()`, `!function(){}()`, etc.)
2. Are passed in directly as arguments to another function

The first method is an easy win – those functions are immediately executed. The second method is more of a heuristic, but tends
to be a safe bet given common patterns like Node-style errbacks, Promise chains, and UMD/Browserify/Webpack module declarations. 

In all such cases, `optimize-js` wraps the function in parentheses.

### But... you're adding bytes!

Yes, `optimize-js` might add as many as two bytes (horror!) per function, which amounts to practically nil once you
take gzip into account. To prove it, here are the gzipped sizes for the libraries I use in the benchmark:

| Script | Size (bytes) | Difference (bytes)
| ---- | --- | --- |
| benchmarks/ember.min.js | 126957 | |
| benchmarks/ember.min.optimized.js | 127134 | +177 |
| benchmarks/immutable.min.js | 15782 | |
| benchmarks/immutable.min.optimized.js | 15809 | +27 |
| benchmarks/jquery.min.js | 30450 | |
| benchmarks/jquery.min.optimized.js | 30524 | +74 |
| benchmarks/lodash.min.js | 24528 | |
| benchmarks/lodash.min.optimized.js | 24577 | +49 |
| benchmarks/pouchdb.min.js | 45298 | |
| benchmarks/pouchdb.min.optimized.js | 45426 | +128 |
| benchmarks/three.min.js | 125070 | |
| benchmarks/three.min.optimized.js | 125129 | +59 |

### Is `optimize-js` intended for library authors?

Sure! If you are already shipping a bundled, minified version of your library, then there's no reason not to apply `optimize-js` (assuming you benchmark your code to ensure it does indeed help!). However, note that `optimize-js` should run _after_ Uglify, since Uglify strips extra parentheses and also [negates IIFEs by default](https://github.com/mishoo/UglifyJS2/issues/640). This also means that if your users apply Uglification to your bundle, then the optimization will be undone.

Also note that because `optimize-js` optimizes for some patterns that are based on heuristics rather than _known_ eagerly-invoked
functions, it may actually hurt your performance in some cases. (See benchmarks below for examples.) Be sure to check that `optimize-js` is a help rather than a hindrance for your particular codebase, using something like:

```js
var start = performance.now();
// your code goes here...
var end = performance.now();
console.log('took ' + (end - start) + 'ms');
```

Also, be sure to test in multiple browsers! If you need an Edge VM, check out [edge.ms](http://edge.ms).

### Shouldn't this be Uglify's job?

Possibly! This is a free and open-source library, so I encourage anybody to borrow the code or the good ideas. :)

### Why not paren-wrap every single function?

As described above, the pre-parsing optimization in browsers is a very good idea for the vast majority of the web, where most functions 
aren't immediately executed. However, since `optimize-js` knows when your functions are immediately executed (or can make reasonable
guesses), it can be more judicious in applying the paren hack.

### Does this really work for every JavaScript engine?

Based on my tests, this optimization seems to work best for V8 (Chrome), followed by Chakra (Edge), followed by SpiderMonkey (Firefox). For JavaScriptCore (Safari) it seems to be basically a wash, although it's hard to tell because JSCore is so fast already that the numbers are tiny.

In the case of Chakra, [Uglify-style IIFEs are actually already optimized](https://github.com/mishoo/UglifyJS2/issues/640#issuecomment-247792319), but using `optimize-js` doesn't hurt because a
function preceded by `'('` still goes into the fast path.

Benchmarks
----

These tests were run using a handful of popular libraries, wrapped in `performance.now()` measurements. Each test reported the median of 251 runs. `optimize-js` commit [da51013](https://github.com/nolanlawson/optimize-js/commit/da51013) was tested. Minification was applied using `uglifyjs -mc`, Uglify 2.7.0.

You can also try [a live version of the benchmark](https://nolanlawson.github.io/optimize-js/) (note: very slow, running locally is recommended).

### Chrome 52, macOS Sierra, 2013 MacBook Pro i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| ImmutableJS | 12.76ms | 1.75ms | **86.29%** | 10.47ms | 1.68ms | **83.95%** |
| jQuery | 26.73ms | 8.72ms | **67.38%** | 23.02ms | 9ms | **60.90%** |
| Lodash | 29.13ms | 28.03ms | **3.78%** | 20.7ms | 24.45ms | **-18.12%** |
| Ember | 1.48ms | 1.33ms | **10.14%** | 70.93ms | 1.24ms | **98.25%** |
| PouchDB | 60.98ms | 31.59ms | **48.20%** | 40.63ms | 32.02ms | **21.19%** |
| ThreeJS | 10.6ms | 10.16ms | **4.15%** | 66.18ms | 10.33ms | **84.39%** |

Overall improvement: **57.09%**

### Edge 14, Windows 10 RS1, SurfaceBook i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| ImmutableJS | 5.11ms | 1ms | **80.43%** | 4.61ms | 1ms | **78.31%** |
| jQuery | 21.62ms | 12.31ms | **43.06%** | 21.27ms | 12.69ms | **40.34%** |
| Lodash | 22.1ms | 21.81ms | **1.31%** | 19.97ms | 19.05ms | **4.61%** |
| Ember | 0.33ms | 0.32ms | **3.03%** | 0.33ms | 0.32ms | **3.03%** |
| PouchDB | 37.54ms | 28.44ms | **24.24%** | 47.81ms | 65.23ms | **-36.44%** |
| ThreeJS | 30.9ms | 19.08ms | **38.25%** | 68.94ms | 18.26ms | **73.51%** |

Overall improvement: **28.88%**

### Firefox 48, macOS Sierra, 2013 MacBook Pro i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| ImmutableJS | 4.92ms | 1.74ms | **64.63%** | 2.87ms | 1.31ms | **54.36%** |
| jQuery | 15.73ms | 12.64ms | **19.64%** | 14.88ms | 12.43ms | **16.47%** |
| Lodash | 13.8ms | 14.6ms | **-5.80%** | 9.27ms | 9.33ms | **-0.65%** |
| Ember | 3.22ms | 5.55ms | **-72.36%** | 9.42ms | 5.27ms | **44.06%** |
| PouchDB | 15.05ms | 16.65ms | **-10.63%** | 11.96ms | 11.6ms | **3.01%** |
| ThreeJS | 21.09ms | 17.63ms | **16.41%** | 26.83ms | 21.68ms | **19.19%** |

Overall improvement: **12.49%**

### Safari 10, macOS Sierra, 2013 MacBook Pro i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| ImmutableJS | 1.23ms | 1.39ms | **-13.01%** | 1.22ms | 1.12ms | **8.20%** |
| jQuery | 4.16ms | 3.91ms | **6.01%** | 3.83ms | 3.94ms | **-2.87%** |
| Lodash | 3.95ms | 3.9ms | **1.27%** | 3.38ms | 3.36ms | **0.59%** |
| Ember | 0.55ms | 0.5ms | **9.09%** | 0.44ms | 0.4ms | **9.09%** |
| PouchDB | 2.31ms | 2.15ms | **6.93%** | 2.32ms | 2.21ms | **4.74%** |
| ThreeJS | 8.51ms | 7.62ms | **10.46%** | 8.03ms | 6.82ms | **15.07%** |

Overall improvement: **6.54%**

Note that these results may vary based on your machine, how taxed your CPU is, gremlins, etc. I ran the full suite a few times on all browsers and found these numbers to be roughly representative. However, the final "overall improvement" may vary by as much as 5%, and individual libraries can swing a bit too.

Plugins
---

* [Grunt plugin for optimize-js](https://github.com/sergejmueller/grunt-optimize-js)
* [Gulp plugin for optimize-js](https://github.com/prateekbh/gulp-optimize-js)
* [Webpack plugin for optimize-js](https://github.com/vigneshshanmugam/optimize-js-plugin)

See also
---

* [broccoli-ember-preparse](https://www.npmjs.com/package/broccoli-ember-preparse)
* [to-fast-properties](https://github.com/sindresorhus/to-fast-properties)
* [V8LazyParsePlugin](https://github.com/TheLarkInn/V8LazyParseWebpackPlugin)

Thanks
----

Thanks to [@krisselden](https://github.com/krisselden), [@bmaurer](https://github.com/bmaurer), and [@pleath](https://github.com/pleath) for explaining these concepts in the various GitHub issues. Thanks also to [astexplorer](https://github.com/fkling/astexplorer), [acorn](https://github.com/ternjs/acorn), and [magic-string](https://www.npmjs.com/package/magic-string) for making the implementation so easy.

Contributing
-----

Build and run tests:

```bash
npm install
npm test
```

Run the benchmarks:

```bash
npm run benchmark # then open localhost:9090 in a browser
```

Test code coverage:

```bash
npm run coverage
```
