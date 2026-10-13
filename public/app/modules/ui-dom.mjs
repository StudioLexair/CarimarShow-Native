export const $ = (s) => document.querySelector(s);

export const view = $("#view");

export function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3400);
}

export function connection() {
  const on = navigator.onLine;
  $("#connection").classList.toggle("offline", !on);
  $("#connection").title = on ? "Con conexión de red" : "Sin conexión de red";
  $("#connection").setAttribute(
    "aria-label",
    on ? "Con conexión" : "Sin conexión",
  );
}

export function progress(n, msg) {
  $("#splashProgress").value = n;
  $("#splashMessage").textContent = msg;
}
