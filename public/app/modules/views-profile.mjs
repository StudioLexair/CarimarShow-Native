import { image } from "./ui-images.mjs";
import { state } from "./core-state.mjs";
import {
  setView,
  head,
  menuRow,
  titleRows,
  empty,
  cards,
} from "./ui-components.mjs";
import { esc, kind } from "./core-model.mjs";
import { initials, updateAvatar, remember } from "./services-library.mjs";
import { icon } from "./ui-icons.mjs";
import { $, toast } from "./ui-dom.mjs";
import { dbClear } from "./storage-cache.mjs";
import { sheet, closeSheet } from "./ui-sheet.mjs";
import { localPut } from "./storage-local.mjs";
export function profilePage() {
  const movies = state.list.filter((m) => kind(m) === "movie").length,
    tv = state.list.length - movies;
  const shortcut = (label, to, i, description, count = "") =>
    `<a class="personal-shortcut" href="${to}"><span class="shortcut-icon">${icon(i)}</span><span><strong>${label}</strong><small>${description}</small></span>${count !== "" ? `<b class="shortcut-count">${count}</b>` : icon("arrow")}</a>`;
  const previews = state.list.filter((m) => !m._contentExpired).slice(0, 3);
  setView(`<div class="personal-page profile-page"><header class="personal-title"><span class="personal-eyebrow">TU ESPACIO EN CARIMARSHOW</span><h1>Mi perfil</h1><p>Tus historias, tus favoritos. Todo a mano.</p></header>
  <section class="profile-hero"><div class="profile-head"><button class="profile-avatar" id="editProfileAvatar" aria-label="Editar foto y nombre">${state.profile.avatar ? `<img src="${esc(state.profile.avatar)}" alt="Tu foto de perfil">` : esc(initials())}<span class="avatar-edit">${icon("edit")}</span></button><div><span class="profile-local-badge">${icon("user")} Perfil local</span><h2>${esc(state.profile.name || "CarimarShow")}</h2><p>Tu universo, en este dispositivo.</p><button class="secondary" id="editProfile">${icon("edit")}Editar perfil</button></div></div><div class="profile-hero-decoration" aria-hidden="true">${icon("movie")}${icon("tv")}</div></section>
  <div class="profile-stats"><a href="#list/movie">${icon("movie")}<strong>${movies}</strong><small>Películas</small></a><a href="#list/tv">${icon("tv")}<strong>${tv}</strong><small>Series</small></a><a href="#following">${icon("people")}<strong>${state.follows.length}</strong><small>Actores seguidos</small></a></div>
  <div class="personal-layout"><section class="personal-card"><div class="personal-section-heading"><span><small>TU COLECCIÓN</small><h2>Lo que guardas</h2></span>${icon("bookmark")}</div>${shortcut("Mi Lista", "#list", "bookmark", "Películas y series para consultar", state.list.length)}${shortcut("Descargas (offline)", "#downloads", "download", "Fichas guardadas en este dispositivo", state.downloadMap.size)}${previews.length ? `<div class="profile-selection-preview">${previews.map((m) => `<a href="#detail/${kind(m)}/${m.id}" aria-label="Ver ${esc(m.title || m.name)}">${image(m.poster_path, "w185", m.title || m.name)}</a>`).join("")}<span>Tu próxima historia<br><a href="#list">Ver mi selección →</a></span></div>` : '<p class="personal-card-note">Guarda títulos con + para empezar tu selección.</p>'}</section>
  <section class="personal-card"><div class="personal-section-heading"><span><small>TU ACTIVIDAD</small><h2>A tu ritmo</h2></span>${icon("clock")}</div>${shortcut("Historial", "#history", "clock", "Retoma las fichas que visitaste", state.history.length)}${shortcut("Actores seguidos", "#following", "people", "Tus personas favoritas", state.follows.length)}<p class="personal-card-note">Estas cifras son de tu dispositivo. No son seguidores ni estadísticas sociales.</p></section>
  <section class="personal-card personal-tools"><div class="personal-section-heading"><span><small>A TU MANERA</small><h2>Preferencias y ayuda</h2></span>${icon("settings")}</div>${shortcut("Configuración", "#settings", "settings", "Caché, contactos e información")}${shortcut("Ayuda y soporte", "#support", "help", "Cómo funciona y cómo contactarnos")}${shortcut("Privacidad", "#privacy", "user", "Conoce cómo se guardan tus datos")}<button class="personal-shortcut" id="checkUpdate"><span class="shortcut-icon">${icon("download")}</span><span><strong>Actualizar CarimarShow</strong><small>${window.CARIMAR_CONFIG.apiOrigin ? "Ver instaladores disponibles" : "Buscar la versión web más reciente"}</small></span>${icon("arrow")}</button></section></div>
  <section class="personal-reset"><div>${icon("trash")}<span><strong>Restablecer mis datos</strong><small>Borra tu selección, perfil y fichas guardadas. Requiere confirmación.</small></span></div><button class="text-button danger" id="resetData">Restablecer</button></section><p class="profile-note">Sin registro · Sin contraseña · Datos locales<br>CarimarShow ${esc(window.CARIMAR_CONFIG.version)} · Studio Lexair</p></div>`);
  $("#checkUpdate").onclick = () => {
    if (window.CARIMAR_CONFIG.apiOrigin)
      window.open(
        "https://github.com/StudioLexair/CarimarShow-Native/releases/latest",
        "_blank",
        "noopener",
      );
    else location.href = "/app/?update=" + Date.now() + "#profile";
  };
  $("#editProfile").onclick = editProfile;
  $("#editProfileAvatar").onclick = editProfile;
  $("#resetData").onclick = async () => {
    if (
      !confirm(
        "¿Eliminar tu lista, perfil, historial, búsquedas, personas seguidas y fichas descargadas? Esta acción no se puede deshacer.",
      )
    )
      return;
    for (const k of [
      "cs_list_v1",
      "cs_list_sort_v1",
      "cs_list_tab_v1",
      "cs_catalog_type_v1",
      "cs_follow_v2",
      "cs_history_v2",
      "cs_recent_v2",
      "cs_profile_v2",
    ])
      localStorage.removeItem(k);
    for (const s of ["downloads", "pinnedImages", "api", "images"])
      await dbClear(s);
    state.list = [];
    state.listTab = "movie";
    state.follows = [];
    state.history = [];
    state.recents = [];
    state.profile = { name: "CarimarShow", avatar: "" };
    state.downloadMap.clear();
    updateAvatar();
    profilePage();
    toast("Datos locales restablecidos");
  };
}

export function editProfile() {
  sheet(
    `<h2>Tu perfil local</h2><form id="profileForm"><label for="profileName">Nombre</label><input id="profileName" maxlength="40" value="${esc(state.profile.name || "CarimarShow")}" required><label for="profilePhoto">Avatar (opcional)</label><input id="profilePhoto" type="file" accept="image/*"><p>No se sube a un servidor. Se guarda únicamente en este dispositivo.</p><div class="sheet-actions"><button class="primary">Guardar</button><button type="button" class="secondary" id="removeAvatar">Quitar foto</button></div></form>`,
  );
  let remove = false;
  $("#removeAvatar").onclick = () => {
    remove = true;
    $("#profilePhoto").value = "";
    toast("La foto se quitará al guardar");
  };
  $("#profileForm").onsubmit = async (e) => {
    e.preventDefault();
    const name = $("#profileName").value.trim();
    if (!name) return;
    let avatar = remove ? "" : state.profile.avatar;
    const file = $("#profilePhoto").files[0];
    if (file) {
      if (!file.type.startsWith("image/") || file.size > 10000000)
        return toast("Elige una imagen de menos de 10 MB.");
      try {
        const bitmap = await createImageBitmap(file),
          canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d"),
          side = Math.min(bitmap.width, bitmap.height);
        ctx.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          256,
          256,
        );
        avatar = canvas.toDataURL("image/jpeg", 0.8);
        bitmap.close();
      } catch {
        return toast("No se pudo leer la imagen. Prueba un JPG o PNG.");
      }
    }
    const next = { name, avatar };
    if (localPut("cs_profile_v2", next)) {
      state.profile = next;
      updateAvatar();
      closeSheet();
      profilePage();
      toast("Perfil guardado");
    }
  };
}

export function historyPage() {
  setView(
    `<div class="personal-page">${head("Historial", "#profile")}<p class="personal-subtitle">Las historias que has ido descubriendo.</p><div class="section-head"><h2>Fichas consultadas</h2><button class="text-button" id="clearHistory">Limpiar</button></div>${state.history.length ? titleRows(state.history) : empty("Tu historial empieza aquí", "Las fichas que abras aparecerán en esta sección.", "clock")}</div>`,
  );
  $("#clearHistory").onclick = () => {
    if (
      confirm("¿Borrar el historial de fichas consultadas?") &&
      localPut("cs_history_v2", [])
    ) {
      state.history = [];
      historyPage();
    }
  };
}

export function followingPage() {
  remember(state.follows.map((p) => ({ ...p, media_type: "person" })));
  setView(
    `<div class="personal-page">${head("Actores seguidos", "#profile")}<p class="personal-subtitle">Tu selección de personas, guardada en este dispositivo.</p>${state.follows.length ? cards(state.follows.map((p) => ({ ...p, media_type: "person" }))) : empty("Sigue a tus actores favoritos", "Abre una persona y toca Seguir.", "people")}</div>`,
  );
}
