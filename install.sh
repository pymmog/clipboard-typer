#!/usr/bin/env bash
# Load Clipboard Typer into a Chromium browser, or build the Safari app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT="$ROOT/extension"

if [[ ! -f "$EXT/manifest.json" ]]; then
  echo "Cannot find $EXT/manifest.json" >&2
  exit 1
fi

usage() {
  cat <<EOF
Usage: ./install.sh [helium|chrome|brave|edge|chromium|vivaldi|safari|all]

With no argument, opens the first Chromium browser found and the extension folder.
EOF
}

app_path() {
  case "$1" in
    helium) echo "/Applications/Helium.app" ;;
    chrome) echo "/Applications/Google Chrome.app" ;;
    brave) echo "/Applications/Brave Browser.app" ;;
    edge) echo "/Applications/Microsoft Edge.app" ;;
    chromium) echo "/Applications/Chromium.app" ;;
    vivaldi) echo "/Applications/Vivaldi.app" ;;
    *) return 1 ;;
  esac
}

app_name() {
  basename "$(app_path "$1")" .app
}

install_chromium() {
  local id="$1"
  local path name
  path="$(app_path "$id")"
  name="$(app_name "$id")"
  if [[ ! -d "$path" ]]; then
    echo "Not installed: $name" >&2
    return 1
  fi

  open -R "$EXT/manifest.json"
  open -a "$path" "chrome://extensions"
  cat <<EOF

$name is open on the extensions page. Finder is showing the extension folder.
  1. Turn on Developer mode
  2. Click Load unpacked
  3. Choose the folder Finder opened:
     $EXT

The extension stays installed after you quit $name.
Reload any tab that was already open, click a text field, copy text, then press ⌘⇧J.
EOF
}

install_safari() {
  "$ROOT/scripts/build-safari.sh"
  local project="$ROOT/safari-app/Clipboard Typer/Clipboard Typer.xcodeproj"
  local app="$HOME/Library/Developer/Xcode/DerivedData/Clipboard_Typer-dmuihwlyilkkalgyzuyzbiihaoqw/Build/Products/Debug/Clipboard Typer.app"
  xcodebuild -project "$project" -scheme "Clipboard Typer (macOS)" -configuration Debug -destination "platform=macOS" build
  # DerivedData folder name can change. Fall back to the newest built app.
  if [[ ! -d "$app" ]]; then
    app="$(find "$HOME/Library/Developer/Xcode/DerivedData" -path "*Clipboard_Typer*/Build/Products/Debug/Clipboard Typer.app" -type d -print -quit)"
  fi
  open "$app"
  cat <<EOF

Clipboard Typer.app is open.
  1. Quit that app
  2. Quit Safari (⌘Q) and open it again
  3. Safari → Settings → Extensions → turn on Clipboard Typer
  4. If any keyboard-shortcut rows are listed, clear them
  5. Reload the page, click a text field, copy text, then press ⌘⇧J
EOF
}

first_chromium() {
  local id
  for id in helium chrome brave edge chromium vivaldi; do
    if [[ -d "$(app_path "$id")" ]]; then
      echo "$id"
      return 0
    fi
  done
  return 1
}

target="${1:-}"
case "$target" in
  -h|--help|help) usage; exit 0 ;;
  safari) install_safari ;;
  all)
    found=0
    for id in helium chrome brave edge chromium vivaldi; do
      if [[ -d "$(app_path "$id")" ]]; then
        install_chromium "$id" || true
        found=1
      fi
    done
    if [[ "$found" -eq 0 ]]; then
      echo "No Chromium browser found in /Applications." >&2
      exit 1
    fi
    ;;
  "")
    id="$(first_chromium)" || {
      echo "No Chromium browser found in /Applications. For Safari run: ./install.sh safari" >&2
      exit 1
    }
    install_chromium "$id"
    ;;
  helium|chrome|brave|edge|chromium|vivaldi)
    install_chromium "$target"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
