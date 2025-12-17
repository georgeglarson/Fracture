#!/bin/bash
cd /root/BrowserQuest-Ultra
echo "=== SERVER BUILD ==="
./node_modules/.bin/tsc -p ./server 2>&1 || echo "Server build failed"
echo ""
echo "=== CLIENT BUILD ==="
./node_modules/.bin/webpack --config webpack.config.js 2>&1 | head -50 || echo "Client build failed"
