export const SVG = {
  location:
    '<path d="M12 22s7-8 7-13a7 7 0 1 0-14 0c0 5 7 13 7 13z"/><circle cx="12" cy="9" r="2"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m3 17 5-5 4 4 4-7 5 8"/>',
  shop: '<path d="M3 10 5 3h14l2 7M4 10v11h16V10M9 21v-7h6v7M3 10c0 3 5 3 5 0 0 3 8 3 8 0 0 3 5 3 5 0"/>',
  code: '<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 2l-4 20"/>',
  idea: '<path d="M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0v2H8zM12 1v-1M1 8h2m18 0h2"/>',
  home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2z"/>',
  back: '<path d="m12 5-7 7 7 7M5 12h15"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  share: '<path d="M5 11v9h14v-9M12 15V3m-4 4 4-4 4 4"/>',
  filter:
    '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
  movie:
    '<circle cx="12" cy="12" r="9"/><path d="M4 7h16M4 17h16M9 3v18M15 3v18"/>',
  tv: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 2 4 4 4-4M8 23h8"/>',
  people:
    '<circle cx="9" cy="7" r="3"/><circle cx="18" cy="8" r="2"/><path d="M2 20v-3a7 7 0 0 1 14 0v3zM17 13a5 5 0 0 1 5 5v2"/>',
  tag: '<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 1 2 2 4-2 3-1 1-4 2-3-2-4-4-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 0-1 1-1 2M12 17h.01"/>',
  dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  external: '<path d="M14 3h7v7M21 3 10 14M11 3H3v18h18v-8"/>',
  edit: '<path d="m4 15 11-11 5 5-11 11-6 1zM13 6l5 5"/>',
  heart: '<path d="M12 21 3 12a6 6 0 0 1 9-8 6 6 0 0 1 9 8z"/>',
  offline: '<path d="M5 15a6 6 0 0 1 2-11 8 8 0 0 1 14 8M3 3l18 18M9 18h8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  phone:
    '<path d="m5 3 4 5-2 3a15 15 0 0 0 6 6l3-2 5 4c-1 4-5 4-9 2C6 18 1 10 3 5z"/>',
};

export const icon = (n) =>
  `<svg class="icon icon-${n}" aria-hidden="true" viewBox="0 0 24 24">${SVG[n] || SVG.tag}</svg>`;

export function icons() {
  document
    .querySelectorAll("[data-icon]")
    .forEach((e) => (e.innerHTML = icon(e.dataset.icon)));
}
