#!/bin/bash
# Launch Slidev dev server for testing slide rendering.
# Usage: ./scripts/slidev-dev.sh [slides.md]
# Default: demo/demo.slides.md

FILE="${1:-demo/demo.slides.md}"
cd "$(dirname "$0")/.." || exit 1
# Patch: Node.js v25+ exposes a broken localStorage that crashes @typescript/vfs.
# Provide a dummy file so getItem works without error.
TMPFILE="$(mktemp)"
exec node --localstorage-file="$TMPFILE" "$(which slidev)" "$FILE" --open
