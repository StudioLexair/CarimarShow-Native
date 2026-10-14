import { state } from "./core-state.mjs";
import { $ } from "./ui-dom.mjs";
import { closeSheet } from "./ui-sheet.mjs";
import { setView, head, empty } from "./ui-components.mjs";
import { home } from "./views-home.mjs";
import { explore } from "./views-explore.mjs";
import { browse, genresPage, genreBrowse } from "./views-catalog.mjs";
import { detail } from "./views-detail.mjs";
import { person, filmography } from "./views-person.mjs";
import { listPage } from "./views-list.mjs";
import { profilePage, historyPage, followingPage } from "./views-profile.mjs";
import { downloadsPage } from "./views-downloads.mjs";
import {
  settings,
  support,
  privacy,
  cacheView,
  contact,
  developer,
  credits,
} from "./views-settings.mjs";
const contexts = new Map(),
  trail = [];
let index = -1,
  current = "";
export function goBack(fallback = "#home") {
  if (index > 0) history.back();
  else location.hash = fallback;
}
export async function route() {
  if (current)
    contexts.set(current, {
      scroll: scrollY,
      query: $("#query")?.value,
      searchType: state.searchType,
      tab: document.querySelector("[data-detail-tab].active")?.dataset
        .detailTab,
    });
  const hash = location.hash || "#home";
  if (trail[index - 1] === hash) index--;
  else if (trail[index + 1] === hash) index++;
  else if (trail[index] !== hash) {
    trail.splice(index + 1);
    trail.push(hash);
    index++;
  }
  current = hash;
  const context = contexts.get(hash),
    rev = ++state.routeRevision;
  state.searchRevision++;
  const p = (hash.slice(1) || "home").split("/"),
    name = p[0];
  $("#appHeader").classList.toggle("subpage", name !== "home");
  document.body.classList.toggle(
    "is-settings",
    ["settings", "cache", "contact", "developer", "credits"].includes(name),
  );
  document.body.classList.toggle(
    "is-personal",
    ["profile", "support", "history", "following", "downloads"].includes(name),
  );
  const nav = [
    "browse",
    "genres",
    "genre",
    "person",
    "filmography",
    "search",
    "explore",
  ].includes(name)
    ? "explore"
    : [
          "settings",
          "cache",
          "contact",
          "developer",
          "credits",
          "privacy",
        ].includes(name)
      ? "settings"
      : ["support", "history", "downloads", "following", "profile"].includes(
            name,
          )
        ? "profile"
        : name === "detail"
          ? "home"
          : name;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === nav);
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  closeSheet();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (
    ![
      "list",
      "profile",
      "settings",
      "history",
      "following",
      "downloads",
      "support",
      "privacy",
      "contact",
      "developer",
      "credits",
    ].includes(name)
  )
    setView('<div class="loading-state">Cargando información…</div>');
  try {
    if (name === "home") await home(rev);
    else if (name === "explore" || name === "search") {
      if (context?.searchType) state.searchType = context.searchType;
      await explore(
        rev,
        p[1] ? decodeURIComponent(p[1]) : context?.query || "",
      );
    } else if (name === "browse")
      await browse(p[1], rev, 1, null, "", p[2] || "day");
    else if (name === "genres") await genresPage(rev, p[1]);
    else if (name === "genre") {
      if (!["all", "movie", "tv"].includes(p[1]) || !/^\d+$/.test(p[2]))
        throw Error("Categoría inválida");
      await genreBrowse(p[1], rev, p[2], decodeURIComponent(p[3] || ""));
    } else if (name === "detail")
      await detail(p[1], p[2], rev, p[3] || context?.tab);
    else if (name === "person") await person(p[1], rev);
    else if (name === "filmography") await filmography(p[1], rev);
    else if (name === "list") {
      if (["tv", "movie"].includes(p[1])) state.listTab = p[1];
      listPage();
    } else if (name === "profile") profilePage();
    else if (name === "history") historyPage();
    else if (name === "following") followingPage();
    else if (name === "downloads") downloadsPage();
    else if (name === "settings") await settings();
    else if (name === "cache") await cacheView(p[1] || "all");
    else if (name === "contact") contact();
    else if (name === "developer") developer();
    else if (name === "credits") credits();
    else if (name === "support") support();
    else if (name === "privacy") privacy();
    else location.hash = "#home";
    if (rev === state.routeRevision && context)
      window.scrollTo({ top: context.scroll || 0, behavior: "instant" });
  } catch (e) {
    if (rev === state.routeRevision)
      setView(
        `${head("Volver al inicio", "#home")}${empty("Información no disponible", e.message, "offline")}<div class="more-wrap"><button class="primary" data-retry>Intentar de nuevo</button></div>`,
      );
  }
}
