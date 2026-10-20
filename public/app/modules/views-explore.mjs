import {
  setView,
  head,
  section,
  offlineNote,
  cards,
  empty,
} from "./ui-components.mjs";
import { icon } from "./ui-icons.mjs";
import { esc, kind } from "./core-model.mjs";
import { $ } from "./ui-dom.mjs";
import { state } from "./core-state.mjs";
import { localPut } from "./storage-local.mjs";
import { sheet, closeSheet } from "./ui-sheet.mjs";
import { api } from "./services-api.mjs";
import { hydrate } from "./ui-images.mjs";

export async function explore(rev, query = "") {
  const labels = {
    multi: "Todo",
    movie: "Películas",
    tv: "Series",
    person: "Personas",
  };
  if (!Object.prototype.hasOwnProperty.call(labels, state.searchType))
    state.searchType = "multi";
  const typeChips = Object.entries(labels)
    .map(
      ([type, label]) =>
        `<button type="button" data-search-type="${type}" aria-pressed="${state.searchType === type}" class="${state.searchType === type ? "active" : ""}">${label}</button>`,
    )
    .join("");

  setView(
    `<div class="explore-page">${head("Explorar")}<form id="searchForm" class="search-form"><label class="search-box">${icon("search")}<input type="search" id="query" aria-label="Buscar películas, series o personas" placeholder="Películas, series, actores…" maxlength="120" value="${esc(query)}" required></label><button type="button" class="plain-icon" id="filterButton" aria-label="Más opciones de búsqueda">${icon("filter")}</button><button type="submit" class="plain-icon" id="submitSearch" aria-label="Buscar">${icon("arrow")}</button></form><div class="explore-type-pills" id="searchTypes" role="group" aria-label="Buscar en">${typeChips}</div><p class="filter-count" id="searchFilterLabel" aria-live="polite"></p><div id="exploreDefault"><section aria-labelledby="recentHeading"><div class="section-head"><h2 id="recentHeading">Búsquedas recientes</h2><button type="button" class="text-button" id="clearRecent">Limpiar</button></div><div class="recent-chips" id="recentChips"></div></section>${section("Explorar por categoría")}<div class="search-category-grid"><a class="category-shortcut" href="#browse/movie" aria-label="Películas: explorar estrenos y clásicos">${icon("movie")}<span class="category-copy"><strong>Películas</strong><small>Estrenos y clásicos</small></span>${icon("arrow")}</a><a class="category-shortcut" href="#browse/tv" aria-label="Series: explorar temporadas y episodios">${icon("tv")}<span class="category-copy"><strong>Series</strong><small>Temporadas y episodios</small></span>${icon("arrow")}</a><a class="category-shortcut" href="#browse/person" aria-label="Personas: explorar actores y directores">${icon("people")}<span class="category-copy"><strong>Personas</strong><small>Actores y directores</small></span>${icon("arrow")}</a><a class="category-shortcut" href="#genres" aria-label="Géneros: explorar todos los géneros">${icon("tag")}<span class="category-copy"><strong>Géneros</strong><small>Descubre por género</small></span>${icon("arrow")}</a></div>${section("Tendencias de hoy", "#browse/trending/day")}<div id="todayTrends" class="explore-trending" role="region" aria-label="Tendencias de hoy"><div class="loading-state" role="status">Consultando tendencias…</div></div></div><div id="searchResults" class="search-results" role="region" aria-label="Resultados de búsqueda" hidden></div></div>`,
  );

  function updateFilterState() {
    const type = Object.prototype.hasOwnProperty.call(labels, state.searchType)
      ? state.searchType
      : "multi";
    state.searchType = type;
    $("#searchTypes")?.querySelectorAll("[data-search-type]").forEach((button) => {
      const active = button.dataset.searchType === type;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const label = $("#searchFilterLabel");
    if (label) label.textContent = "Buscar en: " + labels[type];
  }

  function recent() {
    if (!$("#recentChips")) return;
    $("#recentChips").innerHTML = state.recents.length
      ? state.recents
          .map(
            (q) =>
              `<button type="button" data-recent="${esc(q)}" aria-label="Repetir búsqueda: ${esc(q)}">${esc(q)}</button>`,
          )
          .join("")
      : '<span class="muted tiny">Tus búsquedas aparecerán aquí.</span>';
    updateFilterState();
  }

  async function search() {
    const q = $("#query").value.trim();
    if (!q) return;
    const seq = ++state.searchRevision,
      type = state.searchType;
    const next = [q, ...state.recents.filter((x) => x !== q)].slice(0, 8);
    if (localPut("cs_recent_v2", next)) state.recents = next;
    recent();
    $("#exploreDefault").hidden = true;
    $("#searchResults").hidden = false;
    $("#searchResults").innerHTML =
      '<div class="loading-state" role="status">Buscando…</div>';
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
  $("#searchTypes").onclick = (event) => {
    const button = event.target.closest("[data-search-type]");
    if (
      !button ||
      !Object.prototype.hasOwnProperty.call(labels, button.dataset.searchType)
    )
      return;
    state.searchType = button.dataset.searchType;
    updateFilterState();
    if ($("#query").value.trim()) search();
  };
  $("#filterButton").onclick = () => {
    sheet(
      `<h2>Filtrar búsqueda</h2><label for="filterType">Buscar en</label><select id="filterType">${Object.entries(
        labels,
      )
        .map(
          ([key, label]) =>
            `<option value="${key}" ${state.searchType === key ? "selected" : ""}>${label}</option>`,
        )
        .join("")}</select><button class="primary" id="applyFilter">Aplicar filtro</button>`,
    );
    $("#applyFilter").onclick = () => {
      state.searchType = $("#filterType").value;
      closeSheet();
      recent();
      if ($("#query").value.trim()) search();
    };
  };
  $("#recentChips").onclick = (event) => {
    const button = event.target.closest("[data-recent]");
    if (button) {
      $("#query").value = button.dataset.recent;
      search();
    }
  };
  $("#searchForm").onsubmit = (event) => {
    event.preventDefault();
    return search();
  };
  if (query) {
    await search();
    return;
  }
  try {
    const data = await api("trending/all/day");
    if (rev !== state.routeRevision) return;
    const items = (data.results || [])
      .filter((item) => kind(item) !== "person")
      .slice(0, 6);
    $("#todayTrends").innerHTML =
      offlineNote(data._offline ? data : null) +
      (items.length
        ? cards(items, true)
        : empty(
            "No hay tendencias disponibles",
            "TMDB no devolvió títulos para este momento.",
            "movie",
          ));
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
