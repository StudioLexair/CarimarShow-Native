import { urls, hydrate, image } from "./ui-images.mjs";
import { view } from "./ui-dom.mjs";
import { icon } from "./ui-icons.mjs";
import {
  esc,
  kind,
  title,
  keyOf,
  year,
  trailerList,
  duration,
  listStatusOptions,
  normalizeListStatus,
} from "./core-model.mjs";
import { remember } from "./services-library.mjs";
import { state } from "./core-state.mjs";
import { genres } from "./services-fallback.mjs";
export function setView(html) {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear();
  view.innerHTML = html;
  hydrate();
}

export function offlineNote(value) {
  if (!value) return "";
  const data = typeof value === "object" ? value : null;
  const date = data?._sourceDate || data?._contentSavedAt;
  const stamp =
    date && Number.isFinite(Date.parse(date))
      ? " Guardado: " + new Date(date).toLocaleDateString("es-ES") + "."
      : "";
  const retry =
    typeof navigator !== "undefined" && navigator.onLine
      ? ' <button type="button" class="text-button" data-retry>Reintentar ahora</button>'
      : "";
  return `<div class="notice offline-note" data-offline-note="true" aria-live="polite">No pudimos actualizar desde Internet. Mostramos información local.${esc(stamp)} Puedes volver a consultar cuando haya conexión.${retry}</div>`;
}
export function empty(h, p, i = "bookmark") {
  return `<div class="empty">${icon(i)}<h2>${esc(h)}</h2><p>${esc(p)}</p></div>`;
}

export function head(h, back) {
  return `<div class="page-head">${back ? `<a data-back class="back" href="${back}">${icon("back")}${esc(h)}</a>` : `<h1>${esc(h)}</h1>`}</div>`;
}

export function section(h, to) {
  return `<div class="section-head"><h2>${esc(h)}</h2>${to ? `<a href="${to}">Ver todo ${icon("arrow")}</a>` : ""}</div>`;
}

export function card(m) {
  if (kind(m) === "person")
    return `<a class="person-card" href="#person/${m.id}"><div class="poster-box">${image(m.profile_path, "w185", m.name)}</div><strong>${esc(m.name)}</strong><small>${esc(m.known_for_department || "Actuación")}</small></a>`;
  const score = Number(m.vote_average),
    rating =
      Number.isFinite(score) && score > 0
        ? `<span class="card-rating" aria-label="Valoración TMDB ${score.toFixed(1)} sobre 10">★ ${score.toFixed(1)}</span>`
        : "";
  return `<article class="card"><div class="poster-box"><a class="poster-link" href="#detail/${kind(m)}/${m.id}" aria-label="Ver ${esc(title(m))}">${image(m.poster_path, "w342", title(m))}</a><button class="save" data-save="${keyOf(m)}" aria-label="Añadir a Mi lista">${icon("plus")}</button></div><h3><a href="#detail/${kind(m)}/${m.id}">${esc(title(m))}</a></h3><div class="subtitle"><span>${kind(m) === "tv" ? "Serie" : "Película"}</span><time>${year(m)}</time>${rating}</div></article>`;
}

export function cards(items, rail = false) {
  remember(items);
  return `<div class="${rail ? "rail" : "grid"}">${items.map(card).join("")}</div>`;
}

export function genreNames(m) {
  const d = state.seed.details[`${kind(m)}/${m.id}`],
    gs =
      d?.genres || genres().filter((g) => (m.genre_ids || []).includes(g.id));
  return (
    gs
      .slice(0, 3)
      .map((g) => g.name)
      .join(" · ") || `${kind(m) === "tv" ? "Serie" : "Película"} · ${year(m)}`
  );
}

export function trailerLink(m, d) {
  const v = trailerList(d || state.seed.details[`${kind(m)}/${m.id}`] || {})[0];
  return v
    ? `<a class="primary" href="https://www.youtube.com/watch?v=${esc(v.key)}" target="_blank" rel="noopener">${icon("play")}Ver tráiler</a>`
    : `<a class="primary" href="#detail/${kind(m)}/${m.id}/trailers">${icon("play")}Ver tráiler</a>`;
}

export function legal() {
  return '<p class="legal"><a href="#credits">Información y créditos</a> · <a href="#privacy">Privacidad</a><br>Catálogo informativo. No reproduce películas.</p>';
}
export function trendRow(m) {
  return `<a class="trend-item" href="#${kind(m) === "person" ? "person/" + m.id : "detail/" + kind(m) + "/" + m.id}">${image(m.poster_path || m.profile_path, "w185", title(m))}<span class="title-copy"><strong>${esc(title(m))}</strong><small>${kind(m) === "tv" ? "Serie" : kind(m) === "person" ? "Persona" : "Película"}</small></span>${icon("arrow")}</a>`;
}

export function cast(p) {
  return `<a class="cast-person" href="#person/${p.id}">${image(p.profile_path, "w185", p.name)}<strong>${esc(p.name)}</strong><small>${esc(p.character || p.known_for_department || "Actuación")}</small></a>`;
}

export function titleRows(items, download = false, trackStatus = false) {
  remember(items);
  return `<div class="title-list">${items
    .map((m) => {
      const d = state.seed.details[`${kind(m)}/${m.id}`] || m,
        pin = state.downloadMap.get(keyOf(m)),
        status = normalizeListStatus(m, m.listStatus),
        statusControl = trackStatus
          ? `<label class="list-status"><span>Estado</span><select data-list-status="${esc(keyOf(m))}" aria-label="Estado de seguimiento de ${esc(title(m))}">${listStatusOptions(m)
              .map(
                (option) =>
                  `<option value="${esc(option)}"${option === status ? " selected" : ""}>${esc(option)}</option>`,
              )
              .join("")}</select></label>`
          : "";
      return `<article class="title-row"><a href="#detail/${kind(m)}/${m.id}">${image(m.poster_path, "w185", title(m))}</a><div class="title-copy"><h3><a href="#detail/${kind(m)}/${m.id}">${esc(title(m))}</a></h3><span class="kind">${kind(m) === "tv" ? "Serie" : "Película"}</span><span class="metadata">${year(m)}${d.runtime || d.number_of_seasons ? " · " + duration(d) : ""}</span>${download && pin ? `<span class="download-badge">${icon("check")}Ficha offline · ${(pin.bytes / 1024 / 1024).toFixed(1)} MB</span>` : ""}${statusControl}</div><button class="plain-icon" data-menu="${keyOf(m)}" aria-label="Opciones de ${esc(title(m))}">${icon("dots")}</button></article>`;
    })
    .join("")}</div>`;
}

export function menuRow(label, to, i = "arrow", note = "") {
  return `<a class="menu-row" href="${to}">${icon(i)}<span>${esc(label)}</span>${note ? `<small>${esc(note)}</small>` : ""}${icon("arrow")}</a>`;
}
