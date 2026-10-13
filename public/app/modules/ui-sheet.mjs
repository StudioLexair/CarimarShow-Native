import { $ } from "./ui-dom.mjs";
import { hydrate } from "./ui-images.mjs";
export function sheet(html) {
  $("#sheetContent").innerHTML = html;
  $("#sheet").showModal();
  hydrate();
}

export function closeSheet() {
  $("#sheet").close();
}
