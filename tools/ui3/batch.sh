#!/bin/sh
# render the v3 stadium backdrops one after another (full quality): sh tools/ui3/batch.sh "home select vs" [samples]
for s in $1; do
  python3 tools/ui3/stage.py "$s" 1.0 "${2:-48}" 2>&1 | grep -E "Error|Traceback|line [0-9]+|[0-9]s$" | tail -3
done
