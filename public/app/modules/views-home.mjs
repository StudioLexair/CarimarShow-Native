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
  const [trending, fresh] = await Promise.all([
    api("trending/all/week"),
    api("movie/now_playing"),
  ]);
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
  setView(
    `${offlineNote(trending._offline ? trending : null)}<div class="hero-slider"><div id="heroSlot"></div><div class="slider-dots">${heroes.map((_, i) => `<button data-hero="${i}" class="${i === 0 ? "active" : ""}" aria-label="Destacado ${i + 1}"></button>`).join("")}</div></div><div class="home-sections"><section>${section("Tendencias", "#browse/trending")}${cards(items.slice(0, 12), true)}</section><section>${section("Nuevos lanzamientos", "#browse/new")}${cards(newItems.slice(0, 12), true)}</section><section>${section("Series para descubrir", "#browse/tv")}${cards(items.filter((m) => kind(m) === "tv").slice(0, 9), true)}</section><section>${section("Tu lista", "#list")}${state.list.length ? cards(state.list.slice(-9).reverse(), true) : empty("Guarda tu próxima historia", "Toca + en un título para encontrarlo aquí.")}</section></div>${legal()}`,
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
  show(0);
  document
    .querySelectorAll("[data-hero]")
    .forEach((b) => (b.onclick = () => show(Number(b.dataset.hero))));
}
