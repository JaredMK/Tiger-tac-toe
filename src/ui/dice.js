// The shared die (November 2026): a solid die built from flat faces in 3-D (a cube for six sides, an octahedron for
// eight), drawn as the rest of the game is (white faces, ink outlines, black pips or the number), resting a little
// tilted over its soft shadow so it reads as a thing on a table. die3d(n, o) returns its markup, pure text (a view's
// screen may be rendered anywhere): the face towards the player is always n, the other faces carry the other numbers
// (a six-sided die's opposite faces add up to 7), so a tumble needs no face swapping: with o.roll the whole solid is
// thrown in from the side, turns over through its real faces, bounces once and lands on n exactly o.roll ms after
// o.t (styles.css: .d3; every time a figure of the move's own clock, set to the move's event by fx.js anchorFx, so it
// plays once, the same in Speed and in replays, and a redraw part way carries on). Its sounds are the view's (the
// landing at o.t + o.roll; the first bounce at o.t + o.roll * DIE_BOUNCE).
//   n      the number shown (null: a die not rolled yet, a "?" on its face)
//   o.sides 6 (default) or 8        o.roll  the tumble's length in ms (none: at rest)      o.t  when it starts (ms)
//   o.v    which way it comes in and turns (0 to 3: two dice thrown together take different ones)
//   o.cls  extra classes            o.label its aria-label (none: hidden from readers)
// Its size is the --ds custom property (64px unless the game's stylesheet says otherwise).
import { dieFace } from './art.js';
import { DIE_MORE } from '../core/config.js';

export const DIE_FLAT_MS = 600 + DIE_MORE;           // a flat die's tumble (the retired Dice race's: styles.css .die.roll, --dur; Dice Combo and Backgammon Lite throw the 3-D die now)
export const DIE_BOUNCE = 0.46;                       // the first touch of the table, as a share of the tumble (the keyframes' 46%)
const OTHERS8 = [5, 2, 7, 4, 3, 6, 1];               // the faces after the one on show, as steps round an eight-sided die
function cube(n) {
  const q = n == null, rest = [1, 2, 3, 4, 5, 6].filter(v => v !== n && v !== 7 - n);   // (not rolled yet: 1 behind the "?", as any die)
  const at = q ? { a: null, b: 6, c: 2, d: 5, e: 3, g: 4 } : { a: n, b: 7 - n, c: rest[1], d: 7 - rest[1], e: rest[0], g: 7 - rest[0] };
  return ['a', 'b', 'c', 'd', 'e', 'g'].map(k => `<i class="d3f d3${k}">${at[k] == null ? '<b class="d3q">?</b>' : dieFace(at[k])}</i>`).join('');
}
function octa(n) {
  const tri = (up, v, k) => `<i class="d3t ${up ? 'u' : 'l'} k${k}${up && k === 0 ? ' on' : ''}"><svg viewBox="0 0 100 86.6" aria-hidden="true"><path d="${up ? 'M50 2 98 84.6 2 84.6Z' : 'M2 2 98 2 50 84.6Z'}"/><text x="50" y="${up ? 71 : 41}" text-anchor="middle">${v}</text></svg></i>`;
  const num = j => (n == null ? j + 1 : ((n - 1 + OTHERS8[j - 1]) % 8) + 1);
  let out = '';
  for (let k = 0; k < 4; k++) out += tri(true, k === 0 ? (n == null ? '?' : n) : num(k), k) + tri(false, num(k + 4), k);
  return out;
}
export function die3d(n, o = {}) {
  const eight = o.sides === 8, st = [];
  if (o.roll) { st.push(`--dur:${Math.round(o.roll)}ms`); if (o.t) st.push(`--t:${Math.round(o.t)}ms`); }
  return `<span class="d3 ${eight ? 'd3octa' : 'd3cube'}${o.roll ? ' roll' : ''} v${(o.v || 0) % 4}${o.cls ? ' ' + o.cls : ''}"${st.length ? ` style="${st.join(';')}"` : ''}${o.label ? ` role="img" aria-label="${o.label}"` : ' aria-hidden="true"'}><i class="d3sh"></i><span class="d3hop"><span class="d3body"><span class="d3solid">${eight ? octa(n) : cube(n)}</span></span></span></span>`;
}
