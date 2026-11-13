/**
 * Simulates typing character-by-character into inputs, textareas, and contenteditable nodes.
 * Loaded in the page context via content script (ISOLATED world still has DOM access).
 */
(function initTypeSimulator(global) {
  if (global.__clipboardTyperSimulator) return;

  const HTML_TAGS = new Set(["INPUT", "TEXTAREA"]);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function jitteredDelay(baseMs, jitterMs) {
    const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs : 0;
    return Math.max(0, baseMs + jitter);
  }

  function isRichText(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.isContentEditable) return true;
    const role = el.getAttribute?.("role");
    return role === "textbox" || role === "searchbox";
  }

  function hasTextValue(el) {
    return !!el && typeof el.value === "string";
  }

  function isEditableElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (isRichText(el)) return true;
    if (HTML_TAGS.has(el.tagName) && hasTextValue(el)) {
      const type = (el.type || "text").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "checkbox" || type === "radio" || type === "file") {
        return false;
      }
      return !el.disabled && !el.readOnly;
    }
    return false;
  }

  function findEditable(node, depth) {
    if (!node || depth > 6) return null;
    if (node.shadowRoot?.activeElement) {
      const inner = findEditable(node.shadowRoot.activeElement, depth + 1);
      if (inner) return inner;
    }
    if (isEditableElement(node)) return node;
    return findEditable(node.parentElement, depth + 1);
  }

  function editorRoot(el) {
    let node = el;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const testId = node.getAttribute?.("data-testid") || "";
        if (testId.startsWith("tweetTextarea")) return node;
        const mode = node.getAttribute?.("contenteditable");
        if (mode === "true" || mode === "plaintext-only") return node;
      }
      if (node.parentElement) {
        node = node.parentElement;
        continue;
      }
      const owner = node.getRootNode?.();
      node = owner instanceof ShadowRoot ? owner.host : null;
    }
    return el;
  }

  function getActiveTypingTarget() {
    const found = findEditable(document.activeElement, 0);
    if (!found) return null;
    return isRichText(found) ? editorRoot(found) : found;
  }

  function setNativeValue(element, value) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function notifyInput(element, previousValue, ch) {
    const tracker = element._valueTracker;
    if (tracker) tracker.setValue(previousValue);
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: ch,
      })
    );
  }

  function plainText(element) {
    return element.innerText ?? element.textContent ?? "";
  }

  function dispatchPaste(element, text) {
    try {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      const event = new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      });
      return element.dispatchEvent(event);
    } catch {
      return true;
    }
  }

  async function typeRichChar(element, ch) {
    const before = plainText(element);
    const notCanceled = dispatchPaste(element, ch);
    await sleep(20);
    if (plainText(element) !== before) return;
    if (!notCanceled) return;

    element.ownerDocument.execCommand(ch === "\n" ? "insertLineBreak" : "insertText", false, ch);
  }

  function typeCharIntoElement(element, ch) {
    if (isRichText(element) || !hasTextValue(element)) {
      typeRichChar(element, ch);
      return;
    }

    const value = element.value;
    const start = typeof element.selectionStart === "number" ? element.selectionStart : value.length;
    const end = typeof element.selectionEnd === "number" ? element.selectionEnd : value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    setNativeValue(element, next);
    const caret = start + ch.length;
    try {
      element.selectionStart = caret;
      element.selectionEnd = caret;
    } catch {
      // number/email inputs can reject a selection range
    }
    notifyInput(element, value, ch);
  }

  async function typeText(element, text, options = {}) {
    if (element.dataset?.ctTyping === "1") return { typed: 0, skipped: true };
    if (element.dataset) element.dataset.ctTyping = "1";

    const delayMs = options.delayMs ?? 35;
    const jitterMs = options.jitterMs ?? 15;
    const respectNewlines = options.respectNewlines ?? true;

    try {
      element.focus();
      const rich = isRichText(element);
      const normalized = respectNewlines ? text.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : text.replace(/[\r\n]+/g, " ");

      for (const ch of normalized) {
        if (rich) await typeRichChar(element, ch);
        else typeCharIntoElement(element, ch);
        const wait = jitteredDelay(delayMs, jitterMs);
        if (wait > 0) await sleep(wait);
      }

      if (!rich) element.dispatchEvent(new Event("change", { bubbles: true }));
      return { typed: normalized.length };
    } finally {
      if (element.dataset?.ctTyping === "1") delete element.dataset.ctTyping;
    }
  }

  global.__clipboardTyperSimulator = {
    getActiveTypingTarget,
    isEditableElement,
    typeText,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
