const browserApi = typeof browser !== "undefined" ? browser : chrome;

const form = document.getElementById("form");
const savedEl = document.getElementById("saved");

const DEFAULTS = {
  delayMs: 35,
  jitterMs: 15,
  respectNewlines: true,
};

async function load() {
  const stored = await browserApi.storage.sync.get(DEFAULTS);
  document.getElementById("delayMs").value = stored.delayMs;
  document.getElementById("jitterMs").value = stored.jitterMs;
  document.getElementById("respectNewlines").checked = Boolean(stored.respectNewlines);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    delayMs: Number(document.getElementById("delayMs").value),
    jitterMs: Number(document.getElementById("jitterMs").value),
    respectNewlines: document.getElementById("respectNewlines").checked,
  };
  await browserApi.storage.sync.set(data);
  savedEl.hidden = false;
  setTimeout(() => {
    savedEl.hidden = true;
  }, 2000);
});

load();
