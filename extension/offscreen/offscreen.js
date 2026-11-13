const browserApi = typeof browser !== "undefined" ? browser : chrome;

async function readTextFromClipboard() {
  if (navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // fall through to execCommand paste
    }
  }

  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(textarea);
  textarea.focus();

  const pasted = document.execCommand("paste");
  const text = textarea.value;
  textarea.remove();

  if (!text && !pasted) {
    throw new Error("Clipboard paste fallback failed");
  }
  return text;
}

browserApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OFFSCREEN_READ_CLIPBOARD") return false;

  readTextFromClipboard()
    .then((text) => sendResponse({ ok: true, text }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));

  return true;
});
