#!/usr/bin/env bash

# print the bundle sizes and differences as reported in the README

echo "| Script | Size (bytes) | Difference (bytes) | "
echo "| ---- | --- | --- |"

for js in benchmarks/*.min.js; do
  optimized=`echo $js | sed 's/.min.js/.min.optimized.js/'`
  jsSize=`wc -c < $js`
  optimizedSize=`wc -c < $optimized`
  difference=`expr $optimizedSize - $jsSize`
  echo '|' $js '|' $jsSize '||'
  echo '|' $optimized '|' $optimizedSize '|+' $difference '|'
done
