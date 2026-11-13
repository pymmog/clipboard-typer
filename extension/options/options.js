const browserApi = typeof browser !== "undefined" ? browser : chrome;

const form = document.getElementById("form");
const savedEl = document.getElementById("saved");

function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.platform || "") || navigator.userAgent.includes("Macintosh");
}

function defaultShortcut() {
  const mac = isMac();
  return { key: "j", meta: mac, ctrl: false, alt: !mac, shift: true };
}

const DEFAULTS = {
  delayMs: 35,
  jitterMs: 15,
  respectNewlines: true,
  shortcut: defaultShortcut(),
};

let shortcut = defaultShortcut();

function formatShortcut(s) {
  const parts = [];
  if (s.meta) parts.push("⌘");
  if (s.ctrl) parts.push("Ctrl");
  if (s.alt) parts.push("Alt");
  if (s.shift) parts.push("Shift");
  parts.push((s.key || "").toUpperCase());
  return parts.join(" + ");
}

const recordButton = document.getElementById("record");
const shortcutLabel = document.getElementById("shortcut-label");

function showShortcut() {
  recordButton.textContent = formatShortcut(shortcut);
  shortcutLabel.textContent = "Current shortcut: " + formatShortcut(shortcut);
}

recordButton.addEventListener("click", () => {
  recordButton.classList.add("recording");
  recordButton.textContent = "Press a shortcut…";
});

recordButton.addEventListener("keydown", (event) => {
  if (!recordButton.classList.contains("recording")) return;
  if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const key = (event.key || "").toLowerCase();
  if (key.length !== 1 && key !== "enter" && key !== "tab") {
    recordButton.classList.remove("recording");
    showShortcut();
    return;
  }
  if (!event.metaKey && !event.ctrlKey && !event.altKey) {
    recordButton.classList.remove("recording");
    showShortcut();
    shortcutLabel.textContent = "Include ⌘, Ctrl, or Alt so typing still works.";
    return;
  }
  shortcut = {
    key,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };
  recordButton.classList.remove("recording");
  showShortcut();
});

async function load() {
  const stored = await browserApi.storage.sync.get(DEFAULTS);
  document.getElementById("delayMs").value = stored.delayMs;
  document.getElementById("jitterMs").value = stored.jitterMs;
  document.getElementById("respectNewlines").checked = Boolean(stored.respectNewlines);
  shortcut = { ...defaultShortcut(), ...(stored.shortcut || {}) };
  showShortcut();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    delayMs: Number(document.getElementById("delayMs").value),
    jitterMs: Number(document.getElementById("jitterMs").value),
    respectNewlines: document.getElementById("respectNewlines").checked,
    shortcut,
  };
  await browserApi.storage.sync.set(data);
  savedEl.hidden = false;
  setTimeout(() => {
    savedEl.hidden = true;
  }, 2000);
});

load();
