const ALLOWED =
  /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|top_rated|now_playing|upcoming|[1-9]\d{0,9}(\/(similar|recommendations|videos))?)|tv\/(popular|top_rated|on_the_air|[1-9]\d{0,9}(\/(similar|recommendations|videos))?)|search\/(multi|movie|tv|person)|person\/(popular|[1-9]\d{0,9}(\/combined_credits)?)|genre\/(movie|tv)\/list|discover\/(movie|tv))$/;
const KEYS = new Set([
  "path",
  "language",
  "query",
  "page",
  "append_to_response",
  "with_genres",
]);
function validateQuery(query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (!KEYS.has(key) || typeof value !== "string")
      throw Error("Parámetro no permitido");
  }
  const path = query.path || "";
  if (!ALLOWED.test(path)) throw Error("Consulta no permitida");
  const params = new URLSearchParams({
    language: "es-ES",
    include_adult: "false",
    include_video_language: "es,en,null",
  });
  if (query.language !== undefined) {
    if (!["es-ES", "en-US"].includes(query.language))
      throw Error("Idioma no permitido");
    params.set("language", query.language);
  }
  if (query.query !== undefined) {
    const text = query.query.trim().normalize("NFC");
    if (
      !path.startsWith("search/") ||
      !text ||
      text.length > 200 ||
      /[\x00-\x1f\x7f]/.test(text)
    )
      throw Error("Búsqueda no válida");
    params.set("query", text);
  } else if (path.startsWith("search/"))
    throw Error("Falta el texto de búsqueda");
  if (query.page !== undefined) {
    if (!/^[1-9]\d{0,2}$/.test(query.page) || Number(query.page) > 500)
      throw Error("Página inválida");
    params.set("page", query.page);
  }
  if (query.with_genres !== undefined) {
    if (
      !path.startsWith("discover/") ||
      !/^[1-9]\d{0,5}(,[1-9]\d{0,5}){0,9}$/.test(query.with_genres)
    )
      throw Error("Género inválido");
    params.set("with_genres", query.with_genres);
  }
  if (query.append_to_response !== undefined) {
    if (
      !/^(movie|tv)\/[1-9]\d*$/.test(path) ||
      !["credits,videos", "videos,credits"].includes(query.append_to_response)
    )
      throw Error("Expansión no permitida");
    params.set("append_to_response", query.append_to_response);
  }
  return { path, params };
}
// Defensa adicional por instancia. El límite distribuido corresponde al WAF, no a este Map.
function limiter({ limit = 120, windowMs = 60000, maxKeys = 10000 } = {}) {
  const buckets = new Map();
  return (key, now = Date.now()) => {
    for (const [id, bucket] of buckets)
      if (now >= bucket.reset) buckets.delete(id);
    if (!buckets.has(key)) {
      if (buckets.size >= maxKeys) return { allowed: false, retryAfter: 60 };
      buckets.set(key, { count: 0, reset: now + windowMs });
    }
    const bucket = buckets.get(key);
    bucket.count++;
    return {
      allowed: bucket.count <= limit,
      retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)),
    };
  };
}
function validPayload(path, data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.success === false
  )
    return false;
  if (path.endsWith("/combined_credits"))
    return (
      data.id === Number(path.split("/")[1]) &&
      Array.isArray(data.cast) &&
      Array.isArray(data.crew)
    );
  if (/^genre\//.test(path)) return Array.isArray(data.genres);
  if (/^(movie|tv|person)\/[1-9]\d*$/.test(path))
    return (
      Number.isInteger(data.id) &&
      data.id === Number(path.split("/")[1]) &&
      typeof (data.title || data.name) === "string"
    );
  if (path.endsWith("/videos"))
    return (
      data.id === Number(path.split("/")[1]) && Array.isArray(data.results)
    );
  return Array.isArray(data.results);
}
module.exports = { validateQuery, limiter, validPayload };
