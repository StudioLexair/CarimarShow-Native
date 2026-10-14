// A new entry point can bypass shells installed before modular updates existed.
// Clear obsolete UI shells only: never IndexedDB, profile, selection or explicit downloads.
const version = document.documentElement.dataset.appVersion || "2.2.3";
window.CARIMAR_CONFIG = { ...window.CARIMAR_CONFIG, version };
if (!window.CARIMAR_CONFIG.apiOrigin) {
  try {
    if ("caches" in window)
      for (const name of await caches.keys())
        if (
          name.startsWith("carimarshow-shell-") &&
          name !== `carimarshow-shell-v${version}`
        )
          await caches.delete(name);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/app/sw.js", { scope: "/app/", updateViaCache: "none" })
        .catch(() => {});
  } catch {}
}
await import("./app.js?v=" + encodeURIComponent(version));
