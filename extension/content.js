(() => {
  if (window.top !== window || window.__dokushoContentLoaded) return;
  window.__dokushoContentLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = "__dokusho_dictionary_host";
  let host;
  let shadow;
  let settings = { enabled: true, selectionScan: false, desktopShift: true, touchTap: true };
  let lastHoverKey = "";
  let requestNumber = 0;
  let moveFrame = 0;
  let selectionAtPointerDown = "";
  let handledPopupSelectionAt = 0;
  const stack = [];
  const isJapaneseCharacter = (character) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character ?? "");

  function ensureUi() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host{all:initial;color-scheme:dark;font:15px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}
      .layer{position:fixed;pointer-events:auto;width:min(460px,calc(100vw - 20px));max-height:min(66vh,600px);overflow:auto;background:#191a1c;color:#f4f3f1;border:1px solid #5d6065;border-radius:10px;box-shadow:0 12px 38px #000b;overscroll-behavior:contain;backdrop-filter:blur(16px)}
      .body{padding:10px 13px 14px;overflow-wrap:anywhere}.entry{padding:10px 2px 13px;border-bottom:1px solid #ffffff17}.entry:first-child{padding-top:3px}.entry:last-child{border-bottom:0}
      .entry-title{font-size:27px;font-weight:750;line-height:1.35;color:#fff;letter-spacing:.01em}.entry-title ruby{ruby-position:over}.entry-title rt{font-size:11px;font-weight:450;line-height:1.1;color:#d7d7dc;letter-spacing:0}.reading{color:#c6c7cb;font-size:14px;margin-top:3px}.source{display:inline-block;color:#c8bafa;font-size:11px;margin:8px 0 0;padding:2px 7px;border-radius:999px;background:#9b7de324}.tags{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}.tag{font-size:11px;color:#c9e8d0;background:#4d9e6828;border:1px solid #65b67e65;border-radius:5px;padding:1px 6px}.kind{color:#c7dcff;background:#488be528;border-color:#68a2ff5c}.definition{margin-top:7px;cursor:text;user-select:text;color:#e4e2df}.definition a{color:#82baff}.definition img{max-width:100%;height:auto}
      .entry-title{display:block;width:100%;margin:2px 0 7px}.entry{display:block;width:100%;box-sizing:border-box}
      .definition .gloss-line{display:block;margin:3px 0}.definition .gloss-number{font-weight:700;color:#fff}.empty,.hint{color:#aaa;padding:14px 6px}.nested{border-left:3px solid #69a5ff;border-radius:0 10px 10px 0;box-shadow:0 14px 40px #000c}
      .definition ol,.definition ul{margin:4px 0;padding-left:1.5em}.definition li{display:list-item;margin:2px 0}.definition div,.definition p{margin:3px 0}
      button:hover{filter:brightness(1.3)}
    `;
    shadow.append(style);
    document.documentElement.append(host);
    shadow.addEventListener("pointerdown", (event) => event.stopPropagation());
    shadow.addEventListener("click", onPopupClick);
  }

  document.addEventListener("pointerdown", (event) => {
    selectionAtPointerDown = window.getSelection()?.toString().trim() ?? "";
    if (host?.isConnected && !event.composedPath().includes(host)) clear();
  }, true);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") clear(); }, true);

  function clampPosition(x, y, element) {
    const width = Math.min(440, innerWidth - 20);
    const height = Math.min(innerHeight * 0.62, 560);
    return { left: Math.max(10, Math.min(x, innerWidth - width - 10)), top: Math.max(10, Math.min(y, innerHeight - height - 10)) };
  }

  function clear() {
    stack.length = 0;
    shadow?.querySelectorAll(".layer").forEach((node) => node.remove());
  }

  function escapeHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    template.content.querySelectorAll("script,style,iframe,object,embed,form,svg,video,audio").forEach((node) => node.remove());
    template.content.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        if (attr.name.toLowerCase().startsWith("on") || ["srcdoc", "style"].includes(attr.name.toLowerCase())) node.removeAttribute(attr.name);
        if (["href", "src"].includes(attr.name.toLowerCase()) && /^\s*javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
      });
    });
    return template.content;
  }

  function toHiragana(value) {
    return [...value].map((character) => {
      const code = character.codePointAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : character;
    }).join("");
  }

  function appendFurigana(container, expression, reading) {
    const chars = [...expression];
    const normalizedReading = toHiragana(reading);
    const readingChars = [...normalizedReading];
    const isKana = (character) => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(character);
    const isKanji = (character) => /\p{Script=Han}/u.test(character);
    let readingOffset = 0;
    for (let i = 0; i < chars.length;) {
      if (isKanji(chars[i])) {
        let end = i + 1;
        while (end < chars.length && isKanji(chars[end])) end++;
        let anchorEnd = end;
        while (anchorEnd < chars.length && isKana(chars[anchorEnd])) anchorEnd++;
        const anchor = chars.slice(end, anchorEnd).join("");
        const normalizedAnchor = toHiragana(anchor);
        let readingEnd = readingChars.length;
        if (normalizedAnchor) {
          const joined = readingChars.join("");
          const foundAt = joined.indexOf(normalizedAnchor, readingOffset);
          if (foundAt >= readingOffset) readingEnd = [...joined.slice(0, foundAt)].length;
        }
        const rubyReading = readingChars.slice(readingOffset, readingEnd).join("");
        if (rubyReading) {
          const ruby = document.createElement("ruby");
          ruby.append(document.createTextNode(chars.slice(i, end).join("")));
          const rt = document.createElement("rt");
          rt.textContent = rubyReading;
          ruby.append(rt);
          container.append(ruby);
          readingOffset = readingEnd;
        } else {
          container.append(document.createTextNode(chars.slice(i, end).join("")));
        }
        i = end;
        continue;
      }
      container.append(document.createTextNode(chars[i]));
      if (isKana(chars[i])) {
        const expected = toHiragana(chars[i]);
        if (toHiragana(readingChars[readingOffset] ?? "") === expected) readingOffset++;
      }
      i++;
    }
  }

  function placeLayer(layer, x, y, nested = false) {
    const pos = clampPosition(x, y, layer);
    layer.style.left = `${pos.left}px`;
    layer.style.top = `${pos.top}px`;
    if (nested) layer.classList.add("nested");
  }

  function selectedLookup(parentIndex = -1) {
    const selection = window.getSelection();
    const query = selection?.toString().trim();
    if (!query || !isJapaneseCharacter([...query][0])) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    lookup(query, rect.left, rect.bottom + 8, parentIndex);
  }

  async function lookup(query, x, y, parentIndex = -1) {
    const clean = query.trim().slice(0, 80);
    if (!clean) return;
    ensureUi();
    if (parentIndex < 0) clear();
    else {
      while (stack.length > parentIndex + 1) stack.pop().remove();
    }
    const id = ++requestNumber;
    const layer = document.createElement("section");
    layer.className = "layer";
    layer.innerHTML = '<div class="body"><div class="hint">Đang tra…</div></div>';
    shadow.append(layer);
    placeLayer(layer, x, y, parentIndex >= 0);
    stack.push(layer);
    try {
      const response = await api.runtime.sendMessage({ type: "SCAN", text: clean, limit: 12 });
      if (id !== requestNumber || !layer.isConnected) return;
      const body = layer.querySelector(".body");
      body.replaceChildren();
      if (!response?.results?.length) {
        body.innerHTML = '<div class="empty">Không tìm thấy trong từ điển.</div>';
        return;
      }
      for (const entry of response.results) {
        const card = document.createElement("article");
        card.className = "entry";
        const title = document.createElement("div");
        title.className = "entry-title";
        const expression = entry.expression || clean;
        if (entry.reading && [...expression].some((character) => /\p{Script=Han}/u.test(character))) appendFurigana(title, expression, entry.reading);
        else title.textContent = expression;
        const reading = document.createElement("div");
        reading.className = "reading";
        reading.textContent = entry.reading || "";
        const tags = document.createElement("div");
        tags.className = "tags";
        const tagValues = [entry.entryKind === "kanji" ? "Kanji" : "Từ", ...(entry.tags || "").split(" · ").filter(Boolean)];
        for (const value of tagValues.slice(0, 6)) {
          const badge = document.createElement("span");
          badge.className = `tag${value === "Kanji" ? " kind" : ""}`;
          badge.textContent = value;
          tags.append(badge);
        }
        const definition = document.createElement("div");
        definition.className = "definition";
        definition.append(escapeHtml(entry.definitionHtml));
        const source = document.createElement("div");
        source.className = "source";
        source.textContent = entry.dictionary;
        card.append(title);
        if (entry.reading && ![...expression].some((character) => /\p{Script=Han}/u.test(character))) card.append(reading);
        if (tags.childElementCount) card.append(tags);
        card.append(definition, source);
        body.append(card);
      }
    } catch {
      if (layer.isConnected) layer.querySelector(".body").textContent = "Tra cứu bị lỗi.";
    }
  }

  function rectAt(x, y) {
    return { x, y };
  }

  function rangeAt(x, y) {
    if (document.caretPositionFromPoint) {
      let pos;
      try { pos = document.caretPositionFromPoint(x, y, { shadowRoots: [shadow] }); }
      catch { pos = document.caretPositionFromPoint(x, y); }
      if (pos) { const range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); return range; }
    }
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    return null;
  }

  function pointInsideRange(range, x, y) {
    return [...range.getClientRects()].some((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  }

  function wordAt(x, y) {
    const range = rangeAt(x, y);
    const node = range?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent || "";
    const offset = range.startOffset;
    if (!text.trim()) return null;
    let charAt = Math.min(offset, Math.max(0, text.length - 1));
    if (!isJapaneseCharacter(text[charAt]) && charAt > 0 && isJapaneseCharacter(text[charAt - 1])) charAt--;
    if (!isJapaneseCharacter(text[charAt])) return null;
    const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;
    if (segmenter) {
      for (const part of segmenter.segment(text)) {
        if (charAt >= part.index && charAt <= part.index + part.segment.length && part.isWordLike) {
          if (node.getRootNode() === shadow && /\p{Script=Han}/u.test(text[charAt] ?? "")) {
            const kanjiRange = document.createRange();
            kanjiRange.setStart(node, charAt);
            kanjiRange.setEnd(node, charAt + 1);
            if (!pointInsideRange(kanjiRange, x, y)) return null;
            const kanjiRect = kanjiRange.getBoundingClientRect();
            return { text: text[charAt], scanText: text[charAt], x: kanjiRect.left, y: kanjiRect.bottom + 7, key: `${charAt}:${text[charAt]}` };
          }
          const r = document.createRange(); r.setStart(node, part.index); r.setEnd(node, part.index + part.segment.length);
          if (!pointInsideRange(r, x, y)) return null;
          const rect = r.getBoundingClientRect();
          const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(part.segment);
          return { text: part.segment, scanText: cjk ? text.slice(charAt, charAt + 32) : part.segment, x: rect.left, y: rect.bottom + 7, key: `${part.index}:${part.segment}` };
        }
      }
    }
    const prefixWord = text.slice(0, charAt + 1).match(/[\p{L}\p{N}\p{M}'’-]+$/u);
    const start = prefixWord ? charAt + 1 - prefixWord[0].length : charAt;
    let end = charAt;
    while (end < text.length && /[\p{L}\p{N}\p{M}'’-]/u.test(text[end])) end++;
    if (end <= start) return null;
    const r = document.createRange(); r.setStart(node, start); r.setEnd(node, end);
    if (!pointInsideRange(r, x, y)) return null;
    const rect = r.getBoundingClientRect();
    const token = text.slice(start, end);
    return { text: token, scanText: token, x: rect.left, y: rect.bottom + 7, key: `${start}:${token}` };
  }

  function onPopupClick(event) {
    if (!event.shiftKey) return;
    const path = event.composedPath();
    const layer = path.find((node) => node instanceof HTMLElement && node.classList?.contains("layer"));
    if (!layer) return;
    const selected = window.getSelection()?.toString().trim();
    if (selected && Date.now() - handledPopupSelectionAt < 700) return;
    const point = event.changedTouches?.[0] ?? event;
    const word = wordAt(point.clientX, point.clientY);
    if (word) lookup(word.scanText || word.text, point.clientX + 14, point.clientY + 22, stack.indexOf(layer));
  }

  document.addEventListener("mouseup", (event) => {
    if (settings.enabled === false) return;
    const layer = event.composedPath().find((node) => node instanceof HTMLElement && node.classList?.contains("layer"));
    if (layer) {
      setTimeout(() => {
        const query = window.getSelection()?.toString().trim();
        if (query && isJapaneseCharacter([...query][0])) {
          handledPopupSelectionAt = Date.now();
          selectedLookup(stack.indexOf(layer));
        }
      }, 0);
      return;
    }
    if (settings.selectionScan) setTimeout(() => {
      const query = window.getSelection()?.toString().trim() ?? "";
      if (query && query !== selectionAtPointerDown) selectedLookup();
    }, 0);
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (settings.enabled === false || settings.desktopShift === false) return;
    if (event.pointerType !== "mouse" || !event.shiftKey) return;
    if (moveFrame) return;
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      const word = wordAt(event.clientX, event.clientY);
      if (word && word.key !== lastHoverKey) {
        lastHoverKey = word.key;
        const layer = event.composedPath().find((node) => node instanceof HTMLElement && node.classList?.contains("layer"));
        lookup(word.scanText || word.text, event.clientX + 14, event.clientY + 22, layer ? stack.indexOf(layer) : -1);
      }
    });
  }, true);
  document.addEventListener("keydown", (event) => { if (event.key === "Shift") lastHoverKey = ""; }, true);
  document.addEventListener("keyup", (event) => { if (event.key === "Shift") lastHoverKey = ""; }, true);

  let touchStart = null;
  document.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, { capture: true, passive: true });
  document.addEventListener("touchend", (event) => {
    if (settings.enabled === false || settings.touchTap === false) return;
    const touch = event.changedTouches[0];
    const start = touchStart;
    touchStart = null;
    if (!start || Date.now() - start.time > 900 || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 18) return;
    if (host?.contains(event.target)) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      if (settings.selectionScan) selectedLookup();
      return;
    }
    const word = wordAt(touch.clientX, touch.clientY);
    if (word) lookup(word.scanText || word.text, touch.clientX + 14, touch.clientY + 22);
  }, { capture: true, passive: true });

  api.storage.local.get({ dokushoSettings: settings }).then((stored) => { settings = { ...settings, ...stored.dokushoSettings }; }).catch(() => {});
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.dokushoSettings) {
      settings = { ...settings, ...changes.dokushoSettings.newValue };
      if (settings.enabled === false) clear();
    }
  });
  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "GET_SELECTION") return Promise.resolve({ text: window.getSelection()?.toString().trim() ?? "" });
  });
})();
