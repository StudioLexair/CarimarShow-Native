import { getPerson } from "./services-details.mjs";
import { state } from "./core-state.mjs";
import { remember } from "./services-library.mjs";
import {
  setView,
  offlineNote,
  section,
  cards,
  head,
  empty,
} from "./ui-components.mjs";
import { image } from "./ui-images.mjs";
import { icon } from "./ui-icons.mjs";
import {
  esc,
  kind,
  personCreditRole,
  personFilmography,
  title,
  year,
} from "./core-model.mjs";
import { $, toast } from "./ui-dom.mjs";
import { localPut } from "./storage-local.mjs";
function filmographyScope(person) {
  if (person.known_for_department === "Acting")
    return "Créditos de actuación en películas y series; se omiten documentales, noticias, telerrealidad y apariciones de autopresentación o como invitado.";
  if (!person.known_for_department)
    return "Créditos principales de películas y series; se omiten documentales, noticias, telerrealidad y apariciones de autopresentación o como invitado.";
  return `Créditos del área ${person.known_for_department}.`;
}
function filmographyCards(items) {
  return `<div class="filmography-list" role="list">${items
    .map((credit) => {
      const releaseYear = year(credit),
        creditTitle = title(credit),
        label = personCreditRole(credit),
        mediaLabel = kind(credit) === "tv" ? "Serie" : "Película",
        yearLabel = releaseYear === "—" ? "Año sin informar" : releaseYear,
        accessibleLabel = [creditTitle, yearLabel, mediaLabel, label]
          .filter(Boolean)
          .join(" · ");
      return `<article class="filmography-card" role="listitem"><a class="filmography-card-link" href="#detail/${kind(credit)}/${credit.id}" aria-label="Abrir ${esc(accessibleLabel)}"><span class="filmography-poster-wrap">${image(credit.poster_path, "w342", "Portada de " + creditTitle, "filmography-poster")}<span class="filmography-year"${releaseYear !== "—" ? ` data-year="${esc(releaseYear)}"` : ""}>${esc(releaseYear)}</span></span><span class="filmography-card-copy"><span class="filmography-title">${esc(creditTitle)}</span><span class="filmography-meta"><span class="filmography-type">${mediaLabel}</span>${label ? `<span class="filmography-role"> · ${esc(label)}</span>` : ""}</span></span></a></article>`;
    })
    .join("")}</div>`;
}
export async function person(id, rev) {
  if (!/^\d+$/.test(id)) throw Error("Persona no válida");
  const { person: p, credits: c } = await getPerson(id);
  if (rev !== state.routeRevision) return;
  const items = personFilmography(p, c);
  remember(items);
  const born =
    p.birthday && !Number.isNaN(Date.parse(p.birthday))
      ? new Intl.DateTimeFormat("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(p.birthday + "T12:00:00Z"))
      : "";
  const following = state.follows.some((x) => x.id === p.id);
  setView(
    `<article><div class="actor-visual">${image(p.profile_path, "h632", p.name, "actor-cover")}<div class="floating-tools"><a data-back class="circle-button" href="#explore" aria-label="Volver">${icon("back")}</a><button class="circle-button" data-share-person="${p.id}" aria-label="Compartir actor">${icon("share")}</button></div></div><div class="actor-title">${image(p.profile_path, "w185", p.name, "actor-photo")}<div><h1>${esc(p.name)}</h1><p>${esc(p.known_for_department === "Acting" ? "Actor / actriz" : p.known_for_department || "Profesional audiovisual")}${born ? "<br>Nacimiento: " + esc(born) : ""}${p.place_of_birth ? "<br>" + esc(p.place_of_birth) : ""}</p></div></div><div class="actor-actions"><button class="primary" id="followActor">${following ? "Siguiendo" : "Seguir"}</button><a class="secondary" href="#filmography/${p.id}">Ver filmografía</a></div>${offlineNote(c._offline && !c._unavailable ? c : p._offline ? p : null)}${c._unavailable ? '<p class="notice">La filmografía no pudo consultarse y no está guardada. Esto no significa que no haya títulos. <button class="text-button" data-retry>Reintentar</button></p>' : ""}${section("Películas y series", "#filmography/" + p.id)}${cards(items.slice(0, 9), true)}${section("Información")}<p class="bio clamped" id="biography">${esc(p.biography || "TMDB no tiene una biografía en español para esta persona.")}</p>${p.biography ? '<button class="text-button" id="expandBio">Leer más</button>' : ""}<p class="muted tiny filmography-note">${esc(filmographyScope(p))} ${items.length} títulos en la filmografía disponible.</p></article>`,
  );
  $("#followActor").onclick = () => {
    const exists = state.follows.some((x) => x.id === p.id),
      next = exists
        ? state.follows.filter((x) => x.id !== p.id)
        : [
            ...state.follows,
            {
              ...p,
              media_type: "person",
              _contentSavedAt: p._contentSavedAt || state.seed.generatedAt,
            },
          ];
    if (localPut("cs_follow_v2", next)) {
      state.follows = next;
      $("#followActor").textContent = exists ? "Seguir" : "Siguiendo";
      toast(
        exists
          ? "Has dejado de seguir a esta persona"
          : "Persona seguida en este dispositivo",
      );
    }
  };
  if ($("#expandBio"))
    $("#expandBio").onclick = () => {
      $("#biography").classList.toggle("clamped");
      $("#expandBio").textContent = $("#biography").classList.contains(
        "clamped",
      )
        ? "Leer más"
        : "Leer menos";
    };
}

export async function filmography(id, rev) {
  if (!/^[1-9]\d*$/.test(id)) throw Error("Persona no válida");
  const { person: p, credits: c } = await getPerson(id);
  if (rev !== state.routeRevision) return;
  const items = personFilmography(p, c);
  remember(items);
  const content = items.length
    ? `<p class="muted tiny filmography-note">${esc(filmographyScope(p))} Ordenada de más reciente a más antigua.</p>${filmographyCards(items)}`
    : empty(
        c._unavailable ? "Filmografía no guardada" : "Sin títulos disponibles",
        c._unavailable
          ? "No se pudo consultar. Conéctate y reintenta; no es una filmografía vacía."
          : "No hay filmografía en los datos disponibles.",
        "movie",
      ) +
      (c._unavailable ? '<button class="primary" data-retry>Reintentar</button>' : "");
  setView(
    `${head(p.name, "#person/" + id)}${offlineNote(c._offline && !c._unavailable ? c : p._offline ? p : null)}${section("Filmografía · " + items.length + " títulos")}${content}`,
  );
}
