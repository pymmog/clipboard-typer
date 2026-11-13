const browserApi = typeof browser !== "undefined" ? browser : chrome;

const typeButton = document.getElementById("type");
const statusEl = document.getElementById("status");
const optionsLink = document.getElementById("options");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  browserApi.runtime.openOptionsPage();
});

typeButton.addEventListener("click", async () => {
  typeButton.disabled = true;
  setStatus("Reading clipboard…");

  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch (err) {
    setStatus(
      "Clipboard blocked here. On macOS: System Settings → Privacy & Security → Pasteboard → allow your browser. Then click this button again.",
      "error"
    );
    typeButton.disabled = false;
    return;
  }

  if (!text?.trim()) {
    setStatus("Clipboard is empty.", "error");
    typeButton.disabled = false;
    return;
  }

  setStatus("Typing…");

  try {
    const response = await browserApi.runtime.sendMessage({
      type: "TYPE_TEXT_FROM_POPUP",
      text,
    });

    if (response?.ok) {
      setStatus(`Typed ${response.typed} characters.`, "ok");
    } else {
      setStatus(response?.error || "Something went wrong.", "error");
    }
  } catch (err) {
    setStatus(err?.message || String(err), "error");
  } finally {
    typeButton.disabled = false;
  }
});
