import { dbEntries } from "./storage-cache.mjs";
import { validAge } from "./storage-policy.mjs";
import { state } from "./core-state.mjs";
import { title, kind } from "./core-model.mjs";
export function genres(type = null) {
  const all = new Map();
  for (const [path, d] of Object.entries(state.seed.details).filter(
    ([path]) => !type || path.startsWith(type + "/"),
  ))
    for (const g of d.genres || []) all.set(g.id, g);
  return [...all.values()];
}

export function seedFallback(path, params) {
  const pin = state.downloadMap.get(path.replace("/", ":"));
  if (pin && validAge(pin.savedAt))
    return { ...pin.detail, _source: "download", _sourceDate: pin.savedAt };
  if (/^person\/\d+$/.test(path)) {
    const person = state.follows.find(
      (p) => p.id === Number(path.split("/")[1]),
    );
    if (person && !person._contentExpired)
      return {
        ...person,
        _source: "followed",
        _sourceDate: person._contentSavedAt,
      };
  }
  if (state.seed.details[path]) return state.seed.details[path];
  if (state.seed.people[path]) return state.seed.people[path];
  if (/^genre\//.test(path))
    return (
      state.seed.responses?.[path] ||
      (genres(path.split("/")[1]).length
        ? { genres: genres(path.split("/")[1]) }
        : null)
    );
  if (/\/videos$/.test(path)) {
    const d = state.seed.details[path.replace("/videos", "")];
    return d?.videos || null;
  }
  if (/^search\//.test(path)) {
    const q = (params.query || "").toLocaleLowerCase("es"),
      type = path.split("/")[1];
    let found = state.seed.catalog.filter((m) =>
      title(m).toLocaleLowerCase("es").includes(q),
    );
    if (type === "movie" || type === "tv")
      found = found.filter((m) => kind(m) === type);
    const people = Object.values(state.seed.people)
      .filter(
        (p) => p.id && p.name && p.name.toLocaleLowerCase("es").includes(q),
      )
      .map((p) => ({ ...p, media_type: "person" }));
    return {
      results:
        type === "person"
          ? people
          : type === "multi"
            ? [...found, ...people]
            : found,
      total_pages: 1,
    };
  }
  if (path === "person/popular")
    return {
      results: Object.values(state.seed.people)
        .filter((p) => p.name && p.id)
        .map((p) => ({ ...p, media_type: "person" })),
      total_pages: 1,
    };
  if (/^discover\//.test(path)) {
    if (!state.seed.catalog.length) return null;
    const type = path.split("/")[1],
      wanted = Number(params.with_genres);
    return {
      results: state.seed.catalog.filter(
        (m) =>
          kind(m) === type &&
          ((m.genre_ids || []).includes(wanted) ||
            (state.seed.details[`${type}/${m.id}`]?.genres || []).some(
              (g) => g.id === wanted,
            )),
      ),
      total_pages: 1,
    };
  }
  if (/\/(similar|recommendations)$/.test(path)) return null;
  if (state.seed.responses?.[path] && Number(params.page || 1) === 1)
    return state.seed.responses[path];
  if (/^(trending|movie\/|tv\/)/.test(path) && !/^\w+\/\d+$/.test(path)) {
    if (!state.seed.catalog.length) return null;
    if (Number(params.page || 1) > 1) return { results: [], total_pages: 1 };
    const type = path.startsWith("movie/")
      ? "movie"
      : path.startsWith("tv/")
        ? "tv"
        : null;
    return {
      results: state.seed.catalog.filter((m) => !type || kind(m) === type),
      total_pages: 1,
    };
  }
  return null;
}

export async function localSearch(path, params) {
  const query = (params.query || "").trim().toLocaleLowerCase("es"),
    type = path.split("/")[1],
    seen = new Set();
  const cached = (await dbEntries("api"))
    .flatMap((r) => {
      const d = r.value,
        path = new URLSearchParams(r.key).get("path") || "",
        t = /^(movie|tv|person)\//.test(path) ? path.split("/")[0] : null;
      if (!d || typeof d !== "object") return [];
      return (
        Array.isArray(d.results)
          ? d.results
          : Array.isArray(d.cast)
            ? d.cast
            : [d]
      )
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          ...m,
          media_type:
            m.media_type ||
            (path.endsWith("combined_credits") ? null : t) ||
            undefined,
        }));
    })
    .filter((m) => m?.id && (m.title || m.name));
  const people = Object.values(state.seed.people)
    .filter((p) => p.id && p.name)
    .map((p) => ({ ...p, media_type: "person" }));
  const pool = [
    ...state.seed.catalog,
    ...state.list,
    ...state.history,
    ...state.follows.map((p) => ({ ...p, media_type: "person" })),
    ...people,
    ...[...state.downloadMap.values()].map((d) => d.item),
    ...cached,
  ];
  const results = pool
    .filter((m) => {
      const t =
        m.media_type === "person" || m.known_for_department
          ? "person"
          : kind(m);
      const k = t + ":" + m.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return (
        !m._contentExpired &&
        (type === "multi" || type === t) &&
        (m.title || m.name || "").toLocaleLowerCase("es").includes(query)
      );
    })
    .map((m) => ({
      ...m,
      media_type:
        m.media_type === "person" || m.known_for_department
          ? "person"
          : kind(m),
    }));
  return { results, total_pages: 1, _source: "local-search" };
}
