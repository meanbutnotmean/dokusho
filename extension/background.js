importScripts("db.js");

const api = globalThis.browser ?? globalThis.chrome;
async function prioritize(results, limit) {
  const { dictionaryOrder = [] } = await api.storage.local.get({ dictionaryOrder: [] });
  const rank = new Map(dictionaryOrder.map((name, index) => [name, index]));
  return results.sort((a, b) => (rank.get(a.dictionary) ?? 1e9) - (rank.get(b.dictionary) ?? 1e9)).slice(0, limit);
}
api.runtime.onMessage.addListener((message) => {
  if (message?.type === "LOOKUP") {
    const limit = Math.min(Number(message.limit) || 12, 30);
    return DokushoDB.search(String(message.query ?? ""), 100).then((results) => prioritize(results, limit)).then((results) => ({ results }));
  }
  if (message?.type === "SCAN") {
    const limit = Math.min(Number(message.limit) || 12, 30);
    return DokushoDB.scan(String(message.text ?? ""), 100).then((results) => prioritize(results, limit)).then((results) => ({ results }));
  }
});
