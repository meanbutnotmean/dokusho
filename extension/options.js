const archiveInput = document.querySelector("#archive");
const api = globalThis.browser ?? globalThis.chrome;
const statusLine = document.querySelector("#status");
const progress = document.querySelector("#progress");
const list = document.querySelector("#dictionary-list");
const desktopShift = document.querySelector("#desktop-shift");
const touchTap = document.querySelector("#touch-tap");
const selectionScan = document.querySelector("#selection-scan");

api.storage.local.get({ dokushoSettings: { enabled: true, selectionScan: false, desktopShift: true, touchTap: true } }).then(({ dokushoSettings }) => {
  selectionScan.checked = dokushoSettings.selectionScan === true;
  desktopShift.checked = dokushoSettings.desktopShift !== false;
  touchTap.checked = dokushoSettings.touchTap !== false;
});
function saveTriggers() {
  api.storage.local.get({ dokushoSettings: { enabled: true, selectionScan: false, desktopShift: true, touchTap: true } }).then(({ dokushoSettings }) => {
    api.storage.local.set({ dokushoSettings: { ...dokushoSettings, selectionScan: selectionScan.checked, desktopShift: desktopShift.checked, touchTap: touchTap.checked } });
  });
}
selectionScan.addEventListener("change", saveTriggers);
desktopShift.addEventListener("change", saveTriggers);
touchTap.addEventListener("change", saveTriggers);

function setProgress(percent, message) {
  progress.hidden = false;
  progress.max = 100;
  progress.value = Math.max(0, Math.min(100, percent));
  statusLine.textContent = `${message} · ${Math.round(progress.value)}%`;
}

function setIndeterminate(message) {
  progress.hidden = false;
  progress.removeAttribute("value");
  statusLine.textContent = message;
}

const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

function flattenDefinition(definition) {
  if (typeof definition === "string") {
    const trimmed = definition.trim();
    if (trimmed.includes('"tag"') && trimmed.includes('"content"') && /^[\[{]/.test(trimmed)) {
      try { return flattenStructured(JSON.parse(trimmed)); } catch { /* Keep malformed source text readable. */ }
    }
    return definition;
  }
  if (Array.isArray(definition)) return definition.map(flattenDefinition).filter(Boolean).join("<br>");
  if (!definition || typeof definition !== "object") return "";
  if (definition.type === "text") return String(definition.text ?? "");
  if (definition.type === "html") return String(definition.content ?? "");
  if (definition.type === "image") return "";
  if (definition.type === "structured-content") return flattenStructured(definition.content);
  if (definition.content) return flattenDefinition(definition.content);
  return "";
}

function escapeHtmlText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\r?\n/g, "<br>");
}

function flattenStructured(node) {
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    if (text.includes('"tag"') && text.includes('"content"') && /^[\[{]/.test(text.trim())) {
      try { return flattenStructured(JSON.parse(text)); } catch { /* Treat as ordinary text. */ }
    }
    return escapeHtmlText(text);
  }
  if (Array.isArray(node)) return node.map(flattenStructured).filter(Boolean).join("");
  if (!node || typeof node !== "object") return "";
  if (node.tag === "img") return node.title ? escapeHtmlText(node.title) : "";
  const content = flattenStructured(node.content);
  const tag = String(node.tag ?? "").toLowerCase();
  const allowed = new Set(["div", "p", "span", "ol", "ul", "li", "br", "b", "strong", "i", "em", "ruby", "rt", "rp", "table", "tbody", "tr", "td", "th"]);
  if (!allowed.has(tag)) return content;
  if (tag === "br") return "<br>";
  if (tag === "ol" || tag === "ul") return `<${tag}>${content}</${tag}>`;
  if (tag === "li") return `<li>${content}</li>`;
  if (["div", "p", "table", "tbody", "tr", "td", "th"].includes(tag)) return `<${tag}>${content}</${tag}>`;
  return `<${tag}>${content}</${tag}>`;
}

function formatMeanings(definitions) {
  const values = Array.isArray(definitions) ? definitions : [definitions];
  if (values.length === 1 && values[0]?.type === "structured-content" && containsStructuredList(values[0].content)) {
    return flattenStructured(values[0].content);
  }
  const lines = [];
  for (const value of values) {
    const meaning = flattenDefinition(value).trim();
    if (!meaning) continue;
    // Some dictionaries store several numbered translations in one gloss string.
    const pieces = meaning.split(/\s+(?=\d+\.\s+)/u);
    for (const piece of pieces) lines.push(piece.trim());
  }
  return lines.map((meaning, index) => {
    const alreadyNumbered = /^\d+\.\s/u.test(meaning);
    const label = alreadyNumbered ? "" : `<span class="gloss-number">${index + 1}.</span> `;
    return `<div class="gloss-line">${label}${meaning}</div>`;
  }).join("");
}

function containsStructuredList(node) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(containsStructuredList);
  return ["ol", "ul", "li"].includes(String(node.tag ?? "").toLowerCase()) || containsStructuredList(node.content);
}

async function renderDictionaries() {
  list.replaceChildren();
  const installed = await DokushoDB.listDictionaries();
  const { dictionaryOrder = [] } = await api.storage.local.get({ dictionaryOrder: [] });
  const names = [...dictionaryOrder.filter((name) => installed.includes(name)), ...installed.filter((name) => !dictionaryOrder.includes(name)).sort()];
  if (!names.length) { list.textContent = "Chưa có từ điển nào."; return; }
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;
    const order = document.createElement("span");
    order.className = "order-controls";
    for (const [text, delta, disabled] of [["↑", -1, index === 0], ["↓", 1, index === names.length - 1]]) {
      const move = document.createElement("button");
      move.textContent = text;
      move.title = delta < 0 ? "Ưu tiên cao hơn" : "Ưu tiên thấp hơn";
      move.disabled = disabled;
      move.addEventListener("click", async () => {
        const reordered = [...names];
        [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
        await api.storage.local.set({ dictionaryOrder: reordered });
        await renderDictionaries();
      });
      order.append(move);
    }
    const remove = document.createElement("button");
    remove.textContent = "Gỡ";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      setIndeterminate(`Đang chuẩn bị gỡ ${name}…`);
      try {
        await DokushoDB.removeDictionary(name, ({ done, total }) => setProgress(total ? 100 * done / total : 100, `Đang gỡ ${name}: ${done.toLocaleString()} / ${total.toLocaleString()} mục`));
        const current = await api.storage.local.get({ dictionaryOrder: [] });
        await api.storage.local.set({ dictionaryOrder: current.dictionaryOrder.filter((item) => item !== name) });
        setProgress(100, `Đã gỡ ${name}`);
        await renderDictionaries();
      } catch (error) {
        statusLine.textContent = `Gỡ thất bại: ${error.message}`;
      } finally { remove.disabled = false; }
    });
    li.append(label, order, remove);
    list.append(li);
  }
}

archiveInput.addEventListener("change", async () => {
  const file = archiveInput.files?.[0];
  if (!file) return;
  archiveInput.disabled = true;
  setIndeterminate(`Đang đọc ZIP (${(file.size / 1024 / 1024).toFixed(1)} MB)…`);
  try {
    const { unzip, strFromU8 } = window.fflate;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setIndeterminate("Đang giải nén ZIP…");
    const files = await new Promise((resolve, reject) => {
      unzip(bytes, (error, unzipped) => error ? reject(error) : resolve(unzipped));
    });
    setProgress(35, `Đã giải nén ${Object.keys(files).length.toLocaleString()} file`);
    await yieldToUi();
    const readJson = (path) => JSON.parse(strFromU8(files[path]));
    if (!files["index.json"]) throw new Error("Missing index.json; this does not look like a Yomitan dictionary ZIP.");
    const metadata = readJson("index.json");
    const name = String(metadata.title || file.name.replace(/\.zip$/i, ""));
    const bankNames = Object.keys(files).filter((path) => /^term_bank_\d+\.json$/.test(path)).sort();
    const kanjiBankNames = Object.keys(files).filter((path) => /^kanji_bank_\d+\.json$/.test(path)).sort();
    if (!bankNames.length && !kanjiBankNames.length) throw new Error("No term_bank_*.json or kanji_bank_*.json files found in this archive.");
    const entries = [];
    let sequence = 0;
    const allBanks = [...bankNames.map((path) => ({ path, kind: "term" })), ...kanjiBankNames.map((path) => ({ path, kind: "kanji" }))];
    for (let bankIndex = 0; bankIndex < allBanks.length; bankIndex++) {
      const { path, kind } = allBanks[bankIndex];
      setProgress(37 + (bankIndex / allBanks.length) * 36, `Đang đọc ${path}…`);
      await yieldToUi();
      const rows = readJson(path);
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (kind === "term" && Array.isArray(row) && row.length >= 6) {
          const [expression, reading, definitionTags, rules, score, definitions, , termTags] = row;
          const html = formatMeanings(definitions);
          entries.push({ id: `${name}:${sequence++}`, dictionary: name, expression: String(expression ?? ""), reading: String(reading ?? ""), tags: [definitionTags, termTags].filter(Boolean).join(" · "), rules: String(rules ?? ""), score: Number(score) || 0, definitionHtml: html });
        } else if (kind === "kanji" && Array.isArray(row) && row.length >= 5 && row[0]) {
          const [character, onyomi, kunyomi, tags, meanings] = row;
          const readings = [...(Array.isArray(onyomi) ? onyomi : [onyomi]), ...(Array.isArray(kunyomi) ? kunyomi : [kunyomi])].filter(Boolean).join(" · ");
          const meaningHtml = formatMeanings(meanings);
          entries.push({ id: `${name}:kanji:${sequence++}`, dictionary: name, expression: String(character), reading: readings, tags: Array.isArray(tags) ? tags.join(" · ") : String(tags ?? ""), rules: "", score: 0, entryKind: "kanji", definitionHtml: meaningHtml });
        }
        if (rowIndex % 300 === 0) {
          const bankFraction = (bankIndex + rowIndex / Math.max(rows.length, 1)) / allBanks.length;
          setProgress(37 + bankFraction * 36, `Đang phân tích ${path}: ${Math.min(rowIndex + 1, rows.length).toLocaleString()} / ${rows.length.toLocaleString()} mục`);
          await yieldToUi();
        }
      }
      setProgress(37 + ((bankIndex + 1) / allBanks.length) * 36, `Đã phân tích xong ${path}`);
      await yieldToUi();
    }
    if (!entries.length) throw new Error("File này không có mục từ hoặc Kanji có thể nhập.");
    setProgress(74, `Đang lưu ${entries.length.toLocaleString()} mục…`);
    await DokushoDB.replaceDictionary(name, entries, ({ phase, done, total }) => {
      const percent = total ? 75 + 24 * done / total : 99;
      const action = phase === "removing" ? "Đang thay dữ liệu cũ" : "Đang ghi vào thiết bị";
      setProgress(percent, `${action}: ${done.toLocaleString()} / ${total.toLocaleString()} mục`);
    });
    statusLine.textContent = `Đã nhập ${name}: ${entries.length.toLocaleString()} mục.`;
    progress.value = 100;
    await renderDictionaries();
  } catch (error) {
    progress.removeAttribute("value");
    statusLine.textContent = `Nhập thất bại: ${error.message || "Không đọc được từ điển."}`;
  } finally {
    archiveInput.disabled = false;
    archiveInput.value = "";
  }
});

renderDictionaries();
