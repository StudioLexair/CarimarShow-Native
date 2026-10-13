export function validateResponse(path, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (path.startsWith("genre/")) return Array.isArray(data.genres);
  if (path.endsWith("/combined_credits"))
    return (
      data.id === Number(path.split("/")[1]) &&
      Array.isArray(data.cast) &&
      Array.isArray(data.crew)
    );
  if (path.endsWith("/videos"))
    return (
      data.id === Number(path.split("/")[1]) &&
      Array.isArray(data.results) &&
      data.results.every((v) => v && typeof v.key === "string")
    );
  if (
    /^(search|trending|discover)\//.test(path) ||
    /\/(popular|top_rated|now_playing|upcoming|on_the_air|similar|recommendations)$/.test(
      path,
    )
  )
    return (
      Array.isArray(data.results) &&
      data.results.every((m) => m && Number.isInteger(m.id))
    );
  if (data.videos && !Array.isArray(data.videos.results)) return false;
  if (data.credits && !Array.isArray(data.credits.cast)) return false;
  return (
    Number.isInteger(data.id) &&
    data.id === Number(path.split("/")[1]) &&
    typeof (data.title || data.name) === "string"
  );
}
