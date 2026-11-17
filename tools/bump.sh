#!/bin/sh
# Stamp every relative import with ?v=N so browsers (and the Pi) pick up new code right away.
# Usage: sh tools/bump.sh 4
N=$1
for f in index.html js/*.js js/lib/*.js js/games/*.js; do
  sed -i -E "s#(from '\./[^'?]+\.js)(\?v=[0-9]+)?'#\1?v=$N'#g; s#(from '\.\./[^'?]+\.js)(\?v=[0-9]+)?'#\1?v=$N'#g; s#(from '\./js/[^'?]+\.js)(\?v=[0-9]+)?'#\1?v=$N'#g" "$f"
done
