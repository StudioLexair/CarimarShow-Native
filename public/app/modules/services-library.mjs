import { validAge } from "./storage-policy.mjs";
import { state } from "./core-state.mjs";
import {
  keyOf,
  esc,
  kind,
  moveWithinType,
  normalizeListStatus,
} from "./core-model.mjs";
import { $, toast } from "./ui-dom.mjs";
import { icon } from "./ui-icons.mjs";
import { localPut } from "./storage-local.mjs";
export function remember(items) {
  let changed = false;
  for (const m of items || [])
    if (m?.id) {
      if (
        !m._contentSavedAt &&
        state.seed.catalog.some((x) => keyOf(x) === keyOf(m))
      )
        m._contentSavedAt = state.seed.generatedAt;
      state.visible.set(keyOf(m), m);
      if (m._source === "network" && !m._offline) {
        for (const field of ["list", "history", "follows"]) {
          const i = state[field].findIndex((x) => keyOf(x) === keyOf(m));
          if (i >= 0) {
            state[field][i] = {
              ...state[field][i],
              ...m,
              _contentExpired: false,
            };
            changed = true;
          }
        }
      }
    }
  if (changed)
    for (const [field, key] of [
      ["list", "cs_list_v1"],
      ["history", "cs_history_v2"],
      ["follows", "cs_follow_v2"],
    ])
      localPut(key, state[field]);
}

export function getItem(k) {
  return (
    state.visible.get(k) ||
    state.list.find((m) => keyOf(m) === k) ||
    state.seed.catalog.find((m) => keyOf(m) === k) ||
    state.history.find((m) => keyOf(m) === k) ||
    state.downloadMap.get(k)?.item
  );
}

export function initials() {
  if (state.profile.name === "CarimarShow") return "CS";
  return (
    (state.profile.name || "CarimarShow")
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CS"
  );
}

export function updateAvatar() {
  $("#headerAvatar").innerHTML = state.profile.avatar
    ? `<img src="${esc(state.profile.avatar)}" alt="">`
    : esc(initials());
}

export function syncSaved() {
  document.querySelectorAll("[data-save]").forEach((b) => {
    const saved = state.list.some((m) => keyOf(m) === b.dataset.save);
    b.classList.toggle("saved", saved);
    b.innerHTML = icon(saved ? "check" : "plus");
    b.setAttribute(
      "aria-label",
      saved ? "Quitar de Mi lista" : "Añadir a Mi lista",
    );
    b.setAttribute("aria-pressed", String(saved));
  });
}

export function saveItem(m) {
  if (!m || kind(m) === "person") return;
  m = { ...m, _contentSavedAt: m._contentSavedAt || new Date().toISOString() };
  const exists = state.list.some((x) => keyOf(x) === keyOf(m)),
    next = exists
      ? state.list.filter((x) => keyOf(x) !== keyOf(m))
      : [
          {
            ...m,
            media_type: kind(m),
            listStatus: normalizeListStatus(m, m.listStatus),
          },
          ...state.list,
        ];
  if (localPut("cs_list_v1", next)) {
    state.list = next;
    syncSaved();
    toast(exists ? "Eliminado de Mi lista" : "Añadido a Mi lista");
  }
}

export function setListStatus(key, status) {
  const index = state.list.findIndex((item) => keyOf(item) === key);
  if (index < 0) return false;
  const current = state.list[index],
    listStatus = normalizeListStatus(current, status);
  if (current.listStatus === listStatus) return true;
  const next = [...state.list];
  next[index] = { ...current, listStatus };
  if (!localPut("cs_list_v1", next)) return false;
  state.list = next;
  toast("Estado actualizado: " + listStatus);
  return true;
}

export function logVisit(m) {
  const next = [
    { ...m, viewedAt: new Date().toISOString() },
    ...state.history.filter((x) => keyOf(x) !== keyOf(m)),
  ].slice(0, 60);
  if (localPut("cs_history_v2", next)) state.history = next;
}

export function expirePersonalMetadata() {
  const clean = (m, field) =>
    validAge(m._contentSavedAt || state.seed.generatedAt)
      ? m
      : {
          id: m.id,
          media_type: kind(m),
          _contentExpired: true,
          ...(field === "list"
            ? { listStatus: normalizeListStatus(m, m.listStatus) }
            : {}),
          ...(m.viewedAt ? { viewedAt: m.viewedAt } : {}),
        };
  for (const [field, key] of [
    ["list", "cs_list_v1"],
    ["history", "cs_history_v2"],
    ["follows", "cs_follow_v2"],
  ]) {
    state[field] = [
      ...new Map(
        state[field]
          .filter(
            (m) =>
              m &&
              Number.isInteger(m.id) &&
              m.id > 0 &&
              (field !== "list" || kind(m) !== "person"),
          )
          .map((m) => [keyOf(m), clean(m, field)]),
      ).values(),
    ];
    localPut(key, state[field]);
  }
}

export function reorderList(key, delta) {
  const next = moveWithinType(state.list, key, delta);
  if (next === state.list || !localPut("cs_list_v1", next)) return false;
  state.list = next;
  return true;
}
