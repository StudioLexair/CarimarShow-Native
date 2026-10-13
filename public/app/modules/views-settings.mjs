import { urls } from "./ui-images.mjs";
import { state } from "./core-state.mjs";
import { BUSINESS, DEVELOPER, BASE } from "./core-config.mjs";
import { esc, kind, title } from "./core-model.mjs";
import { $, toast } from "./ui-dom.mjs";
import { icon } from "./ui-icons.mjs";
import { setView, head, menuRow } from "./ui-components.mjs";
import { cacheStats, dbClear, dbDelete } from "./storage-cache.mjs";
import { copyText, install } from "./services-platform.mjs";
export const formatBytes = (n) =>
  n < 1024 * 1024
    ? (n / 1024).toFixed(1) + " KiB"
    : (n / 1024 / 1024).toFixed(1) + " MiB";
const top = (name, description, i, color, href) =>
  `<a class="settings-card-head" href="${href}"><span class="settings-badge ${color}">${icon(i)}</span><span><strong>${name}</strong><small>${description}</small></span>${icon("arrow")}</a>`;
export function businessContent() {
  return `<div class="business-layout"><img class="business-logo" src="${BUSINESS.logo}" alt="Logo original de CarimarShow"><div class="business-lines"><button class="business-line copy-address" id="copyAddress">${icon("location")}<span>${esc(BUSINESS.address)}<small>Copiar dirección</small></span></button><div class="business-line">${icon("clock")}<span>${esc(BUSINESS.hours)}</span></div><div class="business-line">${icon("phone")}<span>${BUSINESS.contacts.map((c) => `<a href="tel:+${c.digits}">${c.label}</a>`).join(" · ")}</span></div><a class="business-line" href="mailto:${BUSINESS.email}">${icon("mail")}<span>${BUSINESS.email}</span></a><div class="business-whatsapp">${BUSINESS.contacts.map((c, i) => `<a class="secondary small" href="https://wa.me/${c.digits}" target="_blank" rel="noopener">WhatsApp ${i + 1} · ${c.label}</a>`).join("")}</div></div></div>`;
}
export function developerContent() {
  return `<div class="developer-layout"><img class="developer-logo" src="${DEVELOPER.logo}" alt="Logotipo original de Studio Lexair, desarrollo digital a tu medida"><p>${DEVELOPER.description}</p></div><div class="developer-contacts"><a href="tel:+${DEVELOPER.digits}">${icon("phone")}${DEVELOPER.phone}</a><a href="mailto:${DEVELOPER.email}">${icon("mail")}${DEVELOPER.email}</a></div><div class="developer-promo"><span class="promo-light">${icon("idea")}</span><div><strong>¿Tienes una idea para tu negocio?</strong><p>En Studio Lexair desarrollamos aplicaciones, catálogos digitales y soluciones de software adaptadas a tus necesidades.</p></div><div class="promo-actions"><a class="contact-green" href="https://wa.me/${DEVELOPER.digits}" target="_blank" rel="noopener">Contactar con Studio Lexair</a><a class="contact-purple" href="mailto:${DEVELOPER.email}">${icon("mail")}Enviar correo electrónico</a></div></div>`;
}
export async function settings() {
  const movies = state.list.filter((m) => kind(m) === "movie").length,
    tv = state.list.length - movies;
  setView(`<div class="settings-page"><header class="settings-title">${icon("settings")}<div><h1>Configuración</h1><p>Personaliza tu experiencia en CarimarShow</p></div></header>
 <section class="settings-card">${top("Lo que sigues", "Tus películas y series favoritas", "bookmark", "purple", "#list")}<div class="settings-summary"><a href="#list/movie"><small>Películas</small><strong>${movies}</strong></a><a href="#list/tv"><small>Series</small><strong>${tv}</strong></a><a href="#list"><small>Total</small><strong>${state.list.length}</strong></a></div><div class="settings-distribution" role="img" aria-label="${movies} películas, ${tv} series"><span style="width:${state.list.length ? (movies / state.list.length) * 100 : 0}%"></span></div></section>
 <section class="settings-card">${top("Administración de datos", "Gestiona el almacenamiento y la caché", "database", "green", "#cache/all")}<div class="settings-data">${menuRow("Datos en caché", "#cache/data", "database", "Ver y limpiar metadatos")}${menuRow("Imágenes en caché", "#cache/images", "image", "Gestionar imágenes guardadas")}<button class="menu-row" id="clearCache">${icon("trash")}<span>Limpiar toda la caché automática<small>Tu lista y descargas se conservan</small></span>${icon("arrow")}</button></div><p class="storage-stat" id="storageInfo">Calculando almacenamiento…</p></section>
 <section class="settings-card">${top("Datos del negocio", "Contacto y ubicación de CarimarShow", "shop", "blue", "#contact")}${businessContent()}</section>
 <section class="settings-card">${top("Datos del desarrollador", "Desarrollado por Studio Lexair", "code", "violet", "#developer")}${developerContent()}</section>
 <section class="settings-card credits-card">${top("Información de TMDB", "Datos proporcionados por The Movie Database", "movie", "teal", "#credits")}</section>
 <div class="settings-install"><button class="secondary small" id="installApp">Instalar versión web</button><a class="secondary small" href="https://github.com/StudioLexair/CarimarShow-Native/releases/latest" target="_blank" rel="noopener">APK / Windows</a><a href="#privacy">Privacidad</a></div></div>`);
  $("#copyAddress").onclick = () => copyText(BUSINESS.address);
  $("#installApp").onclick = install;
  $("#clearCache").onclick = () => clearAutomatic(["api", "images"]);
  await storageInfo();
}
export async function clearAutomatic(stores) {
  if (
    !confirm(
      "¿Limpiar esta caché automática? Tu lista, perfil, historial y descargas explícitas NO se eliminan.",
    )
  )
    return false;
  const results = await Promise.all(stores.map(dbClear));
  if (results.every(Boolean)) {
    toast("Caché limpiada. Tu lista y descargas se conservan.");
    await storageInfo();
    return true;
  }
  toast("No se pudo completar la limpieza. Vuelve a intentarlo.");
  return false;
}
export async function storageInfo() {
  const target = $("#storageInfo");
  if (!target) return;
  const stats = await cacheStats();
  const logical = stats.api.bytes + stats.images.bytes;
  let physical = "";
  try {
    const estimate = await navigator.storage?.estimate();
    if (estimate)
      physical = ` Espacio total del origen: aproximadamente ${formatBytes(estimate.usage || 0)} (incluye archivos de la app y descargas).`;
  } catch {}
  if (target.isConnected)
    target.textContent = `Caché automática: ${stats.api.count} consultas y ${stats.images.count} imágenes, ${formatBytes(logical)} de contenido estimado.${physical}`;
}
function cacheLabel(row) {
  if (row.store === "images")
    return "Imagen guardada · " + String(row.key).split("/").pop();
  const query = new URLSearchParams(String(row.key)),
    path = query.get("path") || "";
  const data = row.value || {};
  if (data.title || data.name) return title(data);
  const names = {
    "trending/all/week": "Tendencias de la semana",
    "trending/all/day": "Tendencias de hoy",
    "movie/now_playing": "Estrenos en cartelera",
    "movie/popular": "Películas populares",
    "tv/popular": "Series populares",
    "person/popular": "Personas populares",
    "genre/movie/list": "Géneros de películas",
    "genre/tv/list": "Géneros de series",
  };
  let label = names[path];
  if (!label && path.startsWith("search/"))
    label = "Búsqueda · " + (query.get("query") || "Sin texto");
  if (!label && path.endsWith("/combined_credits"))
    label = "Filmografía · Persona " + path.split("/")[1];
  if (!label && path.endsWith("/videos"))
    label =
      "Tráileres · " +
      (path.startsWith("tv/") ? "Serie " : "Película ") +
      path.split("/")[1];
  if (!label && path.startsWith("discover/"))
    label =
      "Categoría · " +
      (path.startsWith("discover/tv") ? "Series" : "Películas");
  return (
    (label || "Consulta · " + path) +
    (query.get("page") ? " · Página " + query.get("page") : "")
  );
}
function cacheRow(row, index) {
  return `<article class="cache-entry">${row.store === "images" ? `<img class="cache-thumbnail" data-cache-image="${index}" alt="Vista previa de imagen guardada">` : ""}<div><strong>${esc(cacheLabel(row))}</strong><small>${formatBytes(row.bytes)} · Guardado ${new Date(row.savedAt).toLocaleDateString("es-ES")}</small><small>Caduca ${new Date(row.expiresAt).toLocaleDateString("es-ES")}</small></div><button class="plain-icon" data-cache-delete="${index}" aria-label="Eliminar ${esc(cacheLabel(row))}">${icon("trash")}</button></article>`;
}
export async function cacheView(type, rev = state.routeRevision) {
  const stats = await cacheStats(),
    stores =
      type === "data"
        ? ["api"]
        : type === "images"
          ? ["images"]
          : ["api", "images"];
  const rows = stores.flatMap((s) =>
    stats[s].entries.map((e) => ({ ...e, store: s })),
  );
  if (rev !== state.routeRevision) return;
  setView(
    `${head(type === "data" ? "Datos en caché" : type === "images" ? "Imágenes en caché" : "Administración de datos", "#settings")}<section class="panel"><h2>${rows.length} elementos automáticos</h2><p>${formatBytes(rows.reduce((n, r) => n + r.bytes, 0))} de contenido estimado. El almacenamiento real incluye índices y otros archivos. Esta limpieza no afecta Mi Lista, perfil, historial, descargas ni imágenes incluidas en el instalador.</p><button class="secondary" id="clearSelectedCache">Limpiar ${type === "data" ? "metadatos" : type === "images" ? "imágenes" : "toda la caché automática"}</button><p id="storageInfo"></p></section><div class="cache-entries">${rows.length ? rows.map(cacheRow).join("") : '<p class="muted">No hay elementos en esta caché.</p>'}</div><p class="muted tiny">Caducidad: caché automática 30 días; fichas e imágenes explícitas 150 días. Límites automáticos: 250 consultas / 12 MiB y 100 imágenes / 30 MiB. Descargas: hasta 100 fichas / 8 MiB de metadatos y 400 imágenes / 80 MiB. El dispositivo puede imponer una cuota menor.</p><a class="secondary" href="#downloads">Gestionar descargas explícitas</a>`,
  );
  document.querySelectorAll("[data-cache-image]").forEach((img) => {
    const row = rows[Number(img.dataset.cacheImage)];
    if (row.value instanceof Blob) {
      const url = URL.createObjectURL(row.value);
      urls.add(url);
      img.src = url;
    }
  });
  document.querySelectorAll("[data-cache-delete]").forEach(
    (button) =>
      (button.onclick = async () => {
        const row = rows[Number(button.dataset.cacheDelete)];
        if (
          !row ||
          !confirm(
            "¿Eliminar " +
              cacheLabel(row) +
              "? Tu lista y descargas se conservan.",
          )
        )
          return;
        button.disabled = true;
        const ok = await dbDelete(row.store, row.key);
        toast(
          ok
            ? "Elemento de caché eliminado."
            : "No se pudo eliminar el elemento.",
        );
        if (ok) await cacheView(type, rev);
        else if (button.isConnected) button.disabled = false;
      }),
  );
  $("#clearSelectedCache").onclick = async () => {
    if (await clearAutomatic(stores)) await cacheView(type, rev);
  };
  await storageInfo();
}
export function contact() {
  setView(
    `${head("Datos del negocio", "#settings")}<section class="settings-card">${businessContent()}</section>`,
  );
  $("#copyAddress").onclick = () => copyText(BUSINESS.address);
}
export function developer() {
  setView(
    `${head("Datos del desarrollador", "#settings")}<section class="settings-card">${developerContent()}</section>`,
  );
}
export function credits() {
  setView(
    `${head("Información y créditos", "#settings")}<section class="panel tmdb-credits"><a href="https://www.themoviedb.org" target="_blank" rel="noopener"><img src="${BASE}brand/tmdb.svg" alt="TMDB, The Movie Database"></a><h2>Datos e imágenes de TMDB</h2><p lang="en">This product uses the TMDB API but is not endorsed or certified by TMDB.</p><p lang="en">This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p><p>Esta aplicación utiliza TMDB y sus API, pero TMDB no la respalda, certifica ni aprueba. Los datos e imágenes pertenecen a sus titulares.</p><p>Las consultas y las imágenes guardadas tienen caducidad. Las descargas son fichas, no archivos de películas. Los recursos no guardados no están disponibles sin conexión.</p><a class="cyan" href="https://www.themoviedb.org/api-terms-of-use" target="_blank" rel="noopener">Condiciones de uso de TMDB →</a><p>CarimarShow ${esc(window.CARIMAR_CONFIG.version)} · Desarrollado por Studio Lexair.</p></section>`,
  );
}
export function support() {
  setView(
    `${head("Ayuda y soporte", "#profile")}<section class="panel"><h2>Contacta con CarimarShow</h2><p>Para disponibilidad y condiciones, consulta al negocio. Compartir una lista no confirma un pedido.</p>${BUSINESS.contacts.map((c) => menuRow("WhatsApp · " + c.label, "https://wa.me/" + c.digits, "phone")).join("")}${menuRow("Enviar correo", "mailto:" + BUSINESS.email, "mail")}</section><section class="panel"><h2>Sin conexión</h2><p>Puedes consultar contenido guardado dentro de su vigencia. Para novedades y tráileres necesitas Internet. No se descargan películas.</p><h2>Tu perfil</h2><p>Es local y no requiere registro. No hay sincronización entre dispositivos. Desinstalar puede eliminar tus datos.</p></section>`,
  );
}
export function privacy() {
  setView(
    `${head("Privacidad", "#settings")}<section class="panel"><h2>Tus datos permanecen en el dispositivo</h2><p>Perfil, avatar, lista, historial y personas seguidas se guardan localmente. Compartir un pedido envía únicamente el mensaje que tú eliges compartir al contacto seleccionado.</p><p>Las consultas online pasan por Vercel y TMDB. Estos proveedores pueden registrar información técnica según sus políticas. YouTube, WhatsApp y enlaces externos tienen sus propias políticas.</p><p>La caché automática conserva hasta 250 consultas / 12 MiB y 100 imágenes / 30 MiB durante hasta 30 días. Descargas y contenido incluido dejan de utilizarse al cumplir 150 días; deben actualizarse con conexión. El sistema puede borrar almacenamiento. Las imágenes no guardadas no se prometen offline.</p><p>Limpiar caché automática conserva la lista y las descargas. Restablecer datos elimina la información personal. Contacto: ${BUSINESS.email}.</p></section>`,
  );
}
