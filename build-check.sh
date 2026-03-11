#!/bin/bash
cd "$(dirname "$0")"
echo "=== SERVER BUILD ==="
npx tsc -p ./server 2>&1 || echo "Server build failed"
echo ""
echo "=== CLIENT BUILD ==="
npx webpack --config webpack.config.js 2>&1 | head -50 || echo "Client build failed"
