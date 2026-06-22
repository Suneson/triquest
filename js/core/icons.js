// icons.js — minimalist monochrome line icons (Bevel/Whoop style).
// stroke-width 1.75, currentColor; neon fills come from CSS on data indicators.
const P = {
  run: '<circle cx="13.5" cy="4" r="1.6"/><path d="M7 21l3-5v-4l4 2 2 4"/><path d="M10 12 8 9l4-1 3 2 2-1"/>',
  bike: '<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M6 17l4-7h5M9.5 7H13l3.5 10"/>',
  swim: '<circle cx="8" cy="8.5" r="1.5"/><path d="M5 13l5-3 3 2 4-3"/><path d="M3 17c2 1.4 3.6 1.4 5.5 0M14.5 17c2 1.4 3.6 1.4 5.5 0"/>',
  gym: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  brick: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/>',
  mobility: '<circle cx="12" cy="4.5" r="1.6"/><path d="M12 7v6l-5 7M12 13l5 7M7 10h10"/>',
  other: '<circle cx="12" cy="12" r="7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  regen: '<path d="M3 11a9 9 0 0 1 15-5l3 3M21 13a9 9 0 0 1-15 5l-3-3"/><path d="M21 4v5h-5M3 20v-5h5"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h16M14 4l4 4-9 9-4 1 1-4 8-8Z"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M9 10 7 3h10l-2 7"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
  flame: '<path d="M12 3c4 4 5 7 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1 1 2 2 2 0-3-1-5 1-8Z"/>',
  route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  moon: '<path d="M20 14a8 8 0 1 1-10-10 7 7 0 0 0 10 10Z"/>',
  warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
export function svg(name, cls = '') {
  return `<svg viewBox="0 0 24 24" class="ic ${cls}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.other}</svg>`;
}
