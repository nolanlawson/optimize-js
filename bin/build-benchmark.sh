#!/usr/bin/env bash

for js in `echo ./benchmarks/*js | tr ' ' '\n' | grep -v optimized | grep -v min`; do
  min=`echo $js | sed 's/.js/.min.js/'`
  opt=`echo $js | sed 's/.js/.optimized.js/'`
  minopt=`echo $js | sed 's/.js/.min.optimized.js/'`
  ./node_modules/.bin/uglifyjs -mc < $js > $min
  node lib/bin.js < $js > $opt
  node lib/bin.js < $min > $minopt
done
