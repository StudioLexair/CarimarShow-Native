import { icon } from "./ui-icons.mjs";
import { cachedImage, fetchAndCacheImage, urls } from "./ui-images.mjs";

let routeCloseBound = false;

export function bindImageViewer(root = document) {
  if (!routeCloseBound) {
    window.addEventListener("hashchange", closeImageViewer);
    routeCloseBound = true;
  }
  root.querySelectorAll("[data-image-zoom]").forEach((trigger) => {
    trigger.onclick = () => openImageViewer(trigger);
  });
}

export function closeImageViewer() {
  document.querySelectorAll("dialog.image-viewer[open]").forEach((dialog) =>
    dialog.close(),
  );
}

function openImageViewer(trigger) {
  const fullSize = trigger.dataset.imageZoomSrc;
  if (!fullSize) return;

  const thumbnail = trigger.querySelector("img"),
    imageKey = thumbnail?.dataset.image || "",
    label =
      trigger.dataset.imageZoomAlt ||
      thumbnail?.alt ||
      "Imagen ampliada";
  const dialog = document.createElement("dialog");
  dialog.className = "image-viewer";
  dialog.setAttribute("aria-label", label);
  dialog.innerHTML = `<div class="image-viewer-panel"><button type="button" class="image-viewer-close" aria-label="Cerrar imagen ampliada">${icon("close")}</button><img class="image-viewer-image" alt=""><p class="image-viewer-caption"></p></div>`;

  const image = dialog.querySelector(".image-viewer-image"),
    caption = dialog.querySelector(".image-viewer-caption"),
    close = dialog.querySelector(".image-viewer-close");
  image.alt = label;
  image.dataset.originalSrc = fullSize;
  caption.textContent = label;
  let triedFallback = false;

  async function cachedFallback() {
    if (triedFallback || !dialog.isConnected) return false;
    triedFallback = true;
    const thumbnailSrc = thumbnail?.currentSrc || thumbnail?.src || "";
    let fallback = null;

    if (
      thumbnail?.dataset.bundled === "1" &&
      thumbnail.dataset.placeholderShown !== "1" &&
      thumbnailSrc
    )
      fallback = { src: thumbnailSrc, label: "versión incluida" };

    if (!fallback && imageKey) {
      try {
        const cached = await cachedImage(imageKey);
        if (cached) {
          const src = URL.createObjectURL(cached.blob);
          urls.add(src);
          fallback = { src, label: "versión guardada" };
        }
      } catch {}
    }

    if (
      !fallback &&
      thumbnailSrc.startsWith("blob:") &&
      thumbnail?.dataset.placeholderShown !== "1"
    )
      fallback = { src: thumbnailSrc, label: "versión guardada" };

    if (
      !fallback &&
      thumbnail?.dataset.placeholderShown !== "1" &&
      thumbnail?.complete &&
      thumbnail.naturalWidth > 0 &&
      thumbnailSrc
    )
      fallback = { src: thumbnailSrc, label: "vista previa" };

    if (!fallback && imageKey && globalThis.navigator?.onLine) {
      const fetched = await fetchAndCacheImage(imageKey);
      if (fetched && dialog.isConnected) {
        const src = URL.createObjectURL(fetched.blob);
        urls.add(src);
        fallback = {
          src,
          label: fetched.store ? "versión guardada" : "vista previa",
        };
      }
    }

    if (!fallback || !dialog.isConnected) return false;
    dialog.classList.add("image-viewer--cached-fallback");
    image.src = fallback.src;
    caption.textContent = `${label} · ${fallback.label}`;
    return true;
  }

  image.addEventListener("error", async () => {
    if (await cachedFallback()) return;
    image.removeAttribute("src");
    caption.textContent =
      "No se pudo cargar la imagen. Comprueba la conexión e inténtalo de nuevo.";
  });

  const restoreFocus = () => {
    dialog.remove();
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  dialog.addEventListener("close", restoreFocus, { once: true });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  close.addEventListener("click", () => dialog.close());
  document.body.append(dialog);

  image.src = fullSize;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  close.focus({ preventScroll: true });
}
