#!/usr/bin/env bash
# Copy the Measurement Link kit again from a checkout of antarax-api: npm run vendor:sync -- ../antarax-api
# Then record the commit in vendor/lapisan/README.md. Never edit the vendored files here.
set -euo pipefail
SRC="${1:?Path to antarax-api}"
cp "$SRC"/packages/lapisan-core/src/measure/*.ts vendor/lapisan/measure/
cp "$SRC"/packages/lapisan-core/src/crypto.ts vendor/lapisan/crypto.ts
echo "Copied from $(git -C "$SRC" rev-parse --short HEAD). Update vendor/lapisan/README.md."
