#!/bin/sh
# The checkout's core over the reference's games (.ai-mid/): what the main-board search alone is worth (ai-versus.js: mid:hard).
set -e
cd "$(dirname "$0")/.."
rm -rf .ai-mid && cp -r .ai-ref .ai-mid && cp src/core/*.js .ai-mid/src/core/
