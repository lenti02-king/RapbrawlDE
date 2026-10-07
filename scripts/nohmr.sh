#!/bin/bash
# (Re)start the no-HMR dev server for long captures/probes (default port 5175): kills whatever listens on the port
# by port number (never by command-line pattern, which can match the calling shell).
PORT=${1:-5175}
cd "$(dirname "$0")/.."
fuser -k ${PORT}/tcp >/dev/null 2>&1
sleep 1
NO_HMR=1 nohup npx vite --port ${PORT} > /tmp/vite-${PORT}.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:${PORT}/ && break; sleep 1; done
echo "no-HMR dev server on :${PORT}"
