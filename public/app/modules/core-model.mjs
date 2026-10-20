export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const title = (m) =>
  m.title ||
  m.name ||
  (m._contentExpired ? "Título guardado · por actualizar" : "Sin título");

export const kind = (m) =>
  m.media_type === "person" || m.known_for_department
    ? "person"
    : m.media_type === "tv" || m.first_air_date
      ? "tv"
      : "movie";

export const keyOf = (m) => `${kind(m)}:${m.id}`;

export const year = (m) =>
  (m.release_date || m.first_air_date || "").slice(0, 4) || "—";

export const rating = (m) => Number(m.vote_average || 0).toFixed(1);

export function youtube(v) {
  return !!v && v.site === "YouTube" && /^[A-Za-z0-9_-]{11}$/.test(v.key);
}

export function trailerList(d) {
  return (d.videos?.results || [])
    .filter((v) => youtube(v) && v.type === "Trailer")
    .sort((a, b) => (b.type === "Trailer") - (a.type === "Trailer"));
}

export function duration(d) {
  const n = Number(d.runtime || d.episode_run_time?.[0] || 0);
  return n
    ? `${Math.floor(n / 60) ? Math.floor(n / 60) + "h " : ""}${n % 60}min`
    : d.number_of_seasons
      ? `${d.number_of_seasons} temporadas`
      : "Duración no informada";
}

const NON_FILMOGRAPHY_GENRES = new Set([99, 10763, 10764, 10767]);

function isNonFictionRole(value, personName) {
  const normalize = (text) =>
      String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase(),
    role = normalize(value),
    name = normalize(personName),
    selfAppearance = /^(?:as\s+)?(?:self|himself|herself|themselves)(?:$|\s*(?:\(|\[|[-,:/.])|\s+(?:archive|in|at|voice|on|as|uncredited)\b)/.test(
      role,
    ),
    localizedSelf = /^(?:el mismo|ella misma|ellos mismos|ellas mismas)(?:$|\s*(?:\(|\[|[-,:/.])|\s+(?:archivo|en|como|voz)\b)/.test(
      role,
    ),
    guestAppearance = /^(?:guest|host|presenter)(?:$|\s+(?:host|star|of|on|at|appearance|interview)\b)/.test(
      role,
    ),
    appearanceLabel = /\b(?:special\s+)?guest\s+star\b|\b(?:special\s+)?appearance(?:\s+by)?\b|\bcameo\b/.test(
      role,
    );
  return (
    selfAppearance ||
    localizedSelf ||
    guestAppearance ||
    appearanceLabel ||
    (!!name && role === name)
  );
}

export const personCreditRole = (credit) =>
  String(credit?.character || credit?.job || "").trim();

// Keep the profile preview and "Ver todo" on the same filtered credits.
// Actors use cast roles, excluding documentaries and non-fiction programmes,
// including self/host appearances when TMDB omitted genre_ids; other staff use
// only crew credits from their TMDB department.
export function personFilmography(person, credits) {
  const department = String(person?.known_for_department || ""),
    isActing = !department || department === "Acting",
    source = isActing
      ? credits?.cast || []
      : credits?.crew || [],
    seen = new Set(),
    rows = [];
  for (const credit of source) {
    if (
      !credit ||
      !Number.isInteger(credit.id) ||
      credit.id <= 0 ||
      credit.adult ||
      !(credit.title || credit.name)
    )
      continue;
    const mediaType =
      credit.media_type === "movie" || credit.media_type === "tv"
        ? credit.media_type
        : credit.first_air_date
          ? "tv"
          : credit.release_date
            ? "movie"
            : "";
    if (!mediaType) continue;
    if (
      !isActing &&
      credit.department !== department
    )
      continue;
    if (
      isActing &&
      ((credit.genre_ids || []).some((id) => NON_FILMOGRAPHY_GENRES.has(Number(id))) ||
        isNonFictionRole(credit.character, person?.name))
    )
      continue;
    const key = `${mediaType}:${credit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...credit, media_type: mediaType });
  }
  const dateOf = (credit) => {
    const date = Date.parse(credit.release_date || credit.first_air_date || "");
    return Number.isFinite(date) ? date : Number.NEGATIVE_INFINITY;
  };
  return rows.sort(
    (a, b) =>
      dateOf(b) - dateOf(a) ||
      (Number(b.popularity) || 0) - (Number(a.popularity) || 0) ||
      String(a.title || a.name).localeCompare(String(b.title || b.name), "es"),
  );
}

export function statusName(s) {
  return (
    {
      Released: "Estrenada",
      "Post Production": "Posproducción",
      "In Production": "En producción",
      Planned: "Planificada",
      Rumored: "Por confirmar",
      "Returning Series": "En emisión",
      Ended: "Finalizada",
      Canceled: "Cancelada",
    }[s] ||
    s ||
    "No informado"
  );
}

// Movement is scoped to the visible movie/TV group, not an adjacent hidden item.
export function moveWithinType(items, key, direction) {
  const index = items.findIndex((item) => keyOf(item) === key);
  if (index < 0 || ![-1, 1].includes(direction)) return items;
  const type = kind(items[index]);
  let target = index + direction;
  while (target >= 0 && target < items.length && kind(items[target]) !== type)
    target += direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function sortSelection(items, mode = "manual") {
  if (mode === "title")
    return [...items].sort((a, b) =>
      title(a).localeCompare(title(b), "es", { sensitivity: "base" }),
    );
  if (mode === "year")
    return [...items].sort((a, b) =>
      (b.release_date || b.first_air_date || "").localeCompare(
        a.release_date || a.first_air_date || "",
      ),
    );
  return [...items];
}

const MOVIE_LIST_STATUSES = Object.freeze(["Pendiente", "Vista"]),
  TV_LIST_STATUSES = Object.freeze(["Pendiente", "En emisión", "Terminada"]);

export function listStatusOptions(item) {
  const mediaType = typeof item === "string" ? item : kind(item);
  return mediaType === "tv" ? TV_LIST_STATUSES : MOVIE_LIST_STATUSES;
}

export function normalizeListStatus(item, status) {
  const options = listStatusOptions(item);
  return options.includes(status) ? status : "Pendiente";
}
