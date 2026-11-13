# Clipboard Typer

Types the text on your clipboard into the focused field, one character at a time.

Use it when a site blocks paste. It works in Chrome, Helium, Edge, Brave, Chromium, Vivaldi, and Safari.

Press **⌘⇧J** on Mac, or **Alt+Shift+J** on Windows and Linux. Clicking the toolbar icon does the same thing. Change the shortcut from the extension’s Options page. Chrome reserves **Ctrl+Shift+J** for the console, so that combination cannot be used there.

## Install

```bash
git clone https://github.com/pymmog/clipboard-typer.git
cd clipboard-typer
./install.sh
```

That opens the first Chromium browser it finds (Helium, then Chrome, Brave, Edge, Chromium, Vivaldi) and shows the `extension` folder in Finder.

1. Turn on **Developer mode**
2. Click **Load unpacked**
3. Choose that `extension` folder

Pick a browser by name, or open every one that is installed:

```bash
./install.sh helium
./install.sh chrome
./install.sh all
```

Reload tabs that were already open. Click a text field, copy some text, then press **⌘⇧J**.

### Safari

Safari needs a one-time app build. Xcode is required.

```bash
./install.sh safari
```

Then:

1. Quit the Clipboard Typer app that opens
2. Quit Safari and open it again
3. **Safari → Settings → Extensions** → turn on **Clipboard Typer**
4. If shortcut rows are listed there, clear them. The shortcut is handled on the page, and those rows swallow the keys

Safari reads the pasteboard through the app.

## Settings

Right-click the toolbar icon and choose **Options**.

- Delay between keys (default 35 ms)
- Random jitter
- Whether a newline in the clipboard becomes Enter

## Permissions

| Permission | Why |
| --- | --- |
| `clipboardRead` | Read the clipboard in Chrome |
| `nativeMessaging` | Read the pasteboard in Safari |
| `activeTab`, `scripting` | Type into the page you are on |
| `storage` | Save the speed settings |

The extension does not send anything to a server.

## Project layout

| Path | What it is |
| --- | --- |
| `extension/` | The extension you load |
| `install.sh` | Opens a browser, or builds Safari |
| `safari/` | Native pasteboard reader used by the Safari app |
| `scripts/build-safari.sh` | Creates the Xcode project |
