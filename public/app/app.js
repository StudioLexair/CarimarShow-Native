import { goBack } from "./modules/core-router.mjs";
import { validAge } from "./modules/storage-policy.mjs";
import { pruneCaches } from "./modules/storage-cache.mjs";
import { expirePersonalMetadata } from "./modules/services-library.mjs";
import { $, view, connection, toast, progress } from "./modules/ui-dom.mjs";
import { route } from "./modules/core-router.mjs";
import { closeSheet } from "./modules/ui-sheet.mjs";
import {
  saveItem,
  getItem,
  updateAvatar,
  remember,
} from "./modules/services-library.mjs";
import { itemMenu } from "./modules/views-list.mjs";
import {
  downloadItem,
  hasActiveDownloads,
} from "./modules/services-downloads.mjs";
import { share } from "./modules/services-platform.mjs";
import { state } from "./modules/core-state.mjs";
import { icons } from "./modules/ui-icons.mjs";
import { dbPromise, dbAll } from "./modules/storage-cache.mjs";
import { BASE } from "./modules/core-config.mjs";
import { keyOf } from "./modules/core-model.mjs";
$("#sheet").addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeSheet();
});

view.addEventListener("click", (e) => {
  const back = e.target.closest("[data-back]");
  if (back) {
    e.preventDefault();
    goBack(back.getAttribute("href"));
    return;
  }
  const save = e.target.closest("[data-save]");
  if (save) {
    saveItem(getItem(save.dataset.save));
    return;
  }
  const menu = e.target.closest("[data-menu]");
  if (menu) {
    itemMenu(getItem(menu.dataset.menu));
    return;
  }
  const dl = e.target.closest("[data-download]");
  if (dl) {
    downloadItem(getItem(dl.dataset.download));
    return;
  }
  const sh = e.target.closest("[data-share]");
  if (sh) {
    share(getItem(sh.dataset.share));
    return;
  }
  const sp = e.target.closest("[data-share-person]");
  if (sp) {
    share(null, sp.dataset.sharePerson);
    return;
  }
  if (e.target.closest("[data-retry]")) route();
});

window.addEventListener("hashchange", route);

window.addEventListener("online", () => {
  connection();
  document.querySelectorAll("[data-offline-note]").forEach((note) => {
    if (note.querySelector("[data-retry]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button";
    button.dataset.retry = "";
    button.textContent = "Reintentar ahora";
    note.append(" ", button);
  });
  toast("Conexión recuperada. Puedes actualizar la información local.");
});

window.addEventListener("offline", connection);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPrompt = e;
});

window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  toast("CarimarShow instalada");
});

window.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
    e.preventDefault();
    location.hash = "#explore";
  }
});

(async () => {
  icons();
  connection();
  updateAvatar();
  try {
    if (sessionStorage.getItem("cs_boot_v2")) $("#splash").hidden = true;
  } catch {}
  progress(15, "Abriendo el catálogo incluido…");
  try {
    const r = await fetch(BASE + "catalog-snapshot.json");
    if (r.ok) state.seed = await r.json();
  } catch {}
  expirePersonalMetadata();
  if (!validAge(state.seed.generatedAt)) {
    const generatedAt = state.seed.generatedAt;
    state.seed = {
      catalog: [],
      details: {},
      people: {},
      images: {},
      responses: {},
      generatedAt,
    };
    toast("El catálogo incluido necesita actualizarse con conexión.");
  }
  progress(45, "Recuperando tus datos locales…");
  await dbPromise;
  await pruneCaches();
  for (const d of await dbAll("downloads"))
    if (d?.item) state.downloadMap.set(keyOf(d.item), d);
  remember([...state.seed.catalog, ...state.list, ...state.history]);
  progress(65, "Consultando tus próximas historias…");
  await route();
  progress(100, "Todo listo.");
  $("#splash").hidden = true;
  try {
    sessionStorage.setItem("cs_boot_v2", "1");
  } catch {}
  if ("serviceWorker" in navigator && !window.CARIMAR_CONFIG.apiOrigin) {
    try {
      for (const r of await navigator.serviceWorker.getRegistrations())
        if (new URL(r.scope).pathname === "/") await r.unregister();
      await navigator.serviceWorker.register(BASE + "sw.js", {
        scope: BASE,
        updateViaCache: "none",
      });
    } catch {}
  }
})();

window.addEventListener("downloads-changed", () => {
  if (location.hash === "#downloads") route();
});
window.addEventListener("cache-warning", (e) => toast(e.detail));

async function maintainStorage() {
  if (hasActiveDownloads()) return;
  await pruneCaches();
  state.downloadMap.clear();
  for (const d of await dbAll("downloads"))
    if (d?.item) state.downloadMap.set(keyOf(d.item), d);
  expirePersonalMetadata();
  navigator.serviceWorker?.controller?.postMessage({ type: "PRUNE_CONTENT" });
}
setInterval(maintainStorage, 3600000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) maintainStorage();
});
