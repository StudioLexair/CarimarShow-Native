import { toast } from "./ui-dom.mjs";
export function readLocal(k, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function localPut(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch {
    toast("No hay espacio disponible para guardar los cambios.");
    return false;
  }
}

// Accept the unquoted preferences written by 2.1.0 as well as current JSON.
export function readChoice(key, choices, fallback) {
  try {
    const raw = localStorage.getItem(key);
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
    return choices.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
