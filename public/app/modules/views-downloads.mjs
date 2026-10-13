import { setView, head, titleRows, empty } from "./ui-components.mjs";
import { state } from "./core-state.mjs";
export function downloadsPage() {
  setView(
    `${head("Descargas offline", "#profile")}<div class="notice">Se guardan fichas e imágenes, no películas ni capítulos. El catálogo incluido en el instalador permanece disponible por separado.</div>${
      state.downloadMap.size
        ? titleRows(
            [...state.downloadMap.values()].map((d) => d.item),
            true,
          )
        : empty(
            "Todavía no has descargado fichas",
            "Abre un título y toca el icono de descarga para guardar su ficha e imágenes.",
            "download",
          )
    }<p class="muted tiny" style="margin-top:18px">${state.seed.catalog.length} títulos y ${Object.keys(state.seed.images || {}).length} imágenes también vienen incluidos en esta versión.</p>`,
  );
}
