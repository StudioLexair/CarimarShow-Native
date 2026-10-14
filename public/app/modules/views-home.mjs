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

const HERO_AUTOPLAY_MS = 6000;
let cleanupHeroCarousel = null;

export async function home(rev) {
  cleanupHeroCarousel?.();
  cleanupHeroCarousel = null;
  const results = await Promise.allSettled([
    api("trending/all/day"),
    api("trending/all/week"),
    api("movie/now_playing"),
  ]);
  if (results.every((r) => r.status === "rejected")) throw results[0].reason;
  const [today, week, fresh] = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { results: [], _unavailable: true, _error: r.reason.message },
  );
  if (rev !== state.routeRevision) return;
  const mediaItems = (data) =>
    (data.results || []).filter((m) => kind(m) !== "person");
  const todayItems = mediaItems(today),
    weekItems = mediaItems(week),
    newItems = (fresh.results || []).map((m) => ({
      ...m,
      media_type: "movie",
    }));

  // Hasta seis destacados únicos salen de TMDB: primero tendencias de hoy,
  // y se completa con esta semana si el feed diario trae menos fondos.
  const heroKeys = new Set();
  const heroes = [...todayItems, ...weekItems]
    .filter((m) => {
      const key = keyOf(m);
      if (!m.backdrop_path || heroKeys.has(key)) return false;
      heroKeys.add(key);
      return true;
    })
    .slice(0, 6);
  remember([...todayItems, ...weekItems, ...newItems, ...heroes]);
  state.heroIndex = 0;

  const trendMarkup = (data, list) =>
    `${offlineNote(data._offline ? data : null)}${data._unavailable ? empty("No se pudieron consultar las tendencias", data._error || "Vuelve a intentarlo cuando haya conexión.", "offline") + '<button class="secondary" data-retry>Reintentar</button>' : list.length ? cards(list.slice(0, 12), true) : empty("Sin tendencias disponibles", data._offline ? "No hay títulos guardados para este periodo." : "La consulta terminó sin títulos para este periodo.", "movie")}`;
  const feed = (label, link, list, data) =>
    `<section>${section(label, link)}${offlineNote(data._offline ? data : null)}${data._unavailable ? empty("No se pudo consultar esta sección", data._error, "offline") + '<button class="secondary" data-retry>Reintentar</button>' : list.length ? cards(list, true) : empty("Sin títulos en esta selección", data._offline ? "No hay títulos en los datos locales de esta sección. Consulta de nuevo con conexión." : "La consulta terminó sin títulos para esta sección.", "movie")}</section>`;

  const trendsSection = (period, label, data, list) =>
    `<section class="home-trend-section" data-home-trends="${period}">${section(label, `#browse/trending/${period}`)}<div id="homeTrend${period === "day" ? "Day" : "Week"}Results" aria-live="polite">${trendMarkup(data, list)}</div></section>`;

  setView(
    `<div class="hero-slider" role="region" aria-roledescription="carrusel" aria-label="Destacados de TMDB"><div id="heroSlot" aria-live="off"></div>${heroes.length > 1 ? `<div class="slider-dots" role="group" aria-label="Elegir destacado">${heroes.map((m, i) => `<button type="button" data-hero="${i}" class="${i === 0 ? "active" : ""}" aria-label="Mostrar destacado ${i + 1} de ${heroes.length}: ${esc(title(m))}" aria-pressed="${i === 0}"></button>`).join("")}</div>` : ""}</div><div class="home-sections">${trendsSection("day", "Tendencias de hoy", today, todayItems)}${trendsSection("week", "Tendencias de esta semana", week, weekItems)}${feed("Nuevos lanzamientos", "#browse/new", newItems.slice(0, 12), fresh)}<section>${section("Series para descubrir", "#browse/tv")}${weekItems.some((m) => kind(m) === "tv") ? cards(weekItems.filter((m) => kind(m) === "tv").slice(0, 9), true) : empty("Sin series en esta selección", week._unavailable ? "No se pudo consultar la selección. Las categorías siguen disponibles." : "Puedes explorar más series desde la categoría Series.", "tv")}</section><section>${section("Tu lista", "#list")}${state.list.length ? cards(state.list.slice(0, 9), true) : empty("Guarda tu próxima historia", "Toca + en un título para encontrarlo aquí.")}</section></div>${legal()}`,
  );

  const slider = document.querySelector(".hero-slider"),
    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let heroTimer = null,
    pausedByPointer = false;
  const stopTimer = () => {
    window.clearTimeout(heroTimer);
    heroTimer = null;
  };
  const scheduleNext = () => {
    stopTimer();
    if (heroes.length < 2 || pausedByPointer || document.hidden || reducedMotion?.matches) return;
    heroTimer = window.setTimeout(
      () => show((state.heroIndex + 1) % heroes.length),
      HERO_AUTOPLAY_MS,
    );
  };
  const pauseOnMouse = (event) => {
    if (event.pointerType !== "mouse") return;
    pausedByPointer = true;
    stopTimer();
  };
  const resumeOnMouse = (event) => {
    if (event.pointerType !== "mouse") return;
    pausedByPointer = false;
    scheduleNext();
  };
  const onVisibilityChange = () =>
    document.hidden ? stopTimer() : scheduleNext();
  const onRouteChange = () => {
    if (location.hash && location.hash !== "#home") cleanupHeroCarousel?.();
  };
  const onMotionChange = (event) =>
    event.matches ? stopTimer() : scheduleNext();

  function show(i) {
    const m = heroes[i];
    if (!m) return;
    $("#heroSlot").innerHTML =
      `<section class="hero" role="group" aria-roledescription="diapositiva" aria-label="Destacado ${i + 1} de ${heroes.length}">${image(m.backdrop_path, "w780", "", "hero-image")}<div class="hero-content"><span class="type-pill">${kind(m) === "tv" ? "Serie" : "Película"}</span><h1><a href="#detail/${kind(m)}/${m.id}">${esc(title(m))}</a></h1><p class="genres-line">${esc(genreNames(m))}</p><div class="hero-actions">${trailerLink(m)}<button class="circle-button" data-save="${keyOf(m)}" aria-label="Añadir a Mi lista">${icon("plus")}</button></div></div></section>`;
    document.querySelectorAll("[data-hero]").forEach((b) => {
      const active = Number(b.dataset.hero) === i;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    hydrate();
    state.heroIndex = i;
    scheduleNext();
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
  slider?.addEventListener("pointerenter", pauseOnMouse);
  slider?.addEventListener("pointerleave", resumeOnMouse);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("hashchange", onRouteChange);
  if (typeof reducedMotion?.addEventListener === "function")
    reducedMotion.addEventListener("change", onMotionChange);
  else reducedMotion?.addListener?.(onMotionChange);
  cleanupHeroCarousel = () => {
    stopTimer();
    slider?.removeEventListener("pointerenter", pauseOnMouse);
    slider?.removeEventListener("pointerleave", resumeOnMouse);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("hashchange", onRouteChange);
    if (typeof reducedMotion?.removeEventListener === "function")
      reducedMotion.removeEventListener("change", onMotionChange);
    else reducedMotion?.removeListener?.(onMotionChange);
    cleanupHeroCarousel = null;
  };
  scheduleNext();
}
