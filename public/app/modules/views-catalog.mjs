import {
  mergeGenres,
  genreSupports,
  interleaveTitles,
} from "./core-genres.mjs";
import { readChoice, readLocal, localPut } from "./storage-local.mjs";
import { icon } from "./ui-icons.mjs";
import { api } from "./services-api.mjs";
import { state } from "./core-state.mjs";
import { remember } from "./services-library.mjs";
import {
  setView,
  head,
  offlineNote,
  cards,
  empty,
} from "./ui-components.mjs";
import { $, toast } from "./ui-dom.mjs";
import { hydrate, hydrateImage, image } from "./ui-images.mjs";
import { esc, kind } from "./core-model.mjs";
import { genres as seededGenres } from "./services-fallback.mjs";

const CATALOG_SORTS = new Set(["popular", "rating", "recent", "trending"]),
  CATALOG_RATINGS = new Set(["", "5", "6", "7", "8", "9"]),
  PEOPLE_ROLES = [
    ["", "Todos los roles"],
    ["Acting", "Actuación"],
    ["Directing", "Dirección"],
    ["Writing", "Guion"],
    ["Production", "Producción"],
    ["Camera", "Fotografía"],
    ["Editing", "Montaje"],
    ["Sound", "Sonido"],
    ["Visual Effects", "Efectos visuales"],
    ["Art", "Arte"],
  ],
  PEOPLE_ROLE_VALUES = new Set(PEOPLE_ROLES.map(([value]) => value)),
  PEOPLE_SORTS = new Set(["trending", "popular", "name"]);

function filterKey(mode) {
  return `cs_catalog_filters_${mode}_v1`;
}

function catalogFilters(mode) {
  const saved = readLocal(filterKey(mode), {}),
    year = String(saved?.year ?? ""),
    rating = String(saved?.rating ?? ""),
    genre = String(saved?.genre ?? ""),
    sort = String(saved?.sort ?? "popular");
  return {
    genre: /^[1-9]\d{0,5}$/.test(genre) ? genre : "",
    year: /^(18|19|20|21)\d{2}$/.test(year) && Number(year) <= 2100 ? year : "",
    rating: CATALOG_RATINGS.has(rating) ? rating : "",
    sort: CATALOG_SORTS.has(sort) ? sort : "popular",
  };
}

function peopleFilters() {
  const saved = readLocal("cs_people_filters_v1", {}),
    role = String(saved?.role ?? ""),
    sort = String(saved?.sort ?? "trending");
  return {
    role: PEOPLE_ROLE_VALUES.has(role) ? role : "",
    sort: PEOPLE_SORTS.has(sort) ? sort : "trending",
  };
}

function yearOptions(selected) {
  const latest = new Date().getFullYear() + 2;
  return `<option value="">Todos los años</option>${Array.from(
    { length: latest - 1899 },
    (_, index) => latest - index,
  )
    .map(
      (year) =>
        `<option value="${year}"${String(year) === selected ? " selected" : ""}>${year}</option>`,
    )
    .join("")}`;
}

function filterOptions(list, selected) {
  const hasSaved = selected && !list.some((genre) => String(genre.id) === selected);
  return `<option value="">Todos los géneros</option>${hasSaved ? `<option value="${esc(selected)}" selected>Género guardado</option>` : ""}${list
    .map(
      (genre) =>
        `<option value="${genre.id}"${String(genre.id) === selected ? " selected" : ""}>${esc(genre.name)}</option>`,
    )
    .join("")}`;
}

function catalogFilterMarkup(mode, filters, options) {
  const yearLabel = mode === "tv" ? "Año de emisión" : "Año de estreno";
  return `<form id="catalogFilters" class="catalog-filter-panel" aria-label="Filtrar ${mode === "tv" ? "series" : "películas"}">
    <label class="catalog-filter-control"><span>Género</span><select id="catalogGenre" aria-label="Filtrar por género">${filterOptions(options, filters.genre)}</select></label>
    <label class="catalog-filter-control"><span>${yearLabel}</span><select id="catalogYear" aria-label="Filtrar por año">${yearOptions(filters.year)}</select></label>
    <label class="catalog-filter-control"><span>Valoración mínima</span><select id="catalogRating" aria-label="Filtrar por valoración mínima">${[
      ["", "Cualquiera"],
      ["5", "5+ estrellas"],
      ["6", "6+ estrellas"],
      ["7", "7+ estrellas"],
      ["8", "8+ estrellas"],
      ["9", "9+ estrellas"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}"${filters.rating === value ? " selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>
    <label class="catalog-filter-control"><span>Ordenar por</span><select id="catalogSort" aria-label="Ordenar catálogo">${[
      ["popular", "Más populares"],
      ["rating", "Mejor valoradas"],
      ["trending", "Tendencias de esta semana"],
      ["recent", "Más recientes"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}"${filters.sort === value ? " selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>
    <button type="button" class="catalog-filter-reset" id="clearCatalogFilters">Limpiar filtros</button>
  </form>`;
}

function peopleFilterMarkup(filters) {
  return `<form id="peopleFilters" class="people-filter-panel" aria-label="Buscar y filtrar personas">
    <label class="people-search-control"><span class="sr-only">Buscar personas</span>${icon("search")}<input type="search" id="peopleQuery" placeholder="Buscar personas…" autocomplete="off" maxlength="120" aria-label="Buscar personas"></label>
    <label class="catalog-filter-control"><span>Profesión</span><select id="peopleRole" aria-label="Filtrar por profesión">${PEOPLE_ROLES.map(
      ([value, label]) =>
        `<option value="${esc(value)}"${filters.role === value ? " selected" : ""}>${label}</option>`,
    ).join("")}</select></label>
    <label class="catalog-filter-control"><span>Popularidad</span><select id="peopleSort" aria-label="Ordenar personas">${[
      ["trending", "Tendencias"],
      ["popular", "Más populares"],
      ["name", "Nombre A–Z"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}"${filters.sort === value ? " selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>
  </form>`;
}

function catalogYear(item, mode) {
  const date = mode === "tv" ? item.first_air_date : item.release_date;
  return Number(String(date || "").slice(0, 4)) || 0;
}

function matchesCatalogFilters(item, mode, filters) {
  if (filters.genre) {
    const ids = new Set([
      ...(item.genre_ids || []).map(Number),
      ...(
        state.seed.details[`${mode}/${item.id}`]?.genres || []
      ).map((genre) => Number(genre.id)),
    ]);
    if (!ids.has(Number(filters.genre))) return false;
  }
  if (filters.year && catalogYear(item, mode) !== Number(filters.year))
    return false;
  if (filters.rating && Number(item.vote_average || 0) < Number(filters.rating))
    return false;
  return true;
}

function catalogRequest(mode, filters, page) {
  if (filters.sort === "trending")
    return { path: `trending/${mode}/week`, params: { page: String(page) } };
  const params = {
      page: String(page),
      sort_by:
        filters.sort === "rating"
          ? "vote_average.desc"
          : filters.sort === "recent"
            ? mode === "tv"
              ? "first_air_date.desc"
              : "primary_release_date.desc"
            : "popularity.desc",
    },
    yearKey = mode === "tv" ? "first_air_date_year" : "primary_release_year";
  if (filters.genre) params.with_genres = filters.genre;
  if (filters.year) params[yearKey] = filters.year;
  if (filters.rating) params["vote_average.gte"] = filters.rating;
  if (filters.sort === "rating") params["vote_count.gte"] = "50";
  return { path: `discover/${mode}`, params };
}

async function genreList(mode) {
  try {
    const data = await api(`genre/${mode}/list`);
    return {
      genres: Array.isArray(data.genres) ? data.genres : [],
      offline: data._offline ? data : null,
      error: "",
    };
  } catch (error) {
    return {
      genres: seededGenres(mode),
      offline: null,
      error: error.message,
    };
  }
}

async function browseTitles(mode, rev) {
  const filters = catalogFilters(mode),
    options = seededGenres(mode),
    requestState = { sequence: 0, page: 0, totalPages: 1, items: [] };
  let genreResult;
  setView(
    `<div class="catalog-browser">${head(mode === "tv" ? "Series" : "Películas", "#explore")}${catalogFilterMarkup(mode, filters, options)}<div id="catalogStatus"></div><p class="catalog-summary" id="catalogSummary" aria-live="polite"></p><div id="browseCards"><div class="loading-state" role="status">Consultando títulos…</div></div><div class="more-wrap"><button class="secondary" id="loadMore">Cargar más</button></div></div>`,
  );

  const filterForm = $("#catalogFilters");
  function readForm() {
    filters.genre = $("#catalogGenre").value;
    filters.year = $("#catalogYear").value;
    filters.rating = $("#catalogRating").value;
    filters.sort = $("#catalogSort").value;
    localPut(filterKey(mode), filters);
  }
  filterForm.onchange = (event) => {
    if (!event.target.matches("select")) return;
    readForm();
    void loadPage(1);
  };
  $("#clearCatalogFilters").onclick = () => {
    filters.genre = "";
    filters.year = "";
    filters.rating = "";
    filters.sort = "popular";
    $("#catalogGenre").value = "";
    $("#catalogYear").value = "";
    $("#catalogRating").value = "";
    $("#catalogSort").value = "popular";
    localPut(filterKey(mode), filters);
    void loadPage(1);
  };

  async function loadPage(page) {
    if (rev !== state.routeRevision) return;
    const sequence = ++requestState.sequence,
      button = $("#loadMore"),
      first = page === 1;
    if (first) {
      requestState.page = 0;
      requestState.totalPages = 1;
      requestState.items = [];
      $("#browseCards").innerHTML =
        '<div class="loading-state" role="status">Aplicando filtros…</div>';
      $("#catalogSummary").textContent = "";
      button.hidden = true;
    }
    button.disabled = true;
    const request = catalogRequest(mode, filters, page);
    try {
      const data = await api(request.path, request.params);
      if (rev !== state.routeRevision || sequence !== requestState.sequence) return;
      const incoming = (data.results || [])
          .map((item) => ({ ...item, media_type: mode }))
          .filter((item) => matchesCatalogFilters(item, mode, filters)),
        seen = new Set(requestState.items.map((item) => item.id));
      for (const item of incoming)
        if (!seen.has(item.id)) {
          seen.add(item.id);
          requestState.items.push(item);
        }
      requestState.page = page;
      requestState.totalPages = Math.min(500, Number(data.total_pages || 1));
      remember(requestState.items);
      $("#catalogStatus").innerHTML = offlineNote(data._offline ? data : null);
      $("#browseCards").innerHTML = requestState.items.length
        ? cards(requestState.items)
        : empty(
            "No hay títulos con estos filtros",
            "Prueba otro género, año o valoración. También puedes limpiar los filtros.",
            "search",
          );
      $("#catalogSummary").textContent = `${requestState.items.length} ${mode === "tv" ? "series" : "películas"}${filters.genre || filters.year || filters.rating ? " con los filtros seleccionados" : " en esta selección"}`;
      button.hidden = page >= requestState.totalPages;
      button.disabled = false;
      button.textContent = "Cargar más";
    } catch (error) {
      if (rev !== state.routeRevision || sequence !== requestState.sequence) return;
      $("#catalogStatus").innerHTML = `<div class="notice">${esc(error.message)} <button type="button" class="text-button" id="retryCatalog">Reintentar</button></div>`;
      $("#retryCatalog").onclick = () => loadPage(page);
      if (first)
        $("#browseCards").innerHTML = empty(
          "No pudimos cargar el catálogo",
          "Comprueba la conexión y vuelve a intentarlo.",
          "offline",
        );
      button.hidden = true;
      button.disabled = false;
    }
  }

  $("#loadMore").onclick = () => loadPage(requestState.page + 1);
  const genrePromise = genreList(mode);
  await loadPage(1);
  if (rev !== state.routeRevision) return;
  genreResult = await genrePromise;
  if (rev !== state.routeRevision) return;
  const select = $("#catalogGenre"),
    current = filters.genre;
  select.innerHTML = filterOptions(genreResult.genres, current);
  if (![...select.options].some((option) => option.value === current)) {
    filters.genre = "";
    select.value = "";
    localPut(filterKey(mode), filters);
  } else select.value = current;
  if (genreResult.offline)
    $("#catalogStatus").insertAdjacentHTML(
      "afterbegin",
      offlineNote(genreResult.offline),
    );
  if (genreResult.error && !genreResult.genres.length)
    $("#catalogStatus").insertAdjacentHTML(
      "afterbegin",
      `<div class="notice">No se pudieron actualizar los géneros: ${esc(genreResult.error)}</div>`,
    );
}

async function browsePeople(rev) {
  const filters = peopleFilters(),
    requestState = { sequence: 0, page: 0, totalPages: 1, items: [] };
  let debounce = 0;
  setView(
    `<div class="catalog-browser people-browser">${head("Personas", "#explore")}${peopleFilterMarkup(filters)}<div id="peopleStatus"></div><p class="catalog-summary" id="peopleSummary" aria-live="polite"></p><div id="browseCards"><div class="loading-state" role="status">Consultando personas…</div></div><div class="more-wrap"><button class="secondary" id="loadMore">Cargar más</button></div></div>`,
  );
  const queryInput = $("#peopleQuery");
  function readPeopleForm() {
    filters.role = $("#peopleRole").value;
    filters.sort = $("#peopleSort").value;
    localPut("cs_people_filters_v1", filters);
  }
  $("#peopleFilters").onsubmit = (event) => {
    event.preventDefault();
    void loadPage(1);
  };
  $("#peopleRole").onchange = () => {
    readPeopleForm();
    void loadPage(1);
  };
  $("#peopleSort").onchange = () => {
    readPeopleForm();
    void loadPage(1);
  };
  queryInput.oninput = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => loadPage(1), 350);
  };

  async function loadPage(page) {
    if (rev !== state.routeRevision) return;
    const sequence = ++requestState.sequence,
      button = $("#loadMore"),
      query = queryInput.value.trim(),
      path = query
        ? "search/person"
        : filters.sort === "trending"
          ? "trending/person/week"
          : "person/popular",
      params = { page: String(page) };
    if (query) params.query = query;
    if (page === 1) {
      requestState.items = [];
      requestState.page = 0;
      requestState.totalPages = 1;
      $("#browseCards").innerHTML =
        '<div class="loading-state" role="status">Buscando personas…</div>';
      $("#peopleSummary").textContent = "";
      button.hidden = true;
    }
    button.disabled = true;
    try {
      const data = await api(path, params);
      if (rev !== state.routeRevision || sequence !== requestState.sequence) return;
      let incoming = (data.results || [])
        .map((person) => ({ ...person, media_type: "person" }))
        .filter(
          (person) =>
            !filters.role || person.known_for_department === filters.role,
        );
      if (filters.sort === "name")
        incoming.sort((a, b) => a.name.localeCompare(b.name, "es"));
      else if (query || filters.sort === "popular")
        incoming.sort(
          (a, b) => Number(b.popularity || 0) - Number(a.popularity || 0),
        );
      const seen = new Set(requestState.items.map((person) => person.id));
      for (const person of incoming)
        if (!seen.has(person.id)) {
          seen.add(person.id);
          requestState.items.push(person);
        }
      if (filters.sort === "name")
        requestState.items.sort((a, b) => a.name.localeCompare(b.name, "es"));
      requestState.page = page;
      requestState.totalPages = Math.min(500, Number(data.total_pages || 1));
      remember(requestState.items);
      $("#peopleStatus").innerHTML = offlineNote(data._offline ? data : null);
      $("#browseCards").innerHTML = requestState.items.length
        ? cards(requestState.items)
        : empty(
            query ? "No encontramos personas" : "No hay personas con este filtro",
            query
              ? "Prueba con otro nombre o apellido."
              : "Prueba otra profesión o cambia el orden de popularidad.",
            "people",
          );
      $("#peopleSummary").textContent = `${requestState.items.length} ${requestState.items.length === 1 ? "persona" : "personas"}${query ? ` · resultados para «${query}»` : filters.sort === "trending" ? " · en tendencias" : " · catálogo TMDB"}`;
      button.hidden = page >= requestState.totalPages;
      button.disabled = false;
      button.textContent = "Cargar más";
    } catch (error) {
      if (rev !== state.routeRevision || sequence !== requestState.sequence) return;
      $("#peopleStatus").innerHTML = `<div class="notice">${esc(error.message)} <button type="button" class="text-button" id="retryPeople">Reintentar</button></div>`;
      $("#retryPeople").onclick = () => loadPage(page);
      if (page === 1)
        $("#browseCards").innerHTML = empty(
          "No pudimos cargar personas",
          "Comprueba la conexión y vuelve a intentarlo.",
          "offline",
        );
      button.hidden = true;
      button.disabled = false;
    }
  }

  $("#loadMore").onclick = () => loadPage(requestState.page + 1);
  await loadPage(1);
}

export async function browse(
  mode,
  rev,
  page = 1,
  genreId = null,
  genreLabel = "",
  period = "day",
) {
  if (!genreId && ["movie", "tv"].includes(mode))
    return browseTitles(mode, rev);
  if (!genreId && mode === "person") return browsePeople(rev);
  const maps = {
    movie: ["movie/popular", "Películas"],
    tv: ["tv/popular", "Series"],
    person: ["person/popular", "Personas"],
    trending: ["trending/all/day", "Tendencias"],
    new: ["movie/now_playing", "Nuevos lanzamientos"],
  };
  let [path, label] = maps[mode] || maps.movie;
  const params = { page: String(page) };
  if (mode === "trending") {
    period = period === "week" ? "week" : "day";
    path = `trending/all/${period}`;
    label = period === "week" ? "Tendencias de esta semana" : "Tendencias de hoy";
  }
  if (genreId) {
    path = "discover/" + mode;
    params.with_genres = String(genreId);
    label = genreLabel || "Explorar género";
  }
  const data = await api(path, params);
  if (rev !== state.routeRevision) return;
  const items = (data.results || []).map((item) => ({
    ...item,
    media_type:
      item.media_type ||
      (["movie", "tv", "person"].includes(mode) ? mode : "movie"),
  }));
  remember(items);
  if (page === 1)
    setView(
      `${head(label, "#explore")}${offlineNote(data._offline ? data : null)}<div id="browseCards">${items.length ? cards(items) : empty("No hay títulos guardados de esta categoría", "Consulta con conexión para ampliar el catálogo.", "movie")}</div><div class="more-wrap"><button class="secondary" id="loadMore">Cargar más</button></div>`,
    );
  else {
    $("#browseCards").insertAdjacentHTML("beforeend", cards(items));
    hydrate();
  }
  const button = $("#loadMore");
  if (button) {
    button.hidden = page >= Number(data.total_pages || 1) || items.length === 0;
    button.disabled = false;
    button.onclick = async () => {
      button.disabled = true;
      try {
        await browse(mode, rev, page + 1, genreId, genreLabel, period);
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    };
  }
}

const CONTENT_TYPES = {
  all: "Películas y series",
  movie: "Solo películas",
  tv: "Solo series",
};
function typeFilters(selected, href, group = null) {
  return `<nav class="content-type-filter" aria-label="Tipo de contenido">${Object.entries(
    CONTENT_TYPES,
  )
    .map(
      ([type, label]) =>
        `<a data-catalog-type="${type}" class="${selected === type ? "active" : ""} ${group && !genreSupports(group, type) ? "unavailable" : ""}" ${selected === type ? 'aria-current="page"' : ""} href="${href(type)}">${icon(type === "tv" ? "tv" : type === "movie" ? "movie" : "filter")}<span>${label}</span></a>`,
    )
    .join("")}</nav>`;
}
async function genreDefinitions() {
  const result = await Promise.allSettled([
    api("genre/movie/list"),
    api("genre/tv/list"),
  ]);
  if (result.every((value) => value.status === "rejected"))
    throw result[0].reason;
  const [movies, series] = result.map((value) =>
    value.status === "fulfilled"
      ? value.value
      : { genres: [], _unavailable: true, _error: value.reason.message },
  );
  return { groups: mergeGenres(movies.genres, series.genres), movies, series };
}
function sourceNotes(movies, series) {
  return `${movies._unavailable ? '<div class="notice">No se pudieron consultar los géneros de películas.</div>' : offlineNote(movies._offline ? movies : null)}${series._unavailable ? '<div class="notice">No se pudieron consultar los géneros de series. Reintenta con conexión.</div>' : offlineNote(series._offline ? series : null)}`;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function genreArtPool(type, extraItems = []) {
  const assets = new Map();
  for (const item of [...(state.seed.catalog || []), ...extraItems]) {
    const itemType = kind(item);
    if (!["movie", "tv"].includes(itemType) || (type !== "all" && type !== itemType))
      continue;
    const ids = new Set([
      ...(item.genre_ids || []).map(Number),
      ...(state.seed.details[`${itemType}/${item.id}`]?.genres || []).map(
        (genre) => Number(genre.id),
      ),
    ]);
    for (const [path, size] of [
      [item.backdrop_path, "w500"],
      [item.poster_path, "w342"],
    ]) {
      if (!path || !/^\/[\w.-]+$/.test(path)) continue;
      const existing = assets.get(path);
      if (existing) {
        existing.genreIds = new Set([...existing.genreIds, ...ids]);
        existing.types.add(itemType);
      } else {
        assets.set(path, {
          path,
          size,
          key: path,
          genreIds: ids,
          types: new Set([itemType]),
        });
      }
    }
  }
  return [...assets.values()];
}

function genreTilePlans(groups, type, pool) {
  return groups.map((group) => {
    const genreIds = new Set(
        type === "movie"
          ? group.movieIds
          : type === "tv"
            ? group.tvIds
            : [...group.movieIds, ...group.tvIds],
      ),
      candidates = pool.filter(
        (asset) =>
          [...asset.genreIds].some((id) => genreIds.has(id)) &&
          (type === "all" || [...asset.types].includes(type)),
      );
    return { group, candidates };
  });
}

function assignGenreAssets(plans, pool, currentKeys = new Set()) {
  const uniqueAlternatives = pool.filter((asset) => !currentKeys.has(asset.key)).length,
    avoidAllCurrent = uniqueAlternatives >= plans.length,
    forbidden = avoidAllCurrent ? currentKeys : new Set(),
    used = new Set(),
    assignments = new Map(),
    order = shuffle(plans).sort(
      (a, b) =>
        (a.candidates.length || pool.length) -
        (b.candidates.length || pool.length),
    );
  for (const plan of order) {
    const allowed = (asset) =>
      !used.has(asset.key) && !forbidden.has(asset.key);
    const asset =
      shuffle(plan.candidates).find(allowed) ||
      shuffle(pool).find(allowed) ||
      shuffle(pool).find((candidate) => !used.has(candidate.key));
    if (asset) {
      used.add(asset.key);
      assignments.set(plan, asset);
    }
  }
  return assignments;
}

let genreRotationTimer = 0,
  genreRotationObserver = null;
function stopGenreRotation() {
  if (genreRotationTimer) clearInterval(genreRotationTimer);
  genreRotationTimer = 0;
  genreRotationObserver?.disconnect();
  genreRotationObserver = null;
}
if (typeof window !== "undefined")
  window.addEventListener("hashchange", stopGenreRotation);

function makeImageElement(asset) {
  const template = document.createElement("template");
  template.innerHTML = image(asset.path, asset.size, "", "genre-tile-image");
  const imageNode = template.content.firstElementChild;
  imageNode.loading = "eager";
  imageNode.alt = "";
  imageNode.setAttribute("aria-hidden", "true");
  return imageNode;
}

async function preloadGenreImage(imageNode, asset) {
  const fresh = makeImageElement(asset);
  imageNode.className = fresh.className;
  imageNode.removeAttribute("data-loaded");
  imageNode.removeAttribute("data-error-fallback-bound");
  imageNode.removeAttribute("data-placeholder-shown");
  imageNode.removeAttribute("data-image");
  imageNode.removeAttribute("data-bundled");
  if (fresh.dataset.image) imageNode.dataset.image = fresh.dataset.image;
  if (fresh.dataset.bundled) imageNode.dataset.bundled = fresh.dataset.bundled;
  imageNode.src = fresh.src;
  await hydrateImage(imageNode);
  if (typeof imageNode.decode === "function") await imageNode.decode();
  else if (!imageNode.complete || imageNode.naturalWidth === 0)
    await new Promise((resolve, reject) => {
      imageNode.addEventListener("load", resolve, { once: true });
      imageNode.addEventListener("error", reject, { once: true });
    });
  if (!imageNode.naturalWidth) throw Error("No se pudo preparar la imagen");
}

async function switchGenreTile(tile, asset) {
  if (!tile?.isConnected || !asset || tile.dataset.imagePath === asset.path) return;
  if (tile._genreSwapBusy) {
    tile._genrePendingAsset = asset;
    return;
  }
  tile._genreSwapBusy = true;
  tile._genreLoadingAsset = asset;
  const images = [...tile.querySelectorAll(".genre-tile-image")],
    active = images.find((node) => node.classList.contains("is-active")),
    target = images.find((node) => node !== active);
  try {
    if (!active || !target) return;
    await preloadGenreImage(target, asset);
    if (!tile.isConnected) return;
    target.classList.add("is-active");
    active.classList.remove("is-active");
    tile.dataset.imagePath = asset.path;
  } catch {
    // Keep the already visible artwork if the new asset cannot be decoded.
  } finally {
    tile._genreSwapBusy = false;
    tile._genreLoadingAsset = null;
    const pending = tile._genrePendingAsset;
    tile._genrePendingAsset = null;
    if (pending && pending.path !== tile.dataset.imagePath)
      queueMicrotask(() => switchGenreTile(tile, pending));
  }
}

function startGenreRotation(rev, plans, pool) {
  stopGenreRotation();
  const root = document.querySelector(".genres-page:not(.genre-results-page)"),
    grid = root?.querySelector(".genre-grid"),
    tiles = [...(grid?.querySelectorAll(".genre-tile") || [])];
  if (!root || tiles.length < 2 || pool.length < 2) return;
  const byId = new Map(plans.map((plan) => [String(plan.group.id), plan]));
  if ("IntersectionObserver" in window) {
    genreRotationObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tile = entry.target;
          tile.dataset.rotationVisible = String(entry.isIntersecting);
          if (entry.isIntersecting && tile._genrePendingAsset) {
            const pending = tile._genrePendingAsset;
            tile._genrePendingAsset = null;
            void switchGenreTile(tile, pending);
          }
        }
      },
      { rootMargin: "100px" },
    );
    tiles.forEach((tile) => genreRotationObserver.observe(tile));
  }
  const rotate = async () => {
    if (!root.isConnected || rev !== state.routeRevision) {
      stopGenreRotation();
      return;
    }
    const current = new Set(
        tiles
          .flatMap((tile) => [
            tile.dataset.imagePath,
            tile._genreLoadingAsset?.path,
            tile._genrePendingAsset?.path,
          ])
          .filter(Boolean),
      ),
      assignments = assignGenreAssets(plans, pool, current);
    for (const tile of tiles) {
      const plan = byId.get(tile.dataset.genreId),
        asset = plan && assignments.get(plan);
      if (!asset || asset.path === tile.dataset.imagePath) continue;
      const rect = tile.getBoundingClientRect(),
        visible =
          tile.dataset.rotationVisible === "true" ||
          (rect.bottom > -100 && rect.top < innerHeight + 100);
      if (visible) void switchGenreTile(tile, asset);
      else tile._genrePendingAsset = asset;
    }
  };
  genreRotationTimer = setInterval(rotate, 6000);
}

export async function genresPage(rev, selected) {
  stopGenreRotation();
  const type = Object.hasOwn(CONTENT_TYPES, selected)
      ? selected
      : readChoice("cs_catalog_type_v1", Object.keys(CONTENT_TYPES), "all"),
    { groups, movies, series } = await genreDefinitions();
  if (rev !== state.routeRevision) return;
  const all = groups.filter((group) => genreSupports(group, type));
  let pool = genreArtPool(type);
  if (pool.length < all.length) {
    const modes = type === "all" ? ["movie", "tv"] : [type],
      live = await Promise.allSettled(
        modes.map((mode) => api(`${mode}/popular`, { page: "1" })),
      );
    if (rev !== state.routeRevision) return;
    const items = live.flatMap((result) =>
      result.status === "fulfilled" ? result.value.results || [] : [],
    );
    pool = genreArtPool(type, items);
  }
  const plans = genreTilePlans(all, type, pool),
    initial = assignGenreAssets(plans, pool);
  setView(
    `<div class="genres-page"><header class="collection-heading">${head("Géneros", "#explore")}<p>Encuentra tu próxima historia por género.</p></header>${typeFilters(type, (value) => "#genres/" + value)}${sourceNotes(movies, series)}<div class="genre-tabs"><button class="active" data-genre-tab="all">Todos los géneros</button>${all
      .slice(0, 6)
      .map((group) => `<button data-genre-tab="${group.id}">${esc(group.name)}</button>`)
      .join("")}</div><div class="genre-grid">${all
      .map((group, index) => {
        const plan = plans[index],
          artwork = initial.get(plan),
          typeLabel =
            group.movieIds.length && group.tvIds.length
              ? "Películas · Series"
              : group.movieIds.length
                ? "Películas"
                : "Series";
        return `<a class="genre-tile" data-genre-id="${group.id}" data-image-path="${esc(artwork?.path || "")}" href="#genre/${type}/${group.id}/${encodeURIComponent(group.name)}"><span class="genre-tile-art" aria-hidden="true">${artwork ? image(artwork.path, artwork.size, "", "genre-tile-image is-active") : ""}<img class="genre-tile-image" alt="" aria-hidden="true"></span><div class="genre-tile-copy"><strong>${esc(group.name)}</strong><span>${typeLabel}</span></div><span class="genre-tile-arrow">${icon("arrow")}</span></a>`;
      })
      .join("")}</div>${all.length ? "" : empty("Sin géneros disponibles", "Esta selección no está guardada. Consulta con conexión.", "tag")}<p class="genre-taxonomy-note">En series, TMDB agrupa Acción y Aventura, Ciencia ficción y Fantasía. Se consulta su categoría oficial correspondiente.</p></div>`,
  );
  startGenreRotation(rev, plans, pool);
  document.querySelectorAll("[data-catalog-type]").forEach(
    (anchor) =>
      (anchor.onclick = () =>
        localPut("cs_catalog_type_v1", anchor.dataset.catalogType)),
  );
  document.querySelectorAll("[data-genre-tab]").forEach(
    (button) =>
      (button.onclick = () => {
        if (button.dataset.genreTab !== "all") {
          const group = all.find(
            (entry) => String(entry.id) === button.dataset.genreTab,
          );
          if (group)
            location.hash = `#genre/${type}/${group.id}/${encodeURIComponent(group.name)}`;
        }
      }),
  );
}

export async function genreBrowse(type, rev, id, label = "") {
  const { groups, movies, series } = await genreDefinitions();
  if (rev !== state.routeRevision) return;
  const group =
    groups.find((entry) => String(entry.id) === String(id)) ||
    groups.find((entry) =>
      (type === "tv" ? entry.tvIds : entry.movieIds).includes(Number(id)),
    );
  if (!group)
    throw Error("Este género no está disponible en los datos consultados.");
  const name = label || group.name,
    available = ["movie", "tv"].filter(
      (media) => (type === "all" || type === media) && genreSupports(group, media),
    );
  const stores = Object.fromEntries(
    available.map((media) => [
      media,
      { page: 0, total: 1, items: [], offline: false, error: "" },
    ]),
  );
  setView(
    `<div class="genres-page genre-results-page"><header class="collection-heading">${head(name, "#genres/" + type)}<p>Explora ${esc(name.toLocaleLowerCase("es"))} a tu manera.</p></header>${typeFilters(type, (media) => `#genre/${media}/${group.id}/${encodeURIComponent(name)}`, group)}${group.tvIds.length && group.tvName !== group.name && type !== "movie" ? `<p class="genre-taxonomy-note">Series: categoría oficial «${esc(group.tvName)}» de TMDB.</p>` : ""}${sourceNotes(movies, series)}<p id="genreSummary" class="genre-summary" aria-live="polite"></p><div id="genreStatus"></div><div id="browseCards"><div class="loading-state">Consultando títulos…</div></div><div class="more-wrap"><button class="secondary" id="loadMore">Cargar más</button></div></div>`,
  );
  document.querySelectorAll("[data-catalog-type]").forEach(
    (anchor) =>
      (anchor.onclick = () =>
        localPut("cs_catalog_type_v1", anchor.dataset.catalogType)),
  );
  async function next() {
    const targets = available.filter(
        (media) => stores[media].page < stores[media].total,
      ),
      button = $("#loadMore");
    if (button) button.disabled = true;
    const results = await Promise.allSettled(
      targets.map((media) =>
        api("discover/" + media, {
          page: String(stores[media].page + 1),
          with_genres: (media === "movie" ? group.movieIds : group.tvIds).join(","),
        }),
      ),
    );
    if (rev !== state.routeRevision) return;
    targets.forEach((media, index) => {
      const target = stores[media],
        result = results[index];
      if (result.status === "rejected") {
        target.error = result.reason.message;
        return;
      }
      const data = result.value;
      target.page++;
      target.total = Number(data.total_pages || 1);
      target.offline = !!data._offline;
      target.data = data;
      target.error = "";
      const seen = new Set(target.items.map((item) => item.id));
      for (const item of data.results || [])
        if (!seen.has(item.id)) {
          seen.add(item.id);
          target.items.push({ ...item, media_type: media });
        }
    });
    const film = stores.movie?.items || [],
      tv = stores.tv?.items || [],
      items = interleaveTitles(film, tv);
    $("#genreSummary").textContent =
      `Mostrando ${film.length} películas y ${tv.length} series${Object.values(stores).some((store) => store.offline) ? " · Información local" : ""}`;
    $("#genreStatus").innerHTML = Object.entries(stores)
      .map(([media, store]) =>
        store.error
          ? `<div class="notice">${media === "movie" ? "Películas" : "Series"}: ${esc(store.error)}</div>`
          : offlineNote(store.offline ? store.data : null),
      )
      .join("");
    $("#browseCards").innerHTML = items.length
      ? cards(items)
      : empty(
          available.length
            ? "No hay títulos en esta selección"
            : "Este género no corresponde a ese tipo",
          Object.values(stores).some((store) => store.error || store.offline)
            ? "No hay resultados locales para esta selección. Esto no significa que no haya títulos en Internet. Reintenta con conexión."
            : available.length
              ? "La consulta terminó sin coincidencias para este género y tipo."
              : "Elige Películas y series u otro tipo de contenido.",
          "tag",
        );
    hydrate();
    button.hidden =
      !targets.length ||
      !available.some((media) => stores[media].page < stores[media].total);
    button.disabled = false;
    button.textContent = Object.values(stores).some((store) => store.error)
      ? "Reintentar consulta"
      : "Cargar más";
    button.onclick = () =>
      next().catch((error) => {
        toast(error.message);
        if (button.isConnected) button.disabled = false;
      });
  }
  await next();
}
