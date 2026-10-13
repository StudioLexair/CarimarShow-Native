// Únicamente este servidor conoce la credencial. CORS no es autenticación.
const {
  validateQuery,
  limiter,
  validPayload,
} = require("../lib/tmdb-policy.cjs");
const allow = limiter();
const ORIGINS = new Set([
  "https://carimarshow.vercel.app",
  "https://carimarshow-native.vercel.app",
  "https://appassets.androidplatform.net",
  "https://carimarshow.local",
]);
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin;
  if (origin && !ORIGINS.has(origin))
    return res.status(403).json({ error: "Origen no permitido" });
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Método no permitido" });
  }
  let input;
  try {
    input = validateQuery(req.query);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const ip = String(
    req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "unknown",
  )
    .split(",")[0]
    .slice(0, 80);
  const limit = allow(ip);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res
      .status(429)
      .json({ error: "Demasiadas consultas. Vuelve a intentar en un minuto." });
  }
  if (!process.env.TMDB_READ_TOKEN)
    return res.status(503).json({ error: "TMDB no configurado" });
  try {
    const upstream = await fetch(
      `https://api.themoviedb.org/3/${input.path}?${input.params}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(7000),
        redirect: "error",
      },
    );
    if (!upstream.ok) {
      const status =
        upstream.status === 429 ? 429 : upstream.status === 404 ? 404 : 502;
      if (status === 429) res.setHeader("Retry-After", "60");
      return res
        .status(status)
        .json({
          error:
            status === 404
              ? "No se encontró esta ficha en TMDB"
              : "TMDB no disponible. Intenta más tarde.",
        });
    }
    if (!upstream.headers.get("content-type")?.includes("application/json"))
      throw Error("Respuesta inválida");
    const text = await upstream.text();
    if (Buffer.byteLength(text) > 4 * 1024 * 1024)
      throw Error("Respuesta demasiado grande");
    const data = JSON.parse(text);
    if (!validPayload(input.path, data)) throw Error("Respuesta incompleta");
    return res.status(200).json(data);
  } catch (e) {
    return res
      .status(e.name === "TimeoutError" || e.name === "AbortError" ? 504 : 502)
      .json({ error: "No se pudo conectar con TMDB. Intenta de nuevo." });
  }
};
