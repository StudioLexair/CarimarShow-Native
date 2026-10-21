import { esc } from "./core-model.mjs";
import { state } from "./core-state.mjs";
import { BASE } from "./core-config.mjs";
import { dbGet, dbPut } from "./storage-cache.mjs";
import { syncSaved } from "./services-library.mjs";
import { icons } from "./ui-icons.mjs";
import { imageProxyUrl } from "./services-image-proxy.mjs";

export const placeholder =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#0e4057"/><stop offset="1" stop-color="#041726"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" text-anchor="middle" fill="#4d829e" font-family="sans-serif" font-size="18">CarimarShow</text></svg>',
  );

const FALLBACK_SIZES = {
  w185: ["w342", "w500", "w780", "h632"],
  w342: ["w185", "w500", "w780", "h632"],
  w500: ["w342", "w185", "w780", "h632"],
  w780: ["w500", "w342", "w185", "h632"],
  h632: ["w780", "w500", "w342", "w185"],
};

function imageCacheKeys(key) {
  const match = /^(w185|w342|w500|w780|h632)(\/[\w.-]+)$/i.exec(
    String(key || ""),
  );
  if (!match) return [];
  const size = match[1].toLowerCase(),
    path = match[2];
  return [size, ...FALLBACK_SIZES[size]].map((candidate) => candidate + path);
}

export async function cachedImage(key) {
  for (const candidate of imageCacheKeys(key)) {
    for (const store of ["pinnedImages", "images"]) {
      try {
        const blob = await dbGet(store, candidate);
        if (blob instanceof Blob && blob.type.startsWith("image/") && blob.size)
          return { blob, key: candidate, store };
      } catch {}
    }
  }
  return null;
}

export async function fetchAndCacheImage(key) {
  if (!globalThis.navigator?.onLine) return null;
  const url = imageProxyUrl(key);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (
      !blob.type.startsWith("image/") ||
      !blob.size ||
      blob.size >= 3000000
    )
      return null;
    const saved = await dbPut("images", key, blob);
    return { blob, key, store: saved ? "images" : null };
  } catch {
    return null;
  }
}

export function image(p, size = "w342", alt = "", cls = "poster") {
  if (!p || !/^\/[\w.-]+$/.test(p))
    return `<img class="${esc(cls)}" src="${placeholder}" alt="${esc(alt)}">`;
  const bundled = state.seed.images[size + p];
  const src = bundled
    ? BASE + esc(bundled)
    : esc(`https://image.tmdb.org/t/p/${size}${p}`);
  return `<img class="${esc(cls)}" ${["hero-image", "detail-image", "detail-poster-image", "actor-cover"].includes(cls) ? "" : 'loading="lazy"'} src="${src}" data-image="${esc(size + p)}" ${bundled ? 'data-bundled="1"' : ""} alt="${esc(alt)}">`;
}

export let observer;

export const urls = new Set();

export async function hydrateImage(img) {
  if (img.dataset.loaded) return;
  img.dataset.loaded = "1";
  const key = img.dataset.image;
  if (!key) return;
  const cached = await cachedImage(key);
  let blob = cached?.blob;
  if (!blob && !img.dataset.bundled && navigator.onLine)
    blob = (await fetchAndCacheImage(key))?.blob;
  if (blob instanceof Blob && img.isConnected) {
    const url = URL.createObjectURL(blob);
    urls.add(url);
    img.src = url;
    // The direct CDN request may have failed before the proxy supplied this blob.
    // Clear that stale marker so the zoom viewer can reuse the now-valid thumbnail.
    delete img.dataset.placeholderShown;
  }
}

export function hydrate() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          hydrateImage(e.target);
          observer.unobserve(e.target);
        }
      }),
    { rootMargin: "120px" },
  );
  document.querySelectorAll("[data-image]").forEach((i) => {
    if (!i.dataset.errorFallbackBound) {
      i.dataset.errorFallbackBound = "1";
      const fallback = () => {
        if (i.dataset.placeholderShown === "1") return;
        i.dataset.placeholderShown = "1";
        i.src = placeholder;
      };
      i.addEventListener("error", fallback, { once: true });
      if (i.complete && i.naturalWidth === 0 && !i.src.startsWith("data:"))
        fallback();
    }
    observer.observe(i);
  });
  syncSaved();
  icons();
}
