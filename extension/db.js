const DokushoDB = (() => {
  const DB_NAME = "dokusho-dictionaries";
  const STORE = "entries";
  let database;
  function open() {
    if (database) return database;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction;
        let store;
        if (event.oldVersion === 0) {
          store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("expressionKey", "expressionKey", { unique: false });
          store.createIndex("readingKey", "readingKey", { unique: false });
          store.createIndex("dictionary", "dictionary", { unique: false });
        } else {
          store = tx.objectStore(STORE);
          if (!store.indexNames.contains("expressionKey")) store.createIndex("expressionKey", "expressionKey", { unique: false });
          if (!store.indexNames.contains("readingKey")) store.createIndex("readingKey", "readingKey", { unique: false });
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            const value = item.value;
            value.expressionKey = String(value.expression ?? "").toLocaleLowerCase();
            value.readingKey = String(value.reading ?? "").toLocaleLowerCase();
            item.update(value);
            item.continue();
          };
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = null; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    }).then((db) => { database = Promise.resolve(db); return db; });
  }
  async function search(query, limit = 12) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const q = query.toLocaleLowerCase();
      const store = tx.objectStore(STORE);
      const found = [];
      const seen = new Set();
      const add = (entry) => { if (!seen.has(entry.id) && found.length < limit) { seen.add(entry.id); found.push(entry); } };
      const exactRequest = store.index("expressionKey").getAll(IDBKeyRange.only(q), limit);
      exactRequest.onsuccess = () => {
        exactRequest.result.forEach(add);
        collect("expressionKey", () => {
          if (found.length >= limit) { resolve(found); return; }
          collect("readingKey", () => resolve(found));
        });
      };
      exactRequest.onerror = () => reject(exactRequest.error);
      const collect = (indexName, done) => {
        const range = IDBKeyRange.bound(q, `${q}\uffff`, false, false);
        const request = store.index(indexName).openCursor(range);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || found.length >= limit) { done(); return; }
          add(cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
  async function replaceDictionary(dictionary, entries, onProgress = () => {}, batchSize = 500) {
    const db = await open();
    const existingCount = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).index("dictionary").count(IDBKeyRange.only(dictionary));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const totalWork = existingCount + entries.length;
    let removed = 0;
    while (removed < existingCount) {
      const tx = db.transaction(STORE, "readwrite");
      const cursorRequest = tx.objectStore(STORE).index("dictionary").openCursor(IDBKeyRange.only(dictionary));
      let batch = 0;
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || batch >= batchSize) return;
        cursor.delete();
        removed++;
        batch++;
        cursor.continue();
      };
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
      onProgress({ phase: "removing", done: removed, total: totalWork });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    let added = 0;
    while (added < entries.length) {
      const end = Math.min(added + batchSize, entries.length);
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (let index = added; index < end; index++) {
        const entry = entries[index];
        entry.expressionKey = entry.expression.toLocaleLowerCase();
        entry.readingKey = entry.reading.toLocaleLowerCase();
        store.put(entry);
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      added = end;
      onProgress({ phase: "saving", done: removed + added, total: totalWork });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  async function scan(text, limit = 12) {
    const db = await open();
    const characters = [...String(text ?? "").trim()];
    if (!characters.length) return [];
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("expressionKey");
    const requests = [];
    for (let length = Math.min(characters.length, 32); length > 0; length--) {
      const candidate = characters.slice(0, length).join("").toLocaleLowerCase();
      requests.push(new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(candidate), limit);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }));
    }
    const results = await Promise.all(requests);
    return results.find((matches) => matches.length) ?? [];
  }
  async function listDictionaries() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).index("dictionary").openKeyCursor();
      const names = new Set();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { names.add(cursor.key); cursor.continue(); }
        else resolve([...names]);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async function removeDictionary(name, onProgress = () => {}, batchSize = 500) {
    const db = await open();
    const total = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).index("dictionary").count(IDBKeyRange.only(name));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    let removed = 0;
    while (removed < total) {
      const tx = db.transaction(STORE, "readwrite");
      const cursorRequest = tx.objectStore(STORE).index("dictionary").openCursor(IDBKeyRange.only(name));
      let batch = 0;
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || batch >= batchSize) return;
        cursor.delete(); removed++; batch++; cursor.continue();
      };
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
      onProgress({ done: removed, total });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return { search, scan, replaceDictionary, listDictionaries, removeDictionary };
})();
