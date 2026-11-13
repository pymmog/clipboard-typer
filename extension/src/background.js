const browserApi = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_OPTIONS = {
  delayMs: 35,
  jitterMs: 15,
  respectNewlines: true,
};

const OFFSCREEN_PATH = "offscreen/offscreen.html";

async function loadOptions() {
  const stored = await browserApi.storage.sync.get(DEFAULT_OPTIONS);
  return { ...DEFAULT_OPTIONS, ...stored };
}

function offscreenUrl() {
  return browserApi.runtime.getURL(OFFSCREEN_PATH);
}

async function ensureOffscreenDocument() {
  if (!browserApi.offscreen?.createDocument) return false;

  try {
    const hasDoc = await browserApi.offscreen.hasDocument();
    if (hasDoc) return true;
  } catch {
    // hasDocument may throw if API unavailable
  }

  const reason = browserApi.offscreen.Reason?.CLIPBOARD ?? "CLIPBOARD";
  await browserApi.offscreen.createDocument({
    url: offscreenUrl(),
    reasons: [reason],
    justification: "Read plain-text clipboard when the extension keyboard shortcut is used.",
  });
  return true;
}

function sendOffscreenMessage(message) {
  return new Promise((resolve, reject) => {
    browserApi.runtime.sendMessage(message, (response) => {
      const err = browserApi.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}

async function readClipboardViaOffscreen() {
  const ready = await ensureOffscreenDocument();
  if (!ready) throw new Error("Offscreen clipboard helper unavailable");

  const response = await sendOffscreenMessage({ type: "OFFSCREEN_READ_CLIPBOARD" });
  if (response?.ok && typeof response.text === "string") return response.text;
  throw new Error(response?.error || "Offscreen clipboard read failed");
}

function isSafari() {
  return typeof browser !== "undefined" && !browserApi.offscreen;
}

function sendNativeMessage(payload) {
  const runtime = browserApi.runtime;
  if (typeof runtime?.sendNativeMessage !== "function") {
    return Promise.reject(new Error("Native messaging unavailable"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      const err = runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    };
    let returned;
    try {
      returned = runtime.sendNativeMessage("com.local.clipboard-typer", payload, finish);
    } catch (err) {
      reject(err);
      return;
    }
    if (returned && typeof returned.then === "function") {
      returned.then(finish, (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });
    }
  });
}

async function readClipboardViaNativeApp() {
  const response = await sendNativeMessage({ type: "READ_CLIPBOARD" });
  if (response?.ok && typeof response.text === "string") return response.text;
  throw new Error(response?.error || "Native clipboard read failed");
}

async function readClipboardText() {
  if (isSafari()) {
    return readClipboardViaNativeApp();
  }

  if (navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch (err) {
      // Chrome keyboard commands have no user gesture — use offscreen next
      if (!String(err).includes("Document is not focused")) {
        throw err;
      }
    }
  }

  return readClipboardViaOffscreen();
}

function isRestrictedTabUrl(url) {
  if (!url) return true;
  const blocked = ["chrome://", "chrome-extension://", "edge://", "about:", "safari-extension://", "safari-web-extension://"];
  return blocked.some((prefix) => url.startsWith(prefix));
}

async function sendTypeToTab(tabId, text, options) {
  return browserApi.tabs.sendMessage(tabId, {
    type: "TYPE_CLIPBOARD",
    text,
    options,
  });
}

async function typeTextInActiveTab(text, trigger) {
  const trimmed = typeof text === "string" ? text.trimEnd() : "";
  if (!trimmed) {
    return { ok: false, error: "Clipboard is empty." };
  }

  const options = await loadOptions();
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab." };
  }

  if (isRestrictedTabUrl(tab.url)) {
    return { ok: false, error: "Cannot type on restricted browser pages. Use a normal website tab." };
  }

  try {
    const response = await sendTypeToTab(tab.id, trimmed, { ...options, trigger });
    return response ?? { ok: false, error: "No response from page." };
  } catch (err) {
    const message = err?.message || String(err);
    if (message.includes("Receiving end does not exist")) {
      return { ok: false, error: "Reload the page after installing the extension, then try again." };
    }
    if (message.includes("Could not establish connection")) {
      return { ok: false, error: "Click into a text field first, then press the shortcut again." };
    }
    return { ok: false, error: message };
  }
}

async function typeClipboardInActiveTab(trigger) {
  let text;
  try {
    text = await readClipboardText();
  } catch (err) {
    return {
      ok: false,
      error:
        "Could not read the clipboard. On macOS: System Settings → Privacy & Security → Pasteboard → allow Chrome. " +
        "Then reload the extension at chrome://extensions and the website tab.",
      detail: err?.message || String(err),
    };
  }

  return typeTextInActiveTab(text, trigger);
}

function flashActionResult(result) {
  if (!browserApi.action?.setBadgeText) return;
  browserApi.action.setBadgeBackgroundColor({ color: result?.ok ? "#15803d" : "#b91c1c" });
  browserApi.action.setBadgeText({ text: result?.ok ? "OK" : "!" });
  setTimeout(() => browserApi.action.setBadgeText({ text: "" }), 1600);
}

async function runTypeFromUserGesture(trigger) {
  const result = await typeClipboardInActiveTab(trigger);
  flashActionResult(result);
  if (!result.ok) {
    console.warn("[Clipboard Typer]", result.error, result.detail || "");
  }
  return result;
}

if (browserApi.action?.onClicked) {
  browserApi.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) return;
    try {
      await browserApi.tabs.sendMessage(tab.id, { type: "TYPE_FROM_PAGE" });
    } catch {
      await runTypeFromUserGesture("action");
    }
  });
}

// Ignore messages intended for the offscreen document (this worker also receives broadcasts).
browserApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OFFSCREEN_READ_CLIPBOARD") return false;

  if (message?.type === "READ_CLIPBOARD") {
    readClipboardText()
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }

  if (message?.type === "TYPE_TEXT_FROM_POPUP") {
    typeTextInActiveTab(message.text, "popup")
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }

  return false;
});
