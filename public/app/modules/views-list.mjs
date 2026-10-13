import { shareOrder } from "./ui-orders.mjs";
import { setView, head, titleRows, empty } from "./ui-components.mjs";
import { state } from "./core-state.mjs";
import { $ } from "./ui-dom.mjs";
import { hydrate } from "./ui-images.mjs";
import { kind, keyOf, esc, title } from "./core-model.mjs";
import { sheet, closeSheet } from "./ui-sheet.mjs";
import { icon } from "./ui-icons.mjs";
import { saveItem, reorderList } from "./services-library.mjs";
import { removeDownload, downloadItem } from "./services-downloads.mjs";
import { share } from "./services-platform.mjs";
export function listPage() {
  setView(
    `${head("Mi Lista")}<div class="list-order-actions"><button class="primary" id="shareOrder" ${state.list.length ? "" : "disabled"}>Compartir mi lista</button><small>${state.list.length} títulos en la selección completa</small></div><label class="list-sort">Organizar <select id="listSort"><option value="manual">Mi orden</option><option value="title">Título A–Z</option><option value="year">Año más reciente</option></select></label><div class="segmented"><button data-list-tab="movie" class="${state.listTab === "movie" ? "active" : ""}">Películas</button><button data-list-tab="tv" class="${state.listTab === "tv" ? "active" : ""}">Series</button></div><div id="listContent"></div>`,
  );
  $("#shareOrder").onclick = shareOrder;
  function show(t) {
    state.listTab = t;
    document
      .querySelectorAll("[data-list-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.listTab === t));
    let items = state.list.filter((m) => kind(m) === t);
    const sorting = localStorage.getItem("cs_list_sort_v1") || "manual";
    $("#listSort").value = sorting;
    if (sorting === "title")
      items = [...items].sort((a, b) => title(a).localeCompare(title(b), "es"));
    if (sorting === "year")
      items = [...items].sort((a, b) =>
        (b.release_date || b.first_air_date || "").localeCompare(
          a.release_date || a.first_air_date || "",
        ),
      );
    $("#listContent").innerHTML = items.length
      ? titleRows(items)
      : empty(
          t === "movie" ? "Aún no hay películas" : "Aún no hay series",
          "Añade títulos con el botón +. Tu lista se guarda en este dispositivo.",
        );
    hydrate();
  }
  document
    .querySelectorAll("[data-list-tab]")
    .forEach((b) => (b.onclick = () => show(b.dataset.listTab)));
  $("#listSort").onchange = () => {
    localStorage.setItem("cs_list_sort_v1", $("#listSort").value);
    show(state.listTab);
  };
  show(state.listTab);
}

export function itemMenu(m) {
  if (!m) return;
  const k = keyOf(m),
    saved = state.list.some((x) => keyOf(x) === k),
    pin = state.downloadMap.has(k);
  sheet(
    `<h2>${esc(title(m))}</h2><button class="menu-row" id="menuSave">${icon(saved ? "trash" : "bookmark")}<span>${saved ? "Quitar de Mi lista" : "Añadir a Mi lista"}</span></button>${saved ? `<button class="menu-row" id="moveEarlier">${icon("arrow")}<span>Mover antes en Mi Lista</span></button><button class="menu-row" id="moveLater">${icon("arrow")}<span>Mover después en Mi Lista</span></button>` : ""}<button class="menu-row" id="menuDownload">${icon(pin ? "trash" : "download")}<span>${pin ? "Eliminar descarga offline" : "Guardar ficha offline"}</span></button><button class="menu-row" id="menuShare">${icon("share")}<span>Compartir ficha</span></button>`,
  );
  $("#menuSave").onclick = () => {
    saveItem(m);
    closeSheet();
    if (location.hash === "#list") listPage();
  };
  if (saved)
    for (const [id, delta] of [
      ["moveEarlier", -1],
      ["moveLater", 1],
    ])
      $("#" + id).onclick = () => {
        reorderList(k, delta);
        localStorage.setItem("cs_list_sort_v1", "manual");
        closeSheet();
        if (location.hash.startsWith("#list")) listPage();
      };
  $("#menuDownload").onclick = () => {
    closeSheet();
    pin ? removeDownload(k) : downloadItem(m);
  };
  $("#menuShare").onclick = () => {
    closeSheet();
    share(m);
  };
}
