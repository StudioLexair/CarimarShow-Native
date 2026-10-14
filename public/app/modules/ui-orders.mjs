import { state } from "./core-state.mjs";
import { orderMessage, whatsappChoices } from "./services-orders.mjs";
import { esc } from "./core-model.mjs";
import { sheet } from "./ui-sheet.mjs";
import { $, toast } from "./ui-dom.mjs";
import { copyText, shareText } from "./services-platform.mjs";
export function shareOrder() {
  if (state.list.some((m) => m._contentExpired)) {
    toast(
      "Hay títulos por actualizar. Abre sus fichas con conexión antes de compartir el pedido.",
    );
    return;
  }
  const text = orderMessage(state.list);
  if (!text) return toast("Añade al menos un título antes de compartir.");
  const choices = whatsappChoices(state.list, text);
  sheet(
    `<h2>Compartir mi lista</h2><p>Elige primero uno de los contactos del negocio. Solo prepararemos una consulta; abrir WhatsApp no confirma que el mensaje se haya enviado.</p><div class="order-contacts">${choices
      .map(
        (c, i) =>
          `<a class="order-contact" data-order-contact="${i + 1}" href="${esc(c.url)}" target="_blank" rel="noopener"><strong>WhatsApp ${i + 1}</strong><span>${esc(c.label)}</span></a>`,
      )
      .join("")}</div><label for="orderMessage">Mensaje editable · ${state.list.length} títulos</label><textarea id="orderMessage" rows="9" spellcheck="true" aria-label="Edita el mensaje que compartirás"></textarea><p class="tiny">Puedes cambiar el texto antes de enviarlo. WhatsApp, Copiar y Compartir usarán el mensaje editado. Tu lista no se borra.</p><div class="sheet-actions"><button class="secondary" id="copyOrder">Copiar mensaje</button><button class="secondary" id="systemOrder">Compartir…</button></div>`,
  );
  const textarea = $("#orderMessage");
  textarea.value = text;
  const currentMessage = () => textarea.value;
  const syncContactLinks = () => {
    whatsappChoices(state.list, currentMessage()).forEach((choice, i) => {
      const link = $(`[data-order-contact="${i + 1}"]`);
      if (link) link.href = choice.url;
    });
  };
  textarea.addEventListener("input", syncContactLinks);
  $("#copyOrder").onclick = () => copyText(currentMessage());
  $("#systemOrder").onclick = () =>
    shareText(currentMessage(), "Consulta a CarimarShow");
}
