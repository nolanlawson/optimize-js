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

Modern JavaScript engines like V8, Chakra, and SpiderMonkey have a heuristic where they pre-parse most functions before doing a full parse.
This pre-parse step merely checks for syntax errors while avoiding the cost of a full parse 
(binding variables, JITing, etc.).

Why pre-parse? Well, the assumption is that on the average web page, most JavaScript functions are never executed or are lazily executed.
So a pre-parse can prevent a slow startup time, by only checking for what the browser absolutely needs
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

### Is this intended for library authors?

Sort of! If you are already shipping a bundled, minified version of your library, then there's no reason not to also apply `optimize-js`. However if your
users ever apply an additional layer of minification (notably with Uglify), then the parenthesis-wrapping optimization will be undone. Idealy `optimize-js` should be run _after_ Uglify.

### Shouldn't this be Uglify's job?

Possibly! This is a free and open-source library, so I encourage anybody to borrow the code or the good ideas. :)

### But... you're adding bytes!

Yes, `optimize-js` might add up to two whole bytes (horror!) per function, which amounts to almost nothing once you take gzip into account.

### Why not paren-wrap every single function?

As described above, the pre-parsing optimization in browsers is a very good idea for the vast majority of the web, where most functions aren't immediately executed. However, since `optimize-js` knows when your functions are immediately executed (or can make reasonable guesses), it can be more judicious in applying the paren hack.
