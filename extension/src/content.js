if (globalThis.__clipboardTyperContent) {
  // Safari sometimes injects this script twice; a second copy doubles every character.
} else {
globalThis.__clipboardTyperContent = true;

const browserApi = typeof browser !== "undefined" ? browser : chrome;

function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.platform || "") || navigator.userAgent.includes("Macintosh");
}

function defaultShortcut() {
  const mac = isMac();
  return { key: "j", meta: mac, ctrl: false, alt: !mac, shift: true };
}

const DEFAULT_OPTIONS = {
  delayMs: 35,
  jitterMs: 15,
  respectNewlines: true,
  shortcut: defaultShortcut(),
};

let shortcut = defaultShortcut();

let typingChain = Promise.resolve();
let busy = false;

function isTypeShortcut(event) {
  if (event.repeat || event.isComposing) return false;
  const key = (event.key || "").toLowerCase();
  if (key !== shortcut.key) return false;
  if (!!event.metaKey !== !!shortcut.meta) return false;
  if (!!event.ctrlKey !== !!shortcut.ctrl) return false;
  if (!!event.altKey !== !!shortcut.alt) return false;
  if (!!event.shiftKey !== !!shortcut.shift) return false;
  return true;
}

function applyShortcut(stored) {
  shortcut = { ...defaultShortcut(), ...(stored || {}) };
}

function showToast(message, ok) {
  const id = "clipboard-typer-toast";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.textContent = message;
  el.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "bottom:16px",
    "right:16px",
    "max-width:320px",
    "padding:10px 14px",
    "border-radius:10px",
    "font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif",
    "color:#fff",
    `background:${ok ? "#15803d" : "#b91c1c"}`,
    "box-shadow:0 8px 24px rgba(0,0,0,.25)",
  ].join(";");
  (document.documentElement || document.body).appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

async function loadOptions() {
  try {
    const stored = await browserApi.storage.sync.get(DEFAULT_OPTIONS);
    applyShortcut(stored.shortcut);
    return { ...DEFAULT_OPTIONS, ...stored, shortcut };
  } catch {
    return { ...DEFAULT_OPTIONS, shortcut };
  }
}

loadOptions();
browserApi.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.shortcut) applyShortcut(changes.shortcut.newValue);
});

function readClipboardWithPaste(previous) {
  const previousValue = previous && !previous.isContentEditable ? previous.value : null;
  const previousStart = previous?.selectionStart;
  const previousEnd = previous?.selectionEnd;
  const area = document.createElement("textarea");
  area.setAttribute("aria-hidden", "true");
  area.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;";
  (document.documentElement || document.body).appendChild(area);
  area.focus();
  let text = "";
  try {
    document.execCommand("paste");
    text = area.value || "";
  } finally {
    area.remove();
    if (previous && previousValue != null && previous.value !== previousValue) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(previous), "value");
      if (descriptor?.set) descriptor.set.call(previous, previousValue);
      else previous.value = previousValue;
      try {
        previous.selectionStart = previousStart;
        previous.selectionEnd = previousEnd;
      } catch {
        // ignore inputs that reject a selection
      }
    }
    previous?.focus?.();
  }
  return text;
}

function isSafariExtension() {
  try {
    return browserApi.runtime.getURL("").startsWith("safari-web-extension://");
  } catch {
    return false;
  }
}

async function readClipboardFromSafariApp() {
  const response = await browserApi.runtime.sendMessage({ type: "READ_CLIPBOARD" });
  if (response?.ok && typeof response.text === "string") return response.text;
  throw new Error(response?.error || "Safari could not read the pasteboard.");
}

async function readClipboard(previous) {
  if (isSafariExtension()) {
    return readClipboardFromSafariApp();
  }

  if (navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (typeof text === "string") return text;
    } catch {
      // Fall through to the paste command, then the background page.
    }
  }

  const pasted = readClipboardWithPaste(previous);
  if (pasted) return pasted;

  try {
    const response = await browserApi.runtime.sendMessage({ type: "READ_CLIPBOARD" });
    if (response?.ok && typeof response.text === "string") return response.text;
  } catch {
    // Background native read is a last resort.
  }

  throw new Error("Could not read the clipboard. Copy text again, click the field, then press ⌘⇧J.");
}

async function typeClipboardNow() {
  const sim = globalThis.__clipboardTyperSimulator;
  if (!sim) throw new Error("Simulator not loaded. Reload this page.");

  const target = sim.getActiveTypingTarget();
  if (!target) throw new Error("Click into a text field first.");

  const text = (await readClipboard(target)).replace(/\s+$/u, "");
  if (!text) throw new Error("Clipboard is empty.");

  target.focus();
  const options = await loadOptions();
  return sim.typeText(target, text, options);
}

function runTyping() {
  if (busy) return;
  busy = true;
  typingChain = typingChain
    .then(() => typeClipboardNow())
    .then((result) => {
      if (result?.skipped) return;
      showToast(`Typed ${result.typed} characters.`, true);
    })
    .catch((err) => {
      showToast(err?.message || String(err), false);
    })
    .finally(() => {
      busy = false;
    });
}

window.addEventListener(
  "keydown",
  (event) => {
    if (!isTypeShortcut(event)) return;
    const active = document.activeElement;
    if (active && (active.tagName === "IFRAME" || active.tagName === "FRAME")) return;
    if (!globalThis.__clipboardTyperSimulator?.getActiveTypingTarget()) return;
    event.preventDefault();
    event.stopPropagation();
    runTyping();
  },
  true
);

browserApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TYPE_CLIPBOARD") {
    const sim = globalThis.__clipboardTyperSimulator;
    const target = sim?.getActiveTypingTarget();
    if (!target) return false;

    const text = message.text;
    if (typeof text !== "string" || text.length === 0) {
      sendResponse({ ok: false, error: "Clipboard is empty." });
      return false;
    }

    const options = { ...DEFAULT_OPTIONS, ...message.options };
    typingChain = typingChain
      .then(() => {
        target.focus();
        return sim.typeText(target, text, options);
      })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }

  if (message?.type === "TYPE_FROM_PAGE") {
    if (!document.hasFocus() || !globalThis.__clipboardTyperSimulator?.getActiveTypingTarget()) {
      return false;
    }
    runTyping();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
}
