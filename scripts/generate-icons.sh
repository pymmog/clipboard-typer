#!/usr/bin/env bash
# Resize the master icon into the sizes the extension manifest uses.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension/icons/icon-1024.png"
DIR="$ROOT/extension/icons"
if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi
for size in 16 48 128; do
  sips -z "$size" "$size" "$SRC" --out "$DIR/icon-${size}.png" >/dev/null
done
echo "Wrote icons to $DIR"
