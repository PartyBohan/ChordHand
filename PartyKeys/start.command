#!/bin/bash
# PartyKeys — macOS double-click launcher
# First time: right-click → Open (bypass Gatekeeper), then double-click from then on.

set -e
cd "$(dirname "$0")"

PORT=8080
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  PORT=8081
fi
URL="http://localhost:$PORT"

echo "================================================"
echo "  PartyKeys - local server running"
echo "  Open: $URL"
echo "  Close this window to stop."
echo "================================================"

(sleep 1.5 && open "$URL") &

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
  python -m http.server $PORT
else
  echo ""
  echo "python not found. macOS ships python3 by default."
  echo "Or install Node and run: npx serve ."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi
