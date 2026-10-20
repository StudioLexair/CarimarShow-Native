import { kind } from "./core-model.mjs";
import { getDetail } from "./services-details.mjs";
import { state } from "./core-state.mjs";
import { logVisit } from "./services-library.mjs";
import {
  trailerList,
  keyOf,
  esc,
  title,
  rating,
  year,
  duration,
  statusName,
} from "./core-model.mjs";
import {
  setView,
  trailerLink,
  offlineNote,
  section,
  cast,
  empty,
  cards,
} from "./ui-components.mjs";
import { image, hydrate } from "./ui-images.mjs";
import { icon } from "./ui-icons.mjs";
import { bindImageViewer } from "./ui-lightbox.mjs";
import { $ } from "./ui-dom.mjs";
import { api } from "./services-api.mjs";

function zoomableImage(className, path, size, alt, label) {
  const imageHtml = image(path, size, alt, className.includes("detail-poster") ? "detail-poster-image" : "detail-image"),
    original =
      typeof path === "string" && /^\/[\w.-]+$/.test(path)
        ? `https://image.tmdb.org/t/p/original${path}`
        : "";
  return original
    ? `<button type="button" class="${className}" data-image-zoom data-image-zoom-src="${esc(original)}" data-image-zoom-alt="${esc(label)}" aria-label="Ampliar ${esc(label)}">${imageHtml}<span class="image-zoom-hint" aria-hidden="true">${icon("expand")}</span></button>`
    : `<div class="${className}">${imageHtml}</div>`;
}

export async function detail(type, id, rev, initialTab = "description") {
  if (!["movie", "tv"].includes(type) || !/^\d+$/.test(id))
    throw Error("Ficha no válida");
  const d = await getDetail(type, id);
  if (rev !== state.routeRevision) return;
  logVisit(d);
  const originalTitle = type === "tv" ? d.original_name : d.original_title,
    localizedTitle = String(d.title || d.name || ""),
    originalTitleDiffers =
      typeof originalTitle === "string" &&
      originalTitle.trim() &&
      originalTitle.normalize("NFKC").trim().toLocaleLowerCase() !==
        localizedTitle.normalize("NFKC").trim().toLocaleLowerCase();
  const trailers = trailerList(d),
    selected = ["description", "cast", "trailers", "similar"].includes(
      initialTab,
    )
      ? initialTab
      : "description";
  const hasBackdrop = Boolean(d.backdrop_path);
  const detailPageClass = d.poster_path
    ? "detail-page has-detail-poster"
    : "detail-page";
  const visualClass = hasBackdrop
    ? "detail-visual"
    : "detail-visual detail-visual--poster-fallback";
  const backdropPath = d.backdrop_path || d.poster_path,
    backdropLabel = `${hasBackdrop ? "Banner" : "Imagen"} de ${title(d)}`,
    backdropMarkup = zoomableImage(
      "detail-backdrop",
      backdropPath,
      hasBackdrop ? "w780" : "w342",
      backdropLabel,
      backdropLabel,
    ),
    posterMarkup = d.poster_path
      ? zoomableImage(
          "detail-poster-frame",
          d.poster_path,
          "w500",
          `Póster de ${title(d)}`,
          `Póster de ${title(d)}`,
        )
      : "";
  setView(
    `<article class="${detailPageClass}"><div class="detail-layout"><div class="detail-hero-block"><div class="${visualClass}" data-has-backdrop="${hasBackdrop}">${backdropMarkup}${posterMarkup}<div class="floating-tools"><a data-back class="circle-button" href="#home" aria-label="Volver">${icon("back")}</a><div><button class="circle-button" data-share="${keyOf(d)}" aria-label="Compartir">${icon("share")}</button><button class="circle-button" data-save="${keyOf(d)}" aria-label="Guardar">${icon("plus")}</button></div></div></div><div class="detail-heading"><h1>${esc(title(d))}</h1>${Number(d.vote_count) > 0 ? `<div class="rating">★ ${rating(d)} <span>(${Number(d.vote_count).toLocaleString("es-ES")} valoraciones)</span></div>` : ""}<p class="detail-meta">${kind(d) === "tv" ? "Serie" : "Película"}${year(d) !== "—" ? " · " + year(d) : ""}${duration(d) !== "Duración no informada" ? " · " + duration(d) : ""}${
      d.genres?.length
        ? " · " +
          d.genres
            .slice(0, 3)
            .map((g) => esc(g.name))
            .join(" · ")
        : ""
    }</p><div class="detail-actions">${trailers.length ? trailerLink(d, d) : '<button class="primary" ' + (d._videoQueryFailed ? "data-retry" : "disabled") + ' title="Estado del tráiler">' + icon("play") + (d._videoQueryFailed ? "Tráiler no consultado: reintentar" : "Tráiler no disponible") + "</button>"}<button class="square-button" data-save="${keyOf(d)}" aria-label="Añadir a Mi lista">${icon("plus")}</button><button class="square-button" data-download="${keyOf(d)}" aria-label="Guardar ficha offline" title="Guardar ficha offline">${icon(state.downloadMap.has(keyOf(d)) ? "check" : "download")}</button></div></div></div><section class="detail-information" aria-label="Contenido de ${esc(title(d))}"><div class="detail-tabs" role="tablist" aria-label="Secciones de la ficha">${[
      ["description", "Descripción"],
      ["cast", "Reparto"],
      ["trailers", "Tráileres"],
      ["similar", "Similares"],
    ]
      .map(
        ([k, v]) =>
          `<button id="detailTab-${k}" type="button" role="tab" data-detail-tab="${k}" aria-controls="detailContent" aria-selected="${k === selected}" tabindex="${k === selected ? "0" : "-1"}" class="${k === selected ? "active" : ""}">${v}</button>`,
      )
      .join(
        "",
      )}</div><div id="detailContent" class="detail-content" role="tabpanel" aria-labelledby="detailTab-${selected}" tabindex="0"></div></section></div></article>`,
  );
  bindImageViewer(document.querySelector(".detail-visual"));
  let tabRevision = 0;
  async function show(tab) {
    const seq = ++tabRevision;
    document.querySelectorAll("[data-detail-tab]").forEach((b) => {
      const active = b.dataset.detailTab === tab;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    const c = $("#detailContent");
    if (!c) return;
    c.setAttribute("aria-labelledby", "detailTab-" + tab);
    if (tab === "description") {
      const site =
        d.homepage && /^https?:\/\//i.test(d.homepage) ? d.homepage : null;
      c.innerHTML =
        offlineNote(d._offline ? d : null) +
        section("Descripción") +
        `<p class="description">${esc(d.overview || "No hay sinopsis disponible en español para este título.")}</p>${section("Reparto principal")}${d.credits?.cast?.length ? `<div class="cast-rail">${d.credits.cast.slice(0, 8).map(cast).join("")}</div>` : '<p class="muted tiny">El reparto no está disponible en esta ficha.</p>'}<dl class="info-grid">${originalTitleDiffers ? `<div class="original-title"><dt>Título original</dt><dd lang="${/^[a-z]{2}$/i.test(d.original_language || "") ? esc(d.original_language) : "en"}">${esc(originalTitle.trim())}</dd></div>` : ""}<div><dt>Idioma original</dt><dd>${esc(d.original_language || "No informado")}</dd></div><div><dt>Estado</dt><dd>${esc(statusName(d.status))}</dd></div>${type === "tv" ? `<div><dt>Temporadas</dt><dd>${Number.isFinite(d.number_of_seasons) ? d.number_of_seasons : "No informado"}</dd></div><div><dt>Episodios</dt><dd>${Number.isFinite(d.number_of_episodes) ? d.number_of_episodes : "No informado"}</dd></div>` : ""}${site ? `<div><dt>Sitio oficial</dt><dd><a class="cyan" href="${esc(site)}" target="_blank" rel="noopener">Visitar ${icon("external")}</a></dd></div>` : ""}</dl>`;
    } else if (tab === "cast") {
      c.innerHTML = d.credits?.cast?.length
        ? `<div class="grid">${d.credits.cast.map((p) => `<a class="person-card" href="#person/${p.id}"><div class="poster-box">${image(p.profile_path, "w185", p.name)}</div><strong>${esc(p.name)}</strong><small>${esc(p.character)}</small></a>`).join("")}</div>`
        : empty(
            "Reparto no disponible",
            "Consulta esta ficha con conexión.",
            "people",
          );
    } else if (tab === "trailers") {
      c.innerHTML = trailers.length
        ? `<div class="trailer-list">${trailers.map((v) => `<a class="trailer-item" href="https://www.youtube.com/watch?v=${esc(v.key)}" target="_blank" rel="noopener">${icon("play")}<span>${esc(v.name)}<small class="muted" style="display:block">YouTube · ${esc(v.iso_639_1 || "")}</small></span>${icon("external")}</a>`).join("")}</div><p class="muted tiny" style="margin-top:15px">Se abren fuera de la aplicación. Necesitan conexión.</p>`
        : empty(
            d._videoQueryFailed
              ? "No se pudieron consultar los tráileres"
              : "No hay tráiler disponible",
            d._videoQueryFailed
              ? "Falló la conexión. Esto no significa que el título no tenga tráiler. Vuelve a consultar la ficha."
              : "No hay un tráiler de YouTube de este título en los datos disponibles.",
            "play",
          );
    } else {
      c.innerHTML =
        '<div class="loading-state">Consultando títulos similares…</div>';
      try {
        const r = await api(`${type}/${id}/similar`);
        if (rev !== state.routeRevision || seq !== tabRevision) return;
        const items = (r.results || []).map((m) => ({
          ...m,
          media_type: type,
        }));
        c.innerHTML =
          offlineNote(r._offline ? r : null) +
          (items.length
            ? cards(items)
            : empty(
                "No hay similares disponibles",
                "TMDB no devolvió títulos similares.",
                "movie",
              ));
      } catch (e) {
        if (rev !== state.routeRevision || seq !== tabRevision) return;
        c.innerHTML = empty("Similares no guardados", e.message, "offline");
      }
    }
    hydrate();
  }
  const tabButtons = Array.from(document.querySelectorAll("[data-detail-tab]"));
  tabButtons.forEach((button) => {
    button.onclick = () => show(button.dataset.detailTab);
  });
  document.querySelector(".detail-tabs")?.addEventListener("keydown", (event) => {
    const currentIndex = tabButtons.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabButtons.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabButtons.length - 1;
    else return;
    event.preventDefault();
    const next = tabButtons[nextIndex];
    next.focus();
    show(next.dataset.detailTab);
  });
  await show(selected);
}
