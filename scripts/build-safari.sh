#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
OUT="$ROOT/safari-app"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command line tools are required for the Safari wrapper." >&2
  exit 1
fi

rm -rf "$OUT"
xcrun safari-web-extension-converter "$EXT" \
  --project-location "$OUT" \
  --app-name "Clipboard Typer" \
  --bundle-identifier "com.local.clipboard-typer" \
  --copy-resources \
  --force

HANDLER_SRC="$ROOT/safari/SafariWebExtensionHandler.swift"
HANDLER_DST="$OUT/Clipboard Typer/Shared (Extension)/SafariWebExtensionHandler.swift"
if [[ -f "$HANDLER_SRC" && -f "$HANDLER_DST" ]]; then
  cp "$HANDLER_SRC" "$HANDLER_DST"
fi

echo ""
echo "Safari Xcode project created at: $OUT"
echo "Build and launch it with: ./install.sh safari"
