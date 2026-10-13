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
import { esc, keyOf } from "./core-model.mjs";
import { $, toast } from "./ui-dom.mjs";
import { localPut } from "./storage-local.mjs";
export async function person(id, rev) {
  if (!/^\d+$/.test(id)) throw Error("Persona no válida");
  const { person: p, credits: c } = await getPerson(id);
  if (rev !== state.routeRevision) return;
  const seen = new Set(),
    items = (c.cast || [])
      .filter((m) => {
        const k = keyOf(m);
        if (m.adult || seen.has(k) || !m.poster_path) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
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
    `<article><div class="actor-visual">${image(p.profile_path, "h632", p.name, "actor-cover")}<div class="floating-tools"><a data-back class="circle-button" href="#explore" aria-label="Volver">${icon("back")}</a><button class="circle-button" data-share-person="${p.id}" aria-label="Compartir actor">${icon("share")}</button></div></div><div class="actor-title">${image(p.profile_path, "w185", p.name, "actor-photo")}<div><h1>${esc(p.name)}</h1><p>${esc(p.known_for_department === "Acting" ? "Actor / actriz" : p.known_for_department || "Profesional audiovisual")}${born ? "<br>Nacimiento: " + esc(born) : ""}${p.place_of_birth ? "<br>" + esc(p.place_of_birth) : ""}</p></div></div><div class="actor-actions"><button class="primary" id="followActor">${following ? "Siguiendo" : "Seguir"}</button><a class="secondary" href="#filmography/${p.id}">Ver filmografía</a></div>${offlineNote(p._offline ? p : null)}${c._unavailable ? '<p class="notice">La filmografía no pudo consultarse y no está guardada. Esto no significa que no haya títulos. <button class="text-button" data-retry>Reintentar</button></p>' : ""}${section("Películas y series", "#filmography/" + p.id)}${cards(items.slice(0, 9), true)}${section("Información")}<p class="bio clamped" id="biography">${esc(p.biography || "TMDB no tiene una biografía en español para esta persona.")}</p>${p.biography ? '<button class="text-button" id="expandBio">Leer más</button>' : ""}<p class="muted tiny">${items.length} títulos con póster en su filmografía disponible.</p></article>`,
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
  const seen = new Set(),
    items = [...(c.cast || []), ...(c.crew || [])]
      .filter((m) => {
        const k = keyOf(m);
        if (m.adult || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  remember(items);
  setView(
    `${head(p.name, "#person/" + id)}${offlineNote(c._offline ? c : null)}${section("Filmografía · " + items.length + " títulos")}${items.length ? cards(items) : empty(c._unavailable ? "Filmografía no guardada" : "Sin títulos disponibles", c._unavailable ? "No se pudo consultar. Conéctate y reintenta; no es una filmografía vacía." : "No hay filmografía en los datos disponibles.", "movie") + (c._unavailable ? '<button class="primary" data-retry>Reintentar</button>' : "")}`,
  );
}
