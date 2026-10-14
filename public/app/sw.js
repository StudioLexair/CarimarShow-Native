const SHELL = "carimarshow-shell-v2.2.2",
  CONTENT = "carimarshow-content-v2.1.0",
  BASE = "/app/",
  MAX_AGE = 150 * 86400000;
const CORE = [
  "index.html",
  "styles.css",
  "settings.css",
  "personal.css",
  "startup.mjs",
  "app.js",
  "config.js",
  "manifest.webmanifest",
  "icons/logo.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "art/splash-city.jpg",
  "brand/carimarshow.jpeg",
  "brand/studiolexair.webp",
  "brand/tmdb.svg",
  "modules/core-config.mjs",
  "modules/core-genres.mjs",
  "modules/core-model.mjs",
  "modules/core-router.mjs",
  "modules/core-state.mjs",
  "modules/core-validation.mjs",
  "modules/services-api.mjs",
  "modules/services-details.mjs",
  "modules/services-downloads.mjs",
  "modules/services-fallback.mjs",
  "modules/services-library.mjs",
  "modules/services-orders.mjs",
  "modules/services-platform.mjs",
  "modules/storage-cache.mjs",
  "modules/storage-local.mjs",
  "modules/storage-policy.mjs",
  "modules/ui-components.mjs",
  "modules/ui-dom.mjs",
  "modules/ui-icons.mjs",
  "modules/ui-images.mjs",
  "modules/ui-orders.mjs",
  "modules/ui-sheet.mjs",
  "modules/views-catalog.mjs",
  "modules/views-detail.mjs",
  "modules/views-downloads.mjs",
  "modules/views-explore.mjs",
  "modules/views-home.mjs",
  "modules/views-list.mjs",
  "modules/views-person.mjs",
  "modules/views-profile.mjs",
  "modules/views-settings.mjs",
].map((p) => BASE + p);
const snapshot = BASE + "catalog-snapshot.json";
function valid(date) {
  const time = Date.parse(date);
  return (
    Number.isFinite(time) &&
    time <= Date.now() + 86400000 &&
    Date.now() - time < MAX_AGE
  );
}
async function freshContent(cache) {
  const r = await cache.match(snapshot);
  if (!r) return false;
  try {
    return valid((await r.json()).generatedAt);
  } catch {
    return false;
  }
}
async function purgeExpired() {
  const c = await caches.open(CONTENT);
  if (!(await freshContent(c))) {
    await caches.delete(CONTENT);
    return false;
  }
  return true;
}
self.addEventListener("install", (e) =>
  e.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(CORE);
      const r = await fetch(snapshot, { cache: "no-store" });
      if (!r.ok) throw Error("Snapshot unavailable");
      const seed = await r.clone().json();
      if (valid(seed.generatedAt)) {
        const c = await caches.open(CONTENT);
        await c.put(snapshot, r);
        await c.addAll(
          [...new Set(Object.values(seed.images || {}))].map((p) => BASE + p),
        );
      }
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys())
        if (k.startsWith("carimarshow-") && k !== SHELL && k !== CONTENT)
          await caches.delete(k);
      await purgeExpired();
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (e) => {
  if (e.data?.type === "PRUNE_CONTENT") e.waitUntil(purgeExpired());
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== location.origin ||
    !u.pathname.startsWith(BASE)
  )
    return;
  e.respondWith(
    (async () => {
      const shell = await caches.open(SHELL);
      if (e.request.mode === "navigate") {
        try {
          const r = await fetch(e.request);
          if (r.ok) return r;
        } catch {}
        return (await shell.match(BASE + "index.html")) || Response.error();
      }
      if (u.pathname === snapshot || u.pathname.startsWith(BASE + "posters/")) {
        const c = await caches.open(CONTENT);
        if (await freshContent(c)) {
          const saved = await c.match(e.request, { ignoreSearch: true });
          if (saved) return saved;
        } else await caches.delete(CONTENT);
        // No devolver físicamente archivos empaquetados vencidos desde la red/origen.
        if (u.pathname === snapshot)
          return new Response(
            JSON.stringify({
              catalog: [],
              details: {},
              people: {},
              images: {},
              responses: {},
              generatedAt: "",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        return new Response("", { status: 410 });
      }
      return (
        (await shell.match(e.request, { ignoreSearch: true })) ||
        fetch(e.request)
      );
    })(),
  );
});
