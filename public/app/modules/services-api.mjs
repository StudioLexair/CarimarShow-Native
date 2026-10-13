import { state } from "./core-state.mjs";
import { cacheRecord, dbPut, dbDelete } from "./storage-cache.mjs";
import { seedFallback, localSearch } from "./services-fallback.mjs";
import { validateResponse } from "./core-validation.mjs";
export class DataAccessError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "DataAccessError";
    this.status = status;
  }
}
const inflight = new Map();
async function request(path, params = {}) {
  const query = new URLSearchParams({ path, ...params });
  query.sort();
  const key = query.toString();
  let failure;
  if (navigator.onLine) {
    const ctl = new AbortController(),
      timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(
        `${window.CARIMAR_CONFIG.apiOrigin}/api/tmdb?${query}`,
        { signal: ctl.signal },
      );
      if (!r.ok)
        throw new DataAccessError(
          r.status === 429
            ? "Demasiadas consultas. Espera un momento y vuelve a intentar."
            : "No se pudo consultar el catálogo. Puedes reintentarlo.",
          r.status,
        );
      const d = await r.json();
      if (!validateResponse(path, d))
        throw new DataAccessError(
          "La fuente devolvió información incompleta. Intenta de nuevo.",
        );
      const time = new Date().toISOString();
      d._contentSavedAt = time;
      d._source = "network";
      if (d.results && !path.endsWith("/videos")) {
        const inferred = /^(movie|tv|person)\//.test(path)
          ? path.split("/")[0]
          : null;
        d.results = d.results.map((m) => ({
          ...m,
          media_type: m.media_type || inferred || undefined,
          _contentSavedAt: time,
          _source: "network",
        }));
      }
      if (d.cast) d.cast = d.cast.map((m) => ({ ...m, _contentSavedAt: time }));
      if (d.credits?.cast)
        d.credits.cast = d.credits.cast.map((m) => ({
          ...m,
          media_type: "person",
          _contentSavedAt: time,
        }));
      if (!(await dbPut("api", key, d)))
        window.dispatchEvent(
          new CustomEvent("cache-warning", {
            detail:
              "La consulta se obtuvo, pero no pudo guardarse en este dispositivo.",
          }),
        );
      return d;
    } catch (e) {
      failure = e;
    } finally {
      clearTimeout(timer);
    }
  }
  const cached = await cacheRecord("api", key);
  if (cached && validateResponse(path, cached.value))
    return {
      ...cached.value,
      _offline: true,
      _source: "cache",
      _sourceDate: new Date(cached.savedAt).toISOString(),
      _fallbackReason: failure?.status || "connection",
    };
  if (cached) await dbDelete("api", key);
  const fallback = path.startsWith("search/")
    ? await localSearch(path, params)
    : seedFallback(path, params);
  if (fallback) {
    const date =
      fallback._contentSavedAt ||
      fallback._sourceDate ||
      state.seed.generatedAt;
    return {
      ...fallback,
      ...(fallback.results && !path.endsWith("/videos")
        ? {
            results: fallback.results.map((m) => ({
              ...m,
              _contentSavedAt: m._contentSavedAt || date,
            })),
          }
        : {}),
      _contentSavedAt: date,
      _offline: true,
      _source: fallback._source || "included",
      _sourceDate: fallback._sourceDate || date,
      _fallbackReason: failure?.status || "connection",
    };
  }
  throw failure instanceof DataAccessError
    ? failure
    : new DataAccessError(
        "No hay conexión ni información local de esta consulta. Conéctate y vuelve a intentarlo.",
      );
}
export async function api(path, params = {}) {
  const k = path + JSON.stringify(params);
  if (inflight.has(k)) return inflight.get(k);
  const p = request(path, params);
  inflight.set(k, p);
  try {
    return await p;
  } finally {
    inflight.delete(k);
  }
}
