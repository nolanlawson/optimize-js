browserify-count-modules [![Build Status](https://travis-ci.org/nolanlawson/browserify-count-modules.svg?branch=master)](https://travis-ci.org/nolanlawson/browserify-count-modules) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
========

Count the total number of modules in a Browserify bundle.

    npm install -g browserify-count-modules

CLI Usage
---

    browserify path/to/module/root | bcm

This will output the total number of modules as an integer.

### Example

Let's say you have three JavaScript files:

```js
// a.js
module.exports = 'a'
```

```js
// b.js
module.exports = 'b'
```

```js
// index.js
module.exports = require('./a') + require('./b')
```

Now count the modules:

    $ browserify ./index.js | bcm
    3

In this example, there are three modules: `index.js`, `a.js`, `b.js`.

Note that "modules" includes both first-party and third-party modules. So for instance, if you have one npm dependency,
and that dependency has 5 modules, then its 5 modules will be added to your total module count. This also applies to 
implicit Browserify dependencies, such as `Buffer` (which resolves to [feross/buffer](https://github.com/feross/buffer)).

This tool correctly handles `--standalone`, `factor-bundle`, `bundle-collapser`, and minified bundles as well.
Just pass in any Browserify bundle and it'll work.

### Verbose mode

If you are able to `browserify --full-paths`, then you can use `--verbose` 
to get a full list of modules in the bundle:

    browserify --full-paths path/to/module/root | bcm --verbose

This prints out something like:

```
Total number of modules: 3

Modules:
 - /Users/me/project/a.js
 - /Users/me/project/b.js
 - /Users/me/project/index.js 
```

Note that this only works with `--full-paths`.

JavaScript API
----

Via the JavaScript API, you can get the total count of modules for a given JavaScript bundle
by passing it in as a string. The count you get back will be an integer.

```js
var browserifyCountModules = require('browserify-count-modules')

var jsFile = readFileSync('./my-bundle.js', 'utf8')

browserifyCountModules(jsFile, function (err, count) {
  if (err) {
    return 'oh no an error'
  }
  console.log('here is the count', count)
})
```

You can also get the list of dedup'ed and sorted modules by passing in `{verbose: true}`:

```js
var browserifyCountModules = require('browserify-count-modules')

var jsFile = readFileSync('./my-bundle.js', 'utf8')

browserifyCountModules(jsFile, {verbose: true}, function (err, modules) {
  if (err) {
    return 'oh no an error'
  }
  console.log('here are the modules', modules)
})
```
