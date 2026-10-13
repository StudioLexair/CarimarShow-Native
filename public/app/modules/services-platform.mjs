import { kind, title, esc } from "./core-model.mjs";
import { sheet, closeSheet } from "./ui-sheet.mjs";
import { $, toast } from "./ui-dom.mjs";
import { state } from "./core-state.mjs";
export async function share(m, personId) {
  const url = `https://carimarshow-native.vercel.app/app/#${personId ? "person/" + personId : "detail/" + kind(m) + "/" + m.id}`,
    t = personId ? "Persona en CarimarShow" : title(m);
  try {
    if (navigator.share) {
      await navigator.share({ title: t, url });
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado");
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  sheet(
    `<h2>Compartir</h2><p>Copia este enlace para compartir la ficha:</p><input readonly id="shareUrl" value="${esc(url)}"><button class="primary" id="copyLink">Copiar enlace</button>`,
  );
  $("#copyLink").onclick = () => {
    $("#shareUrl").select();
    if (document.execCommand("copy")) {
      toast("Enlace copiado");
      closeSheet();
    } else toast("Mantén pulsado el enlace para copiarlo.");
  };
}

export async function install() {
  if (state.installPrompt) {
    await state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    return;
  }
  sheet(
    `<h2>Lleva CarimarShow contigo</h2><p>${/iPhone|iPad|iPod/.test(navigator.userAgent) ? "En Safari: Compartir → Añadir a la pantalla de inicio." : "En Chrome o Edge, abre el menú del navegador y busca «Instalar aplicación». En Android y Windows también puedes usar nuestros instaladores."}</p><a class="primary" href="https://github.com/StudioLexair/CarimarShow-Native/releases/latest" target="_blank" rel="noopener">Descargar instaladores</a>`,
  );
}

export async function copyText(text) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      toast("Texto copiado");
      return true;
    }
  } catch {}
  const field = document.createElement("textarea");
  field.value = text;
  field.style.cssText = "position:fixed;left:-9999px";
  document.body.append(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  field.remove();
  if (ok) {
    toast("Texto copiado");
    return true;
  }
  sheet(
    `<h2>Copiar manualmente</h2><p>Esta plataforma no permitió copiar automáticamente. Selecciona y copia el texto:</p><textarea readonly rows="8">${esc(text)}</textarea>`,
  );
  return false;
}
export async function shareText(text, title = "CarimarShow") {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return true;
    }
  } catch (e) {
    if (e.name === "AbortError") return false;
  }
  return copyText(text);
}
