const queryInput = document.querySelector("#query");
const results = document.querySelector("#results");
const api = globalThis.browser ?? globalThis.chrome;
const scanEnabled = document.querySelector("#scan-enabled");

api.storage.local.get({ dokushoSettings: { enabled: true, selectionScan: false, desktopShift: true, touchTap: true } }).then(({ dokushoSettings }) => {
  scanEnabled.checked = dokushoSettings.enabled !== false;
  updateScanLabel();
});
function updateScanLabel() {
  document.querySelector("#scan-label").textContent = scanEnabled.checked ? "Quét đang bật" : "Quét đang tắt";
}
scanEnabled.addEventListener("change", async () => {
  const requested = scanEnabled.checked;
  try {
    const { dokushoSettings } = await api.storage.local.get({ dokushoSettings: { enabled: true, selectionScan: false, desktopShift: true, touchTap: true } });
    await api.storage.local.set({ dokushoSettings: { ...dokushoSettings, enabled: requested } });
    const saved = await api.storage.local.get({ dokushoSettings: { enabled: true } });
    scanEnabled.checked = saved.dokushoSettings.enabled !== false;
  } catch {
    scanEnabled.checked = !requested;
  }
  updateScanLabel();
});

async function showResults(query) {
  results.replaceChildren();
  if (!query) {
    results.textContent = "Bôi đen một từ trên trang rồi mở Dokusho, hoặc nhập từ cần tra ở trên.";
    return;
  }
  const matches = await DokushoDB.search(query, 30);
  if (!matches.length) {
    results.textContent = "Không tìm thấy. Hãy nhập từ điển Yomitan trong mục Từ điển.";
    return;
  }
  for (const entry of matches) {
    const card = document.createElement("article");
    const head = document.createElement("h2");
    head.textContent = [entry.expression, entry.reading].filter(Boolean).join(" · ");
    const body = document.createElement("div");
    body.className = "definition";
    body.innerHTML = entry.definitionHtml;
    card.append(head, body);
    if (entry.dictionary) {
      const source = document.createElement("small");
      source.textContent = entry.dictionary;
      card.append(source);
    }
    results.append(card);
  }
}

document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showResults(queryInput.value.trim());
});

api.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  if (!tab?.id) return;
  try {
    const response = await api.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
    if (response?.text) {
      queryInput.value = response.text.slice(0, 80);
      showResults(queryInput.value);
      return;
    }
  } catch { /* Some protected pages do not allow content scripts. */ }
  results.textContent = "Bôi đen một từ trên trang rồi mở Dokusho, hoặc nhập từ cần tra ở trên.";
});
