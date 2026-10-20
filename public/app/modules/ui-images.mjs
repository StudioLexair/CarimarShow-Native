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
  const k = img.dataset.image;
  let blob = (await dbGet("pinnedImages", k)) || (await dbGet("images", k));
  if (!blob && !img.dataset.bundled && navigator.onLine) {
    try {
      const url = imageProxyUrl(k);
      if (!url) return;
      const r = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const b = await r.blob();
        if (b.type.startsWith("image/") && b.size < 3000000) {
          blob = b;
          await dbPut("images", k, b);
        }
      }
    } catch {}
  }
  if (blob instanceof Blob && img.isConnected) {
    const u = URL.createObjectURL(blob);
    urls.add(u);
    img.src = u;
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
