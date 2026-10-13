export const DAY = 86400000;
// 150 días: margen conservador por debajo de seis meses naturales.
export const MAX_CONTENT_AGE = 150 * DAY;
export const AUTO_CACHE_AGE = 30 * DAY;
export const LIMITS = {
  api: { count: 250, bytes: 12 * 1024 * 1024 },
  images: { count: 100, bytes: 30 * 1024 * 1024 },
};
export const EXPLICIT_LIMITS = {
  downloads: { count: 100, bytes: 8 * 1024 * 1024 },
  pinnedImages: { count: 400, bytes: 80 * 1024 * 1024 },
};
export function validAge(date, max = MAX_CONTENT_AGE, now = Date.now()) {
  const t = typeof date === "number" ? date : Date.parse(date);
  return Number.isFinite(t) && t <= now + DAY && now - t < max;
}
export function logicalBytes(value) {
  return value instanceof Blob
    ? value.size
    : new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
export function record(value, store, now = Date.now()) {
  return {
    wrapped: 1,
    value,
    savedAt: now,
    accessedAt: now,
    expiresAt: now + (LIMITS[store] ? AUTO_CACHE_AGE : MAX_CONTENT_AGE),
    bytes: logicalBytes(value),
  };
}
export function expired(r, now = Date.now()) {
  return !r?.wrapped || !Number.isFinite(r.expiresAt) || now >= r.expiresAt;
}
export function evictions(entries, limit) {
  let bytes = entries.reduce((n, e) => n + e.bytes, 0),
    count = entries.length;
  const removed = [];
  for (const e of [...entries].sort((a, b) => a.accessedAt - b.accessedAt)) {
    if (count <= limit.count && bytes <= limit.bytes) break;
    removed.push(e.key);
    bytes -= e.bytes;
    count--;
  }
  return removed;
}
