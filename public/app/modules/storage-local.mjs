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
