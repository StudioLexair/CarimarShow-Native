const ALLOWED_ORIGINS = new Set([
  "https://carimarshow.vercel.app",
  "https://appassets.androidplatform.net",
  "https://carimarshow.local",
  "http://localhost:8080",
  "http://localhost:8083",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8083",
]);
const ALLOWED_SIZES = new Set(["w185", "w342", "w500", "w780", "h632"]);
const IMAGE_PATH = /^\/[a-z0-9_-]{1,80}\.(?:jpe?g|png|webp)$/i;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function sendError(res, status, message) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status;
  res.end(JSON.stringify({ error: message }));
  return res;
}

async function readLimited(response) {
  if (!response.body?.getReader) {
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_IMAGE_BYTES) throw new RangeError("Imagen demasiado grande");
    return body;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new RangeError("Imagen demasiado grande");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function createHandler(fetchImpl = globalThis.fetch) {
  return async (req, res) => {
    res.setHeader("Vary", "Origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.headers?.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin))
      return sendError(res, 403, "Origen no permitido");
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
      res.setHeader("Cache-Control", "public, max-age=600");
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      return sendError(res, 405, "Método no permitido");
    }

    const size = req.query?.size;
    const imagePath = req.query?.path;
    if (
      typeof size !== "string" ||
      !ALLOWED_SIZES.has(size) ||
      typeof imagePath !== "string" ||
      imagePath.length > 100 ||
      !IMAGE_PATH.test(imagePath)
    )
      return sendError(res, 400, "Imagen no válida");

    const upstreamUrl = `https://image.tmdb.org/t/p/${size}${imagePath}`;
    let upstream;
    try {
      upstream = await fetchImpl(upstreamUrl, {
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      return sendError(
        res,
        error.name === "TimeoutError" || error.name === "AbortError" ? 504 : 502,
        "No se pudo obtener la imagen de TMDB",
      );
    }

    if (upstream.status === 404)
      return sendError(res, 404, "Imagen no encontrada en TMDB");
    if (!upstream.ok) return sendError(res, 502, "TMDB no pudo entregar la imagen");

    const contentType = (upstream.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!IMAGE_TYPES.has(contentType))
      return sendError(res, 502, "TMDB devolvió un archivo no válido");
    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES)
      return sendError(res, 413, "La imagen supera el tamaño permitido");

    let body;
    try {
      body = await readLimited(upstream);
    } catch {
      return sendError(res, 413, "La imagen supera el tamaño permitido");
    }
    if (!body.length) return sendError(res, 502, "TMDB devolvió una imagen vacía");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(body.length));
    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.statusCode = 200;
    return res.end(body);
  };
}

const handler = createHandler();
handler.createHandler = createHandler;
handler.readLimited = readLimited;
module.exports = handler;
