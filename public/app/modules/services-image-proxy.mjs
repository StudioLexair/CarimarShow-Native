const KEY_PATTERN = /^(w185|w342|w500|w780|h632)(\/[a-z0-9_-]{1,80}\.(?:jpe?g|png|webp))$/i;

export function imageProxyUrl(key, apiOrigin = globalThis.window?.CARIMAR_CONFIG?.apiOrigin || "") {
  if (typeof key !== "string") return "";
  const match = KEY_PATTERN.exec(key);
  if (!match) return "";
  const origin = String(apiOrigin).replace(/\/+$/, "");
  const query = new URLSearchParams({ size: match[1], path: match[2] });
  return `${origin}/api/tmdb-image?${query}`;
}
