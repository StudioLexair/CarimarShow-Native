import { icon } from "./ui-icons.mjs";

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
    fallback =
      thumbnail?.dataset.image && thumbnail.dataset.placeholderShown !== "1"
        ? thumbnail.currentSrc || thumbnail.src
        : "",
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
  caption.textContent = label;
  let triedFallback = false;
  image.addEventListener("error", () => {
    if (!triedFallback && fallback && image.src !== fallback) {
      triedFallback = true;
      dialog.classList.add("image-viewer--cached-fallback");
      image.src = fallback;
      caption.textContent = `${label} · versión guardada`;
      return;
    }
    image.removeAttribute("src");
    caption.textContent = "No se pudo cargar la imagen. Comprueba la conexión e inténtalo de nuevo.";
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
