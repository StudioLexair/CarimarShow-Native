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
  setView(
    `<div class="profile-page">${head("Perfil")}<div class="profile-head"><button class="profile-avatar" id="editProfileAvatar" aria-label="Editar perfil">${state.profile.avatar ? `<img src="${esc(state.profile.avatar)}" alt="Avatar personal">` : esc(initials())}</button><div><h2>${esc(state.profile.name || "CarimarShow")}</h2><p>Tu universo, en este dispositivo.</p><button class="text-button" id="editProfile">Editar perfil</button></div></div><div class="profile-stats"><a href="#list"><strong>${movies}</strong><small>Películas</small></a><a href="#list/tv"><strong>${tv}</strong><small>Series</small></a><a href="#following"><strong>${state.follows.length}</strong><small>Actores seguidos</small></a></div><div class="menu-list">${menuRow("Mi Lista", "#list", "bookmark")}${menuRow("Historial", "#history", "clock")}${menuRow("Descargas (offline)", "#downloads", "download", state.downloadMap.size ? state.downloadMap.size + " fichas" : "")}${menuRow("Configuración", "#settings", "settings")}${menuRow("Ayuda y soporte", "#support", "help")}<button class="menu-row danger" id="resetData">${icon("trash")}<span>Restablecer mis datos</span>${icon("arrow")}</button></div><p class="profile-note">Perfil local · Sin registro ni sesión.<br>CarimarShow ${esc(window.CARIMAR_CONFIG.version)} · Studio Lexair</p></div>`,
  );
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
    `${head("Historial", "#profile")}<div class="section-head"><h2>Fichas consultadas</h2><button class="text-button" id="clearHistory">Limpiar</button></div>${state.history.length ? titleRows(state.history) : empty("Tu historial empieza aquí", "Las fichas que abras aparecerán en esta sección.", "clock")}`,
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
    `${head("Actores seguidos", "#profile")}${state.follows.length ? cards(state.follows.map((p) => ({ ...p, media_type: "person" }))) : empty("Sigue a tus actores favoritos", "Abre una persona y toca Seguir.", "people")}`,
  );
}
