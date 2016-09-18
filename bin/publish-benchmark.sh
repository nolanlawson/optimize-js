#!/usr/bin/env bash

BRANCH=temp_$RANDOM
git checkout -b $BRANCH
npm run build-benchmark
cp -r benchmarks/* .
git add -f *js *html
git commit -a -m 'build'
git push --force origin $BRANCH:gh-pages
git checkout master
git branch -D $BRANCH
