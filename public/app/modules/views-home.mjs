import { api } from "./services-api.mjs";
import { state } from "./core-state.mjs";
import { remember } from "./services-library.mjs";
import {
  setView,
  offlineNote,
  section,
  cards,
  empty,
  legal,
  genreNames,
  trailerLink,
} from "./ui-components.mjs";
import { kind, keyOf, esc, title } from "./core-model.mjs";
import { $ } from "./ui-dom.mjs";
import { image, hydrate } from "./ui-images.mjs";
import { icon } from "./ui-icons.mjs";
export async function home(rev) {
  const results = await Promise.allSettled([
    api("trending/all/week"),
    api("movie/now_playing"),
  ]);
  if (results.every((r) => r.status === "rejected")) throw results[0].reason;
  const [trending, fresh] = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { results: [], _unavailable: true, _error: r.reason.message },
  );
  if (rev !== state.routeRevision) return;
  const items = (trending.results || []).filter((m) => kind(m) !== "person"),
    newItems = (fresh.results || []).map((m) => ({
      ...m,
      media_type: "movie",
    }));
  const features = (state.seed.featured || [])
    .map((k) => state.seed.catalog.find((m) => keyOf(m) === k))
    .filter(Boolean);
  const heroes = (
    features.length ? features : items.filter((m) => m.backdrop_path)
  ).slice(0, 3);
  remember([...items, ...newItems, ...heroes]);
  state.heroIndex = 0;
  const feed = (label, link, list, data) =>
    `<section>${section(label, link)}${offlineNote(data._offline ? data : null)}${data._unavailable ? empty("No se pudo consultar esta sección", data._error, "offline") + '<button class="secondary" data-retry>Reintentar</button>' : list.length ? cards(list, true) : empty("Sin títulos en esta selección", data._offline ? "No hay títulos en los datos locales de esta sección. Consulta de nuevo con conexión." : "La consulta terminó sin títulos para esta sección.", "movie")}</section>`;
  setView(
    `${offlineNote(trending._offline ? trending : null)}<div class="hero-slider"><div id="heroSlot"></div><div class="slider-dots">${heroes.map((_, i) => `<button data-hero="${i}" class="${i === 0 ? "active" : ""}" aria-label="Destacado ${i + 1}"></button>`).join("")}</div></div><div class="home-sections"><section>${section("Tendencias", "#browse/trending")}${items.length ? cards(items.slice(0, 12), true) : empty(trending._unavailable ? "Tendencias no disponibles" : "Sin tendencias disponibles", trending._error || "No hay títulos en esta selección.", "movie")}${trending._unavailable ? '<button class="secondary" data-retry>Reintentar</button>' : ""}</section>${feed("Nuevos lanzamientos", "#browse/new", newItems.slice(0, 12), fresh)}<section>${section("Series para descubrir", "#browse/tv")}${items.some((m) => kind(m) === "tv") ? cards(items.filter((m) => kind(m) === "tv").slice(0, 9), true) : empty("Sin series en esta selección", trending._unavailable ? "No se pudo consultar la selección. Las categorías siguen disponibles." : "Puedes explorar más series desde la categoría Series.", "tv")}</section><section>${section("Tu lista", "#list")}${state.list.length ? cards(state.list.slice(0, 9), true) : empty("Guarda tu próxima historia", "Toca + en un título para encontrarlo aquí.")}</section></div>${legal()}`,
  );
  function show(i) {
    const m = heroes[i];
    if (!m) return;
    $("#heroSlot").innerHTML =
      `<section class="hero">${image(m.backdrop_path || m.poster_path, "w780", "", "hero-image")}<div class="hero-content"><span class="type-pill">${kind(m) === "tv" ? "Serie" : "Película"}</span><h1><a href="#detail/${kind(m)}/${m.id}">${esc(title(m))}</a></h1><p class="genres-line">${esc(genreNames(m))}</p><div class="hero-actions">${trailerLink(m)}<button class="circle-button" data-save="${keyOf(m)}" aria-label="Añadir a Mi lista">${icon("plus")}</button></div></div></section>`;
    document.querySelectorAll("[data-hero]").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.hero) === i);
      b.setAttribute("aria-pressed", String(Number(b.dataset.hero) === i));
    });
    hydrate();
    state.heroIndex = i;
  }
  if (heroes.length) show(0);
  else
    $("#heroSlot").innerHTML = empty(
      "No hay destacados disponibles",
      "Explora las categorías o vuelve a consultar con conexión.",
      "movie",
    );
  document
    .querySelectorAll("[data-hero]")
    .forEach((b) => (b.onclick = () => show(Number(b.dataset.hero))));
}
