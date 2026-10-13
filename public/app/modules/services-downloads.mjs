import { keyOf, kind } from "./core-model.mjs";
import { state } from "./core-state.mjs";
import { toast } from "./ui-dom.mjs";
import { getDetail } from "./services-details.mjs";
import { dbPut, dbGet, dbDelete } from "./storage-cache.mjs";

import { BASE } from "./core-config.mjs";
import { icon } from "./ui-icons.mjs";
const activeDownloads = new Set();
export const hasActiveDownloads = () => activeDownloads.size > 0;
export async function downloadItem(m) {
  if (!m) return;
  const k = keyOf(m);
  if (activeDownloads.has(k))
    return toast("Esta ficha se está guardando. Espera a que termine.");
  if (state.downloadMap.has(k))
    return toast("Esta ficha ya está guardada offline.");
  if (!navigator.onLine)
    return toast("Conéctate para descargar una ficha completa.");
  activeDownloads.add(k);
  const touched = [];
  toast("Preparando ficha e imágenes…");
  try {
    const d = await getDetail(kind(m), String(m.id));
    if (d._offline)
      throw Error(
        "No se pudo actualizar la ficha. Intenta descargarla con conexión.",
      );
    const imageKeys = [];
    if (d.poster_path)
      imageKeys.push("w342" + d.poster_path, "w185" + d.poster_path);
    if (d.backdrop_path) imageKeys.push("w780" + d.backdrop_path);
    for (const p of (d.credits?.cast || []).slice(0, 8))
      if (p.profile_path) imageKeys.push("w185" + p.profile_path);
    let bytes = new TextEncoder().encode(JSON.stringify(d)).byteLength,
      done = 0,
      contentDate = Date.parse(d._contentSavedAt) || Date.now();
    for (const ik of [...new Set(imageKeys)]) {
      let blob,
        imageDate = Date.now();
      try {
        const r = await fetch("https://image.tmdb.org/t/p/" + ik, {
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw Error("Imagen no disponible");
        blob = await r.blob();
      } catch {
        const bundled = state.seed.images[ik];
        if (!bundled)
          throw Error(
            "No se pudo guardar una imagen. La descarga no se ha completado.",
          );
        const r = await fetch(BASE + bundled);
        if (!r.ok) throw Error("No se pudo guardar la imagen incluida");
        blob = await r.blob();
        imageDate = Date.parse(state.seed.generatedAt);
      }
      contentDate = Math.min(contentDate, imageDate);
      if (!blob.type.startsWith("image/")) throw Error("Imagen no válida");
      if (!(await dbPut("pinnedImages", ik, blob, { savedAt: imageDate })))
        throw Error("No hay espacio para completar la descarga.");
      touched.push(ik);
      bytes += blob.size;
      done++;
      toast(`Guardando imágenes ${done}/${new Set(imageKeys).size}…`);
    }
    const pin = {
      item: { ...d, media_type: kind(m) },
      detail: d,
      images: [...new Set(imageKeys)],
      bytes,
      savedAt: new Date(contentDate).toISOString(),
      createdAt: new Date().toISOString(),
    };
    if (!(await dbPut("downloads", k, pin, { savedAt: contentDate })))
      throw Error("No hay espacio para guardar la ficha.");
    state.downloadMap.set(k, pin);
    document.querySelectorAll("[data-download]").forEach((b) => {
      if (b.dataset.download === k) b.innerHTML = icon("check");
    });
    toast("Ficha e imágenes disponibles sin conexión.");
    window.dispatchEvent(new Event("downloads-changed"));
  } catch (e) {
    for (const ik of touched)
      if (![...state.downloadMap.values()].some((d) => d.images.includes(ik)))
        await dbDelete("pinnedImages", ik);
    toast(e.message || "No se pudo completar la descarga.");
  } finally {
    activeDownloads.delete(k);
  }
}

export async function removeDownload(k) {
  const pin = state.downloadMap.get(k);
  if (!pin) return;
  await dbDelete("downloads", k);
  state.downloadMap.delete(k);
  for (const ik of pin.images || []) {
    if (![...state.downloadMap.values()].some((d) => d.images.includes(ik)))
      await dbDelete("pinnedImages", ik);
  }
  toast("Descarga eliminada. Tu lista se conserva.");
  window.dispatchEvent(new Event("downloads-changed"));
}
