#!/usr/bin/env bash
set -euo pipefail

# Always run from the repository root (where package.json lives).
cd "$(dirname "$0")"

if [ -f .output/server/index.mjs ]; then
  exec node .output/server/index.mjs
fi

if [ -f dist/server/server.js ]; then
  exec bunx srvx --prod -s dist/client dist/server/server.js
fi

echo "No production server bundle found. Expected .output/server/index.mjs or dist/server/server.js." >&2
exit 1
