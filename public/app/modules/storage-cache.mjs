import { toast } from "./ui-dom.mjs";
import {
  record,
  expired,
  LIMITS,
  evictions,
  MAX_CONTENT_AGE,
  EXPLICIT_LIMITS,
} from "./storage-policy.mjs";
export const dbPromise = new Promise((resolve) => {
  if (!globalThis.indexedDB) return resolve(null);
  const req = indexedDB.open("carimarshow-offline", 3);
  req.onupgradeneeded = () => {
    const db = req.result,
      tx = req.transaction;
    for (const name of ["api", "images", "downloads", "pinnedImages"])
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    for (const name of ["api", "images"]) {
      const c = tx.objectStore(name).openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur) return;
        if (!cur.value?.wrapped) cur.delete();
        cur.continue();
      };
    }
    const dates = new Map(),
      cursor = tx.objectStore("downloads").openCursor();
    cursor.onsuccess = () => {
      const cur = cursor.result;
      if (cur) {
        const old = cur.value;
        if (!old?.wrapped) {
          const when = Date.parse(old.savedAt);
          if (!Number.isFinite(when) || Date.now() - when >= MAX_CONTENT_AGE)
            cur.delete();
          else {
            cur.update(record(old, "downloads", when));
            for (const key of old.images || [])
              dates.set(key, Math.min(dates.get(key) || when, when));
          }
        }
        cur.continue();
        return;
      }
      const pins = tx.objectStore("pinnedImages").openCursor();
      pins.onsuccess = () => {
        const c = pins.result;
        if (!c) return;
        if (!c.value?.wrapped) {
          if (dates.has(c.key))
            c.update(record(c.value, "pinnedImages", dates.get(c.key)));
          else c.delete();
        }
        c.continue();
      };
    };
  };
  req.onsuccess = () => {
    req.result.onversionchange = () => req.result.close();
    resolve(req.result);
  };
  req.onblocked = () => {
    toast(
      "Cierra otras pestañas antiguas y vuelve a abrir CarimarShow para actualizar el almacenamiento.",
    );
    resolve(null);
  };
  req.onerror = () => resolve(null);
});
async function transaction(store, mode, operation) {
  const db = await dbPromise;
  if (!db) return { ok: false };
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, mode);
      let value;
      operation(tx.objectStore(store), (v) => (value = v));
      tx.oncomplete = () => resolve({ ok: true, value });
      tx.onerror = tx.onabort = () => resolve({ ok: false });
    } catch {
      return resolve({ ok: false });
    }
  });
}
export async function cacheRecord(store, key) {
  const r = await transaction(store, "readwrite", (s, set) => {
    const get = s.get(key);
    get.onsuccess = () => {
      const item = get.result;
      if (expired(item)) {
        if (item) s.delete(key);
        set(null);
      } else {
        item.accessedAt = Date.now();
        s.put(item, key);
        set(item);
      }
    };
  });
  return r.value || null;
}
export async function dbGet(store, key) {
  return (await cacheRecord(store, key))?.value ?? null;
}
export async function dbEntries(store) {
  const r = await transaction(store, "readwrite", (s, set) => {
    const found = [];
    const c = s.openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) {
        set(found);
        return;
      }
      if (expired(cur.value)) cur.delete();
      else found.push({ key: cur.key, ...cur.value });
      cur.continue();
    };
  });
  return r.value || [];
}
export async function dbAll(store) {
  return (await dbEntries(store)).map((r) => r.value);
}
export async function dbPut(store, key, value, options = {}) {
  const r = record(value, store, options.savedAt ?? Date.now());
  r.accessedAt = Date.now();
  if (
    !Number.isFinite(r.savedAt) ||
    r.savedAt > Date.now() + 86400000 ||
    expired(r)
  )
    return false;
  if (LIMITS[store] && r.bytes > LIMITS[store].bytes) return false;
  const out = await transaction(store, "readwrite", (s) => {
    s.put(r, key);
    if (!LIMITS[store] && !EXPLICIT_LIMITS[store]) return;
    const rows = [],
      cursor = s.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) {
        if (EXPLICIT_LIMITS[store]) {
          const max = EXPLICIT_LIMITS[store];
          if (
            rows.length > max.count ||
            rows.reduce((n, r) => n + r.bytes, 0) > max.bytes
          )
            s.transaction.abort();
        } else for (const k of evictions(rows, LIMITS[store])) s.delete(k);
        return;
      }
      if (expired(c.value)) c.delete();
      else rows.push({ key: c.key, ...c.value });
      c.continue();
    };
  });
  return out.ok;
}
export async function dbClear(store) {
  return (await transaction(store, "readwrite", (s) => s.clear())).ok;
}
export async function dbDelete(store, key) {
  return (await transaction(store, "readwrite", (s) => s.delete(key))).ok;
}
export async function cacheStats() {
  const result = {};
  for (const name of ["api", "images", "downloads", "pinnedImages"]) {
    const entries = await dbEntries(name);
    result[name] = {
      count: entries.length,
      bytes: entries.reduce((sum, r) => sum + r.bytes, 0),
      entries,
    };
  }
  return result;
}
export async function pruneCaches() {
  for (const name of ["api", "images", "downloads", "pinnedImages"])
    await dbEntries(name);
  const used = new Set(
    (await dbAll("downloads")).flatMap((d) => d.images || []),
  );
  for (const r of await dbEntries("pinnedImages"))
    if (!used.has(r.key)) await dbDelete("pinnedImages", r.key);
}
