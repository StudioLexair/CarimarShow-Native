import {
  mergeGenres,
  genreSupports,
  interleaveTitles,
} from "./core-genres.mjs";
import { readChoice, localPut } from "./storage-local.mjs";
import { icon } from "./ui-icons.mjs";
import { api } from "./services-api.mjs";
import { state } from "./core-state.mjs";
import { remember } from "./services-library.mjs";
import { setView, head, offlineNote, cards, empty } from "./ui-components.mjs";
import { $, toast } from "./ui-dom.mjs";
import { hydrate, image } from "./ui-images.mjs";
import { esc, kind } from "./core-model.mjs";
export async function browse(
  mode,
  rev,
  page = 1,
  genreId = null,
  genreLabel = "",
  period = "day",
) {
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
  const d = await api(path, params);
  if (rev !== state.routeRevision) return;
  const items = (d.results || []).map((m) => ({
    ...m,
    media_type:
      m.media_type ||
      (["movie", "tv", "person"].includes(mode) ? mode : "movie"),
  }));
  remember(items);
  if (page === 1)
    setView(
      `${head(label, "#explore")}${offlineNote(d._offline ? d : null)}<div id="browseCards">${items.length ? cards(items) : empty("No hay títulos guardados de esta categoría", "Consulta con conexión para ampliar el catálogo.", "movie")}</div><div class="more-wrap"><button class="secondary" id="loadMore">Cargar más</button></div>`,
    );
  else {
    $("#browseCards").insertAdjacentHTML("beforeend", cards(items));
    hydrate();
  }
  const b = $("#loadMore");
  if (b) {
    b.hidden = page >= Number(d.total_pages || 1) || items.length === 0;
    b.disabled = false;
    b.onclick = async () => {
      b.disabled = true;
      try {
        await browse(mode, rev, page + 1, genreId, genreLabel, period);
      } catch (e) {
        toast(e.message);
        b.disabled = false;
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
  if (result.every((r) => r.status === "rejected")) throw result[0].reason;
  const [movies, series] = result.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { genres: [], _unavailable: true, _error: r.reason.message },
  );
  return { groups: mergeGenres(movies.genres, series.genres), movies, series };
}
function sourceNotes(movies, series) {
  return `${movies._unavailable ? '<div class="notice">No se pudieron consultar los géneros de películas.</div>' : offlineNote(movies._offline ? movies : null)}${series._unavailable ? '<div class="notice">No se pudieron consultar los géneros de series. Reintenta con conexión.</div>' : offlineNote(series._offline ? series : null)}`;
}
export async function genresPage(rev, selected) {
  const type = Object.hasOwn(CONTENT_TYPES, selected)
    ? selected
    : readChoice("cs_catalog_type_v1", Object.keys(CONTENT_TYPES), "all");
  const { groups, movies, series } = await genreDefinitions();
  if (rev !== state.routeRevision) return;
  const all = groups.filter((g) => genreSupports(g, type));
  setView(
    `<div class="genres-page"><header class="collection-heading">${head("Géneros", "#explore")}<p>Encuentra tu próxima historia por género.</p></header>${typeFilters(type, (t) => "#genres/" + t)}${sourceNotes(movies, series)}<div class="genre-tabs"><button class="active" data-genre-tab="all">Todos los géneros</button>${all
      .slice(0, 6)
      .map((g) => `<button data-genre-tab="${g.id}">${esc(g.name)}</button>`)
      .join("")}</div><div class="genre-grid">${all
      .map((g) => {
        const m = state.seed.catalog.find(
          (m) =>
            (type === "all" || kind(m) === type) &&
            ((m.genre_ids || []).some((id) =>
              (kind(m) === "tv" ? g.tvIds : g.movieIds).includes(id),
            ) ||
              (state.seed.details[`${kind(m)}/${m.id}`]?.genres || []).some(
                (x) => (kind(m) === "tv" ? g.tvIds : g.movieIds).includes(x.id),
              )),
        );
        return `<a class="genre-tile" href="#genre/${type}/${g.id}/${encodeURIComponent(g.name)}">${m ? image(m.backdrop_path || m.poster_path, m.backdrop_path ? "w780" : "w342", "") : ""}<div class="genre-tile-copy"><strong>${esc(g.name)}</strong><span>${g.movieIds.length && g.tvIds.length ? "Películas · Series" : g.movieIds.length ? "Películas" : "Series"}</span></div><span class="genre-tile-arrow">${icon("arrow")}</span></a>`;
      })
      .join(
        "",
      )}</div>${all.length ? "" : empty("Sin géneros disponibles", "Esta selección no está guardada. Consulta con conexión.", "tag")}<p class="genre-taxonomy-note">En series, TMDB agrupa Acción y Aventura, Ciencia ficción y Fantasía. Se consulta su categoría oficial correspondiente.</p></div>`,
  );
  document
    .querySelectorAll("[data-catalog-type]")
    .forEach(
      (a) =>
        (a.onclick = () =>
          localPut("cs_catalog_type_v1", a.dataset.catalogType)),
    );
  document.querySelectorAll("[data-genre-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.genreTab !== "all") {
          const g = all.find((g) => String(g.id) === b.dataset.genreTab);
          if (g)
            location.hash = `#genre/${type}/${g.id}/${encodeURIComponent(g.name)}`;
        }
      }),
  );
}
export async function genreBrowse(type, rev, id, label = "") {
  const { groups, movies, series } = await genreDefinitions();
  if (rev !== state.routeRevision) return;
  const group =
    groups.find((g) => String(g.id) === String(id)) ||
    groups.find((g) =>
      (type === "tv" ? g.tvIds : g.movieIds).includes(Number(id)),
    );
  if (!group)
    throw Error("Este género no está disponible en los datos consultados.");
  const name = label || group.name,
    available = ["movie", "tv"].filter(
      (t) => (type === "all" || type === t) && genreSupports(group, t),
    );
  const stores = Object.fromEntries(
    available.map((t) => [
      t,
      { page: 0, total: 1, items: [], offline: false, error: "" },
    ]),
  );
  setView(
    `<div class="genres-page genre-results-page"><header class="collection-heading">${head(name, "#genres/" + type)}<p>Explora ${esc(name.toLocaleLowerCase("es"))} a tu manera.</p></header>${typeFilters(type, (t) => `#genre/${t}/${group.id}/${encodeURIComponent(name)}`, group)}${group.tvIds.length && group.tvName !== group.name && type !== "movie" ? `<p class="genre-taxonomy-note">Series: categoría oficial «${esc(group.tvName)}» de TMDB.</p>` : ""}${sourceNotes(movies, series)}<p id="genreSummary" class="genre-summary" aria-live="polite"></p><div id="genreStatus"></div><div id="browseCards"><div class="loading-state">Consultando títulos…</div></div><div class="more-wrap"><button class="secondary" id="loadMore">Cargar más</button></div></div>`,
  );
  document
    .querySelectorAll("[data-catalog-type]")
    .forEach(
      (a) =>
        (a.onclick = () =>
          localPut("cs_catalog_type_v1", a.dataset.catalogType)),
    );
  async function next() {
    const targets = available.filter((t) => stores[t].page < stores[t].total),
      button = $("#loadMore");
    if (button) button.disabled = true;
    const results = await Promise.allSettled(
      targets.map((t) =>
        api("discover/" + t, {
          page: String(stores[t].page + 1),
          with_genres: (t === "movie" ? group.movieIds : group.tvIds).join(","),
        }),
      ),
    );
    if (rev !== state.routeRevision) return;
    targets.forEach((t, i) => {
      const target = stores[t],
        result = results[i];
      if (result.status === "rejected") {
        target.error = result.reason.message;
        return;
      }
      const d = result.value;
      target.page++;
      target.total = Number(d.total_pages || 1);
      target.offline = !!d._offline;
      target.data = d;
      target.error = "";
      const seen = new Set(target.items.map((m) => m.id));
      for (const m of d.results || [])
        if (!seen.has(m.id)) {
          seen.add(m.id);
          target.items.push({ ...m, media_type: t });
        }
    });
    const film = stores.movie?.items || [],
      tv = stores.tv?.items || [],
      items = interleaveTitles(film, tv);
    $("#genreSummary").textContent =
      `Mostrando ${film.length} películas y ${tv.length} series${Object.values(stores).some((s) => s.offline) ? " · Información local" : ""}`;
    $("#genreStatus").innerHTML = Object.entries(stores)
      .map(([t, s]) =>
        s.error
          ? `<div class="notice">${t === "movie" ? "Películas" : "Series"}: ${esc(s.error)}</div>`
          : offlineNote(s.offline ? s.data : null),
      )
      .join("");
    $("#browseCards").innerHTML = items.length
      ? cards(items)
      : empty(
          available.length
            ? "No hay títulos en esta selección"
            : "Este género no corresponde a ese tipo",
          Object.values(stores).some((s) => s.error || s.offline)
            ? "No hay resultados locales para esta selección. Esto no significa que no haya títulos en Internet. Reintenta con conexión."
            : available.length
              ? "La consulta terminó sin coincidencias para este género y tipo."
              : "Elige Películas y series u otro tipo de contenido.",
          "tag",
        );
    hydrate();
    button.hidden =
      !targets.length ||
      !available.some((t) => stores[t].page < stores[t].total);
    button.disabled = false;
    button.textContent = Object.values(stores).some((s) => s.error)
      ? "Reintentar consulta"
      : "Cargar más";
    button.onclick = () =>
      next().catch((e) => {
        toast(e.message);
        if (button.isConnected) button.disabled = false;
      });
  }
  await next();
}
