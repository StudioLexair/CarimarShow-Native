// TMDB has different taxonomies for movies and TV. Map only official counterparts.
const TV_EQUIVALENTS = {
  28: 10759,
  12: 10759,
  878: 10765,
  14: 10765,
  10752: 10768,
};
const TV_LABELS = {
  10762: "Infantil",
  10763: "Noticias",
  10764: "Reality",
  10766: "Telenovela",
  10767: "Entrevistas",
  10768: "Guerra y política",
};
const PRIORITY = [28, 12, 35, 18, 27, 878, 10749, 14, 16, 80, 9648, 99, 10751];
export function mergeGenres(movieGenres = [], tvGenres = []) {
  const tv = new Map(tvGenres.map((g) => [g.id, g])),
    used = new Set();
  const groups = movieGenres.map((g) => {
    const tvId = TV_EQUIVALENTS[g.id] || g.id,
      match = tv.get(tvId);
    if (match) used.add(tvId);
    return {
      id: g.id,
      name: g.name,
      movieIds: [g.id],
      tvIds: match ? [tvId] : [],
      tvName: match?.name || "",
    };
  });
  for (const g of tvGenres)
    if (!used.has(g.id))
      groups.push({
        id: g.id,
        name: TV_LABELS[g.id] || g.name,
        movieIds: [],
        tvIds: [g.id],
        tvName: g.name,
      });
  return groups.sort((a, b) => {
    const x = PRIORITY.indexOf(a.id),
      y = PRIORITY.indexOf(b.id);
    return (
      (x < 0 ? 100 : x) - (y < 0 ? 100 : y) ||
      a.name.localeCompare(b.name, "es")
    );
  });
}
export function genreSupports(group, type) {
  return type === "all"
    ? !!(group.movieIds.length || group.tvIds.length)
    : type === "movie"
      ? !!group.movieIds.length
      : type === "tv"
        ? !!group.tvIds.length
        : false;
}
export function interleaveTitles(movies = [], series = []) {
  const result = [];
  for (let i = 0; i < Math.max(movies.length, series.length); i++) {
    if (movies[i]) result.push({ ...movies[i], media_type: "movie" });
    if (series[i]) result.push({ ...series[i], media_type: "tv" });
  }
  return result;
}
