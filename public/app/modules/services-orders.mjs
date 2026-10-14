import { BUSINESS } from "./core-config.mjs";
import { kind, keyOf, title } from "./core-model.mjs";
export function uniqueSelection(items) {
  const seen = new Set();
  return items.filter((m) => {
    const k = keyOf(m);
    if (
      !Number.isInteger(m.id) ||
      !["movie", "tv"].includes(kind(m)) ||
      seen.has(k)
    )
      return false;
    seen.add(k);
    return true;
  });
}
export function orderMessage(items) {
  const list = uniqueSelection(items);
  if (!list.length) return "";
  const lines = ["Hola, CarimarShow. Quiero consultar este pedido.", ""];
  for (const [type, label] of [
    ["movie", "Películas"],
    ["tv", "Series"],
  ]) {
    const group = list.filter((m) => kind(m) === type);
    if (!group.length) continue;
    lines.push(label + ":");
    group.forEach((m, i) => {
      const y = (m.release_date || m.first_air_date || "").slice(0, 4);
      lines.push(
        `${i + 1}. ${title(m).replace(/\s+/g, " ").trim()}${/^\d{4}$/.test(y) ? " (" + y + ")" : ""}.`,
      );
    });
    lines.push("");
  }
  lines.push(`Total de títulos: ${list.length}.`);
  return lines.join("\n");
}
export function whatsappChoices(items, message = orderMessage(items)) {
  return BUSINESS.contacts.map((c) => ({
    ...c,
    url: "https://wa.me/" + c.digits + "?text=" + encodeURIComponent(message),
  }));
}
