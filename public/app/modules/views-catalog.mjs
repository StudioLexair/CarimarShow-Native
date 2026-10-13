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
) {
  const maps = {
    movie: ["movie/popular", "Películas"],
    tv: ["tv/popular", "Series"],
    person: ["person/popular", "Personas"],
    trending: ["trending/all/week", "Tendencias"],
    new: ["movie/now_playing", "Nuevos lanzamientos"],
  };
  let [path, label] = maps[mode] || maps.movie;
  const params = { page: String(page) };
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
        await browse(mode, rev, page + 1, genreId, genreLabel);
      } catch (e) {
        toast(e.message);
        b.disabled = false;
      }
    };
  }
}

export async function genresPage(rev) {
  const d = await api("genre/movie/list");
  if (rev !== state.routeRevision) return;
  const order = [
      "Acción",
      "Aventura",
      "Comedia",
      "Drama",
      "Terror",
      "Ciencia ficción",
      "Romance",
      "Fantasía",
    ],
    all = [...(d.genres || [])].sort((a, b) => {
      const ia = order.indexOf(a.name),
        ib = order.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  setView(
    `${head("Categorías", "#explore")}${offlineNote(d._offline ? d : null)}<div class="genre-tabs"><button class="active" data-genre-tab="all">Todos</button>${all
      .slice(0, 6)
      .map((g) => `<button data-genre-tab="${g.id}">${esc(g.name)}</button>`)
      .join("")}</div><div class="genre-grid">${all
      .map((g) => {
        const m =
          state.seed.catalog.find((m) => (m.genre_ids || []).includes(g.id)) ||
          state.seed.catalog.find((m) =>
            (state.seed.details[`${kind(m)}/${m.id}`]?.genres || []).some(
              (x) => x.id === g.id,
            ),
          );
        return `<a class="genre-tile" href="#genre/movie/${g.id}/${encodeURIComponent(g.name)}">${m ? image(m.backdrop_path || m.poster_path, m.backdrop_path ? "w780" : "w342", g.name) : ""}<strong>${esc(g.name)}</strong></a>`;
      })
      .join("")}</div>`,
  );
  document.querySelectorAll("[data-genre-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.genreTab !== "all") {
          const g = all.find((g) => String(g.id) === b.dataset.genreTab);
          location.hash = `#genre/movie/${g.id}/${encodeURIComponent(g.name)}`;
        }
      }),
  );
}
