import {
  setView,
  head,
  section,
  offlineNote,
  cards,
  empty,
  trendRow,
} from "./ui-components.mjs";
import { icon } from "./ui-icons.mjs";
import { esc, kind } from "./core-model.mjs";
import { $ } from "./ui-dom.mjs";
import { state } from "./core-state.mjs";
import { localPut } from "./storage-local.mjs";
import { sheet, closeSheet } from "./ui-sheet.mjs";
import { api } from "./services-api.mjs";
import { hydrate } from "./ui-images.mjs";
import { remember } from "./services-library.mjs";
export async function explore(rev, query = "") {
  setView(
    `${head("Buscar")}<form id="searchForm" class="search-form"><label class="search-box">${icon("search")}<input type="search" id="query" aria-label="Buscar películas, series o personas" placeholder="Películas, series, actores…" maxlength="120" value="${esc(query)}" required></label><button type="button" class="plain-icon" id="filterButton" aria-label="Filtros de búsqueda">${icon("filter")}</button><button type="submit" class="plain-icon" aria-label="Buscar">${icon("arrow")}</button></form><p class="filter-count" id="searchFilterLabel"></p><div id="exploreDefault"><section><div class="section-head"><h2>Búsquedas recientes</h2><button class="text-button" id="clearRecent">Limpiar</button></div><div class="recent-chips" id="recentChips"></div></section>${section("Categorías")}<div class="search-category-grid"><a class="category-shortcut" href="#browse/movie">${icon("movie")}Películas</a><a class="category-shortcut" href="#browse/tv">${icon("tv")}Series</a><a class="category-shortcut" href="#browse/person">${icon("people")}Personas</a><a class="category-shortcut" href="#genres">${icon("tag")}Géneros</a></div>${section("Tendencias de hoy")}<div id="todayTrends" class="trend-list"><div class="loading-state">Consultando tendencias…</div></div></div><div id="searchResults" class="search-results" hidden></div>`,
  );
  const labels = {
    multi: "Todo",
    movie: "Películas",
    tv: "Series",
    person: "Personas / actores",
  };
  function recent() {
    if (!$("#recentChips")) return;
    $("#recentChips").innerHTML = state.recents.length
      ? state.recents
          .map((q) => `<button data-recent="${esc(q)}">${esc(q)}</button>`)
          .join("")
      : '<span class="muted tiny">Tus búsquedas aparecerán aquí.</span>';
    $("#searchFilterLabel").textContent =
      "Buscar en: " + labels[state.searchType];
  }
  async function search() {
    const q = $("#query").value.trim();
    if (!q) return;
    const seq = ++state.searchRevision,
      type = state.searchType;
    const next = [q, ...state.recents.filter((x) => x !== q)].slice(0, 8);
    if (localPut("cs_recent_v2", next)) state.recents = next;
    $("#exploreDefault").hidden = true;
    $("#searchResults").hidden = false;
    $("#searchResults").innerHTML =
      '<div class="loading-state">Buscando…</div>';
    try {
      const d = await api("search/" + type, { query: q });
      if (rev !== state.routeRevision || seq !== state.searchRevision) return;
      let result = d.results || [];
      if (type !== "multi")
        result = result.map((m) => ({ ...m, media_type: type }));
      $("#searchResults").innerHTML =
        offlineNote(d._offline ? d : null) +
        section(`Resultados para “${q}”`) +
        (result.length
          ? cards(result)
          : empty(
              "No encontramos coincidencias",
              d._offline
                ? "No hay coincidencias en la información local. No se pudo consultar Internet; vuelve a intentarlo con conexión."
                : "La búsqueda se realizó correctamente, pero no hubo coincidencias. Prueba otro nombre.",
              "search",
            )) +
        (d._offline
          ? '<div class="more-wrap"><button class="secondary" id="retrySearch">Consultar de nuevo</button></div>'
          : "");
      hydrate();
      if ($("#retrySearch")) $("#retrySearch").onclick = search;
    } catch (err) {
      if (rev !== state.routeRevision || seq !== state.searchRevision) return;
      $("#searchResults").innerHTML =
        empty("No se pudo buscar", err.message, "offline") +
        '<div class="more-wrap"><button class="primary" id="retrySearch">Reintentar búsqueda</button></div>';
      $("#retrySearch").onclick = search;
    }
  }
  recent();
  $("#clearRecent").onclick = () => {
    if (localPut("cs_recent_v2", [])) {
      state.recents = [];
      recent();
    }
  };
  $("#filterButton").onclick = () => {
    sheet(
      `<h2>Filtrar búsqueda</h2><label for="filterType">Buscar en</label><select id="filterType">${Object.entries(
        labels,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${state.searchType === k ? "selected" : ""}>${v}</option>`,
        )
        .join(
          "",
        )}</select><button class="primary" id="applyFilter">Aplicar filtro</button>`,
    );
    $("#applyFilter").onclick = () => {
      state.searchType = $("#filterType").value;
      closeSheet();
      recent();
      if ($("#query").value.trim()) search();
    };
  };
  $("#recentChips").onclick = (e) => {
    const b = e.target.closest("[data-recent]");
    if (b) {
      $("#query").value = b.dataset.recent;
      search();
    }
  };
  $("#searchForm").onsubmit = (e) => {
    e.preventDefault();
    return search();
  };
  if (query) {
    await search();
    return;
  }
  try {
    const d = await api("trending/all/day");
    if (rev !== state.routeRevision) return;
    const items = (d.results || [])
      .filter((m) => kind(m) !== "person")
      .slice(0, 5);
    remember(items);
    $("#todayTrends").innerHTML =
      offlineNote(d._offline ? d : null) + items.map(trendRow).join("");
    hydrate();
  } catch (err) {
    if (rev === state.routeRevision && $("#todayTrends"))
      $("#todayTrends").innerHTML = empty(
        "No hay tendencias guardadas",
        err.message,
        "offline",
      );
  }
}
