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
