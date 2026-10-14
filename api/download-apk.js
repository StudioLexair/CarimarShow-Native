const RELEASE_APK_URL =
  "https://github.com/StudioLexair/CarimarShow-Native/releases/latest/download/CarimarShow-Android.apk";
const GITHUB_HOST = "github.com";
const ASSET_HOST = "release-assets.githubusercontent.com";
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_HOPS = 5;

function isAllowedHost(hostname) {
  return hostname === GITHUB_HOST || hostname === ASSET_HOST;
}

async function resolveAssetUrl(fetchImpl = globalThis.fetch) {
  let current = new URL(RELEASE_APK_URL);
  const signal = AbortSignal.timeout(8000);

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (current.protocol !== "https:" || !isAllowedHost(current.hostname))
      throw new Error("Redirect fuera de la lista permitida");

    const response = await fetchImpl(current.href, {
      method: "HEAD",
      redirect: "manual",
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "CarimarShow-APK-Download",
      },
      signal,
    });

    if (REDIRECTS.has(response.status)) {
      const location = response.headers?.get("location");
      if (!location) throw new Error("Redirección sin destino");
      current = new URL(location, current);
      continue;
    }

    if (!response.ok || current.hostname !== ASSET_HOST)
      throw new Error("El APK no está disponible en el CDN esperado");

    return current.href;
  }

  throw new Error("Demasiadas redirecciones al resolver el APK");
}

function createHandler(fetchImpl = globalThis.fetch) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      res.statusCode = 405;
      return res.end();
    }

    try {
      const assetUrl = await resolveAssetUrl(fetchImpl);
      res.setHeader("Location", assetUrl);
      res.statusCode = 302;
      return res.end();
    } catch {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.statusCode = 502;
      return res.end(
        "No se pudo iniciar la descarga. Inténtalo de nuevo o abre la página de versiones.",
      );
    }
  };
}

const handler = createHandler();
handler.createHandler = createHandler;
handler.resolveAssetUrl = resolveAssetUrl;
module.exports = handler;
