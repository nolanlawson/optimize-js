optimize-js [![Build Status](https://travis-ci.org/nolanlawson/optimize-js.svg?branch=master)](https://travis-ci.org/nolanlawson/optimize-js) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
========

Optimize a JavaScript file for faster initial execution and parsing, by wrapping all immediately-invoked functions or likely-to-be-invoked functions in parentheses.

See the [changelog](#changelog) for recent changes.

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

| Browser | Typical speed boost/regression using optimize-js |
| ---- | ----- |
| Chrome 55 | 20.63% |
| Edge 14 | 13.52% |
| Firefox 50 | 8.26% |
| Safari 10 | -1.04% |

These numbers are based on a benchmark of common JS libraries. For benchmark details, see [benchmarks](#benchmarks).

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

| Script | Size (bytes) | Difference (bytes) |
| ---- | --- | --- |
| benchmarks/create-react-app.min.js | 160387 ||
| benchmarks/create-react-app.min.optimized.js | 160824 |+ 437 |
| benchmarks/immutable.min.js | 56738 ||
| benchmarks/immutable.min.optimized.js | 56933 |+ 195 |
| benchmarks/jquery.min.js | 86808 ||
| benchmarks/jquery.min.optimized.js | 87109 |+ 301 |
| benchmarks/lodash.min.js | 71381 ||
| benchmarks/lodash.min.optimized.js | 71644 |+ 263 |
| benchmarks/pouchdb.min.js | 140332 ||
| benchmarks/pouchdb.min.optimized.js | 141231 |+ 899 |
| benchmarks/three.min.js | 486996 ||
| benchmarks/three.min.optimized.js | 487279 |+ 283 |

### Is `optimize-js` intended for library authors?

Sure! If you are already shipping a bundled, minified version of your library, then there's no reason not to apply `optimize-js` (assuming you benchmark your code to ensure it does indeed help!). However, note that `optimize-js` should run _after_ Uglify, since Uglify strips extra parentheses and also [negates IIFEs by default](https://github.com/mishoo/UglifyJS2/issues/640). This also means that if your users apply Uglification to your bundle, then the optimization will be undone.

Also note that because `optimize-js` optimizes for some patterns that are based on heuristics rather than _known_ eagerly-invoked
functions, it may actually hurt your performance in some cases. (See benchmarks below for examples.) Be sure to check that `optimize-js` is a help rather than a hindrance for your particular codebase, using something like:

```html
<script>
var start = performance.now();
</script>
<script src="myscript.js"></script>
<script>
var end = performance.now();
console.log('took ' + (end - start) + 'ms');
</script>
```

Note that the script boundaries are actually recommended, in order to truly measure the full parse/compile time.
If you'd like to avoid measuring the network overhead, you can see how we do it in [our benchmarks](https://github.com/nolanlawson/optimize-js/tree/master/benchmarks).

You may also want to check out [marky](http://github.com/nolanlawson/marky),
which allows you to easily set mark/measure points that you can visually inspect in the Dev Tools timeline to ensure that the full
compile time is being measured.

Also, be sure to test in multiple browsers! If you need an Edge VM, check out [edge.ms](http://edge.ms).

### Shouldn't this be Uglify's job?

Possibly! This is a free and open-source library, so I encourage anybody to borrow the code or the good ideas. :)

### Why not paren-wrap every single function?

As described above, the pre-parsing optimization in browsers is a very good idea for the vast majority of the web, where most functions 
aren't immediately executed. However, since `optimize-js` knows when your functions are immediately executed (or can make reasonable
guesses), it can be more judicious in applying the paren hack.

### Does this really work for every JavaScript engine?

Based on my tests, this optimization seems to work best for V8 (Chrome), followed by Chakra (Edge), followed by SpiderMonkey (Firefox). For JavaScriptCore (Safari) it seems to be basically a wash, and may actually be a slight regression overall depending on your codebase. (Again, this is why it's important to actually measure on your own codebase, on the browsers you actually target!)

In the case of Chakra, [Uglify-style IIFEs are actually already optimized](https://github.com/mishoo/UglifyJS2/issues/640#issuecomment-247792319), but using `optimize-js` doesn't hurt because a
function preceded by `'('` still goes into the fast path.

Benchmarks
----

These tests were run using a handful of popular libraries, wrapped in `performance.now()` measurements. Each test reported the median of 251 runs. `optimize-js` commit [da51013](https://github.com/nolanlawson/optimize-js/commit/da51013) was tested. Minification was applied using `uglifyjs -mc`, Uglify 2.7.0.

You can also try [a live version of the benchmark](https://nolanlawson.github.io/optimize-js/).

### Chrome 55, Windows 10 RS1, Surfacebook i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Create React App | 55.39ms | 51.71ms | **6.64%** | 26.12ms | 21.09ms | **19.26%** |
| ImmutableJS | 11.61ms | 7.95ms | **31.50%** | 8.50ms | 5.99ms | **29.55%** |
| jQuery | 22.51ms | 16.62ms | **26.18%** | 19.35ms | 16.10ms | **16.80%** |
| Lodash | 20.88ms | 19.30ms | **7.57%** | 20.47ms | 19.86ms | **3.00%** |
| PouchDB | 43.75ms | 20.36ms | **53.45%** | 36.40ms | 18.78ms | **48.43%** |
| ThreeJS | 71.04ms | 72.98ms | **-2.73%** | 54.99ms | 39.59ms | **28.00%** |
Overall improvement: **20.63%**

### Edge 14, Windows 10 RS1, SurfaceBook i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Create React App | 32.46ms | 24.85ms | **23.44%** | 26.49ms | 20.39ms | **23.03%** |
| ImmutableJS | 8.94ms | 6.19ms | **30.74%** | 7.79ms | 5.41ms | **30.55%** |
| jQuery | 22.56ms | 14.45ms | **35.94%** | 16.62ms | 12.99ms | **21.81%** |
| Lodash | 22.16ms | 21.48ms | **3.05%** | 15.77ms | 15.46ms | **1.96%** |
| PouchDB | 24.07ms | 21.22ms | **11.84%** | 39.76ms | 52.86ms | **-32.98%** |
| ThreeJS | 43.77ms | 39.99ms | **8.65%** | 54.00ms | 36.57ms | **32.28%** |
Overall improvement: **13.52%**

### Firefox 50, Windows 10 RS1, Surfacebook i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Create React App | 33.56ms | 28.02ms | **16.50%** | 24.71ms | 22.05ms | **10.76%** |
| ImmutableJS | 6.52ms | 5.75ms | **11.80%** | 4.96ms | 4.58ms | **7.47%** |
| jQuery | 15.77ms | 13.97ms | **11.41%** | 12.90ms | 12.15ms | **5.85%** |
| Lodash | 17.08ms | 16.63ms | **2.64%** | 13.11ms | 13.22ms | **-0.80%** |
| PouchDB | 19.23ms | 16.77ms | **12.82%** | 13.77ms | 12.89ms | **6.42%** |
| ThreeJS | 38.33ms | 37.36ms | **2.53%** | 33.01ms | 30.32ms | **8.16%** |
Overall improvement: **8.26%**

### Safari 10, macOS Sierra, 2013 MacBook Pro i5

| Script | Original | Optimized | Improvement | Minified | Min+Optimized | Improvement |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Create React App | 31.60ms | 31.60ms | **0.00%** | 23.10ms | 23.50ms | **-1.73%** |
| ImmutableJS | 5.70ms | 5.60ms | **1.75%** | 4.50ms | 4.50ms | **0.00%** |
| jQuery | 12.40ms | 12.60ms | **-1.61%** | 10.80ms | 10.90ms | **-0.93%** |
| Lodash | 14.70ms | 14.50ms | **1.36%** | 11.10ms | 11.30ms | **-1.80%** |
| PouchDB | 14.00ms | 14.20ms | **-1.43%** | 11.70ms | 12.10ms | **-3.42%** |
| ThreeJS | 35.60ms | 36.30ms | **-1.97%** | 27.50ms | 27.70ms | **-0.73%** |
Overall improvement: **-1.04%**

Note that these results may vary based on your machine, how taxed your CPU is, gremlins, etc. I ran the full suite a few times on all browsers and found these numbers to be roughly representative. In our test suite, we use a median of 151 runs to reduce variability.

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

Thanks to [Sasha Aickin](https://github.com/aickin) for generous contributions to improving this library (especially in v1.0.3)
and prodding me to improve the accuracy of the benchmarks.

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

Changelog
----

- v1.0.3
  - Much more accurate benchmark (#37)
  - Browserify-specific fixes (#29, #36, #39)
  - Webpack-specific fixes (#7, #34)
- v1.0.2
  - Use estree-walker to properly parse ES6 (#31)
- v1.0.1:
  - Don't call process.exit(0) on success (#11)
- v1.0.0
  - Initial release
