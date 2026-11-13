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

  function isEditableElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (HTML_TAGS.has(el.tagName)) {
      const type = (el.type || "text").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "checkbox" || type === "radio" || type === "file") {
        return false;
      }
      return !el.disabled && !el.readOnly;
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function getActiveTypingTarget() {
    const active = document.activeElement;
    if (isEditableElement(active)) return active;
    const shadowActive = active?.shadowRoot?.activeElement;
    if (isEditableElement(shadowActive)) return shadowActive;
    return null;
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

  function insertIntoContentEditable(element, text) {
    const selection = element.ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0) {
      element.appendChild(element.ownerDocument.createTextNode(text));
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = element.ownerDocument.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function typeCharIntoElement(element, ch) {
    if (element.isContentEditable) {
      const previous = element.textContent ?? "";
      insertIntoContentEditable(element, ch);
      notifyInput(element, previous, ch);
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const value = element.value ?? "";
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
      const normalized = respectNewlines ? text.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : text.replace(/[\r\n]+/g, " ");

      for (const ch of normalized) {
        typeCharIntoElement(element, ch);
        const wait = jitteredDelay(delayMs, jitterMs);
        if (wait > 0) await sleep(wait);
      }

      element.dispatchEvent(new Event("change", { bubbles: true }));
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
