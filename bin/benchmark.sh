#!/usr/bin/env bash

for js in `echo ./benchmarks/*js | tr ' ' '\n' | grep -v optimized | grep -v min`; do
  ./node_modules/.bin/uglifyjs -mc < $js > `echo $js | sed 's/.js/.min.js/'`
  node lib/bin.js < $js > `echo $js | sed 's/.js/.optimized.js/'`
  ./node_modules/.bin/uglifyjs -mc < `echo $js | sed 's/.js/.optimized.js/'` > `echo $js | sed 's/.js/.min.optimized.js/'`
done
./node_modules/.bin/hs -p 9090 benchmarks