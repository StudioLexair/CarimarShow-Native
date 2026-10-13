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
