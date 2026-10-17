// Shared art: the X and O characters, icons, dice faces, ticks and crosses.
import { GAMES } from '../games/index.js';

// A little cartoon computer, shown next to computer players.
export const CPU_ICON = '<svg class="cpui" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="13.5" rx="3" fill="#58a8cf" stroke="#161210" stroke-width="2"/><ellipse cx="9" cy="8.6" rx="1.5" ry="2" fill="#161210"/><ellipse cx="15" cy="8.6" rx="1.5" ry="2" fill="#161210"/><path d="M9 12q3 2.2 6 0" fill="none" stroke="#161210" stroke-width="1.7" stroke-linecap="round"/><path d="M9.6 16.4v3.4h4.8v-3.4M6.5 20.6h11" fill="none" stroke="#161210" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICONS = Object.fromEntries(Object.keys(GAMES).map(t => [t, GAMES[t].meta.icon]));
const BOAT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 14.5h19l-2.6 4.6a2 2 0 0 1-1.7 1H6.8a2 2 0 0 1-1.7-1z"/><path d="M11 3h2v10h-2z"/><path d="M13 4.5 18.5 11H13z"/><path d="M5 12.5h14v2H5z"/></svg>';
export const RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3v5h-5"/></svg>';
// The two characters: a red X and a yellow O with pie-cut eyes and a grin (drawn on a 100 x 100 grid).
export function toonG(p) {
  const face = (y, mx) => `<g class="eyes"><ellipse class="eye" cx="${50 - mx}" cy="${y}" rx="6.5" ry="9"/><ellipse class="eye" cx="${50 + mx}" cy="${y}" rx="6.5" ry="9"/><ellipse class="pup" cx="${51.5 - mx}" cy="${y + 2}" rx="3.4" ry="5.6"/><ellipse class="pup" cx="${51.5 + mx}" cy="${y + 2}" rx="3.4" ry="5.6"/></g>`;
  if (p === 'X') return `<path class="ol" d="M22 20 L78 80 M78 20 L22 80"/><path class="fl" d="M22 20 L78 80 M78 20 L22 80"/>${face(44, 8)}<path class="mouth" d="M42 60 Q50 67 58 60"/>`;
  return `<circle class="ol" cx="50" cy="50" r="32"/><circle class="fl" cx="50" cy="50" r="32"/>${face(46, 7)}<path class="mouth" d="M43 59 Q50 65 57 59"/>`;
}
export const toon = p => `<svg class="pc p${p}" viewBox="0 0 100 100" aria-hidden="true">${toonG(p)}</svg>`;
export const toonT = p => `${toon(p)}<b class="sr">${p}</b>`;                 // the character, with its letter for screen readers
export const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg>';
export function dieFace(n) {
  const P = { 1: [[12, 12]], 2: [[6.5, 6.5], [17.5, 17.5]], 3: [[6.5, 6.5], [12, 12], [17.5, 17.5]], 4: [[6.5, 6.5], [17.5, 6.5], [6.5, 17.5], [17.5, 17.5]],
    5: [[6.5, 6.5], [17.5, 6.5], [12, 12], [6.5, 17.5], [17.5, 17.5]], 6: [[6.5, 6], [17.5, 6], [6.5, 12], [17.5, 12], [6.5, 18], [17.5, 18]] };
  return `<svg viewBox="0 0 24 24" fill="#1a1a1a">${(P[n] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</svg>`;
}
export const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 6.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg>';

// ---- the drawing: bold ink outlines, flat paper colours, nothing borrowed ----
export const hash01 = j => { const x = Math.sin(j * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
