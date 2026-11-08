// Scratch & Match: the screen, the miniature, the move's words and sounds, and the inputs.
import { SCR, scrBest, scrOpen } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, pips } from '../../ui/progress.js';

// The pictures (original drawings, each in its own colour, on a 24 x 24 box): a square deals `kinds` of them (mini.pics
// names which, by index here; a picture on a card is an index into that list). The names are for the result line and
// the labels.
export const PICS = [
  { id: 'apple', name: 'an apple', pl: 'apples', c: '#d64545', g: '<path class="pf" d="M12 7.6c-1.5-1.3-3.7-1.4-5.1 0-2.1 2-2.1 5.5-.3 8.4 1.2 2 2.8 3.2 4 3h2.8c1.2.2 2.8-1 4-3 1.8-2.9 1.8-6.4-.3-8.4-1.4-1.4-3.6-1.3-5.1 0z"/><path class="pk" d="M12 7.6V4.8"/><path class="pl" d="M12.3 4.9c.4-1.6 1.6-2.5 3.4-2.4-.2 1.7-1.5 2.6-3.4 2.4z"/>' },
  { id: 'pear', name: 'a pear', pl: 'pears', c: '#a9cc3a', g: '<path class="pf" d="M12 5c-1.6 0-2.5 1.5-2.8 3.4-.3 1.9-2.7 3-2.7 5.9 0 3.3 2.5 5.4 5.5 5.4s5.5-2.1 5.5-5.4c0-2.9-2.4-4-2.7-5.9C14.5 6.5 13.6 5 12 5z"/><path class="pk" d="M12 5V2.6"/>' },
  { id: 'star', name: 'a star', pl: 'stars', c: '#f5b400', g: '<path class="pf" d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.6l-5.6 3.2 1.3-6.2L3 9.3l6.3-.7z"/>' },
  { id: 'heart', name: 'a heart', pl: 'hearts', c: '#ef5fa0', g: '<path class="pf" d="M12 20.4s-7.6-4.7-7.6-10.2A4.3 4.3 0 0 1 12 7.9a4.3 4.3 0 0 1 7.6 2.3c0 5.5-7.6 10.2-7.6 10.2z"/>' },
  { id: 'moon', name: 'a moon', pl: 'moons', c: '#9b87e6', g: '<path class="pf" d="M14.5 3a8.6 8.6 0 1 0 6.2 15.6A7.4 7.4 0 0 1 14.5 3z"/>' },
  { id: 'fish', name: 'a fish', pl: 'fish', c: '#3f8fbf', g: '<path class="pf" d="M2.8 12c2.4-3.6 5.4-5.6 8.8-5.6 2.9 0 5.3 2.2 6.9 5.6-1.6 3.4-4 5.6-6.9 5.6-3.4 0-6.4-2-8.8-5.6z"/><path class="pf" d="M18.3 12l3.4-4.2v8.4z"/><circle class="pe" cx="7.2" cy="11" r="1.1"/>' },
  { id: 'carrot', name: 'a carrot', pl: 'carrots', c: '#f08a24', g: '<path class="pf" d="M6.5 20.8L13.2 8.6l3.6 2.1-8.5 11z"/><path class="pk pg" d="M13.4 8.4l-1.4-4.2M14.9 9.2l2.6-3.4M16 10.3l3.8-1.2"/>' },
  { id: 'clover', name: 'a clover', pl: 'clovers', c: '#3f9d4a', g: '<circle class="pf" cx="8.8" cy="9.2" r="3.7"/><circle class="pf" cx="15.2" cy="9.2" r="3.7"/><circle class="pf" cx="12" cy="14.6" r="3.7"/><path class="pk" d="M12 15.5v5.7"/>' },
];
export const picOf = (mini, sym) => PICS[(mini && Array.isArray(mini.pics) && mini.pics[sym] != null ? mini.pics[sym] : sym) % PICS.length] || PICS[0];
const picSvg = pic => `<svg class="spic" viewBox="0 0 24 24" style="--pc:${pic.c}" aria-hidden="true">${pic.g}</svg>`;
// The frosted panel over a picture: four strips, rubbed away one after the other when the panel is scratched.
const FROST = '<span class="sfrost" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

// The miniature: both cards side by side (X's left, O's right, each bordered in its player's colour), every panel a
// frosted square until scratched, then a square in its picture's colour; the three of a kind, once shown, ringed.
export function miniature(mini, final) {
  const card = (p, x0) => {
    const open = scrOpen(mini, p), cells = Array.isArray(mini.winCells) && scrBest(open) >= SCR.need ? mini.winCells : [];
    const cell = (v, i) => { const cx = x0 + 3 + (i % 3) * 11, cy = 3 + Math.floor(i / 3) * 11; return v == null ? `<rect class="tsf" x="${cx}" y="${cy}" width="9" height="9" rx="2"/>` : `<rect class="tsp${cells.includes(i) ? ' tsw' : ''}" x="${cx}" y="${cy}" width="9" height="9" rx="2" fill="${picOf(mini, v).c}"/>`; };
    return `<g class="tsc ${p}"><rect class="tsb" x="${x0}" y="0" width="39" height="39" rx="4"/>${open.map(cell).join('')}</g>`;
  };
  const best = p => scrBest(scrOpen(mini, p));
  return `<svg class="tscr" viewBox="0 0 84 39" aria-label="X has ${best('X')} of a kind, O has ${best('O')} of a kind">${card('X', 0)}${card('O', 45)}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Both players' tallies up top (name, three pips for the most of any picture on show), each over its player's card:
  // X's on the left, O's on the right, the one on the move ringed in its colour. A card is nine frosted panels; a
  // scratched one shows its picture. The move just made (a: its recorded flash, never the square's last) rubs the frost
  // off its panel strip by strip, the picture pops in, a pair's two panels glow together, and three of a kind glow
  // in turn (the game's own winning moment; the claim is the board's).
  const s = a && a.scratch ? a.scratch : null, o = { view, locked, turn, zoom: state.zoom }, land = SCR.rub + SCR.pop;
  const tal = p => {
    const open = scrOpen(mini, p), best = scrBest(open), moved = !!(s && s.by === p && s.c === best && s.c !== scrBest(open.map((v, i) => (i === s.spot ? null : v))));
    return arcTally(p, o, pips(p, best, SCR.need, moved, land));
  };
  const card = p => {
    const open = scrOpen(mini, p), mine = !view && turn === p, cells = sq.owner === p && Array.isArray(mini.winCells) ? mini.winCells : [];
    const spots = open.map((v, i) => {
      const r = Math.floor(i / 3) + 1, c = (i % 3) + 1, rub = !!(s && s.by === p && s.spot === i), pic = v != null ? picOf(mini, v) : null;
      const win = cells.includes(i), hit = !!(s && s.by === p && s.c === 2 && !win && (rub || (s.same || []).includes(i)));
      const cls = `sspot${v != null ? ' open' : ''}${rub ? ' rub' : ''}${hit ? ' hit' : ''}${win ? ' wn' : ''}${win && fresh ? ' glow' : ''}`;
      const label = `Row ${r} column ${c}${pic && !rub ? `, ${pic.name.replace(/^an? /, '')}` : rub ? '' : ', frosted'}`;
      if (v == null || rub) return `<button class="${cls}"${mine ? ` data-act="move" ${mv(i)}` : ''}${win ? ` style="--k:${wk(i)}"` : ''} aria-label="${label}"${locked || !mine || rub ? ' disabled' : ''}>${pic ? picSvg(pic) : ''}${FROST}</button>`;
      return `<button class="${cls}"${win ? ` style="--k:${wk(i)}"` : ''} aria-label="${label}" disabled>${picSvg(pic)}</button>`;
    }).join('');
    return `<div class="scard ${p}${mine ? ' on' : ''}" role="group" aria-label="${p}'s card"><div class="sgrid">${spots}</div></div>`;
  };
  g = `<div class="g-scratch"><div class="ctals">${tal('X')}${tal('O')}</div><div class="scards">${card('X')}${card('O')}</div></div>`;
  return g;
}
export function moveText(f, who) {
  const s = f.scratch;
  if (!s) return `${who} scratched`;
  const pic = PICS[(s.pic != null ? s.pic : s.sym) % PICS.length] || PICS[0];
  if (s.c >= SCR.need) return `${who} found three ${pic.pl}!`;
  if (s.c === 2) return `${who} found a pair of ${pic.pl}`;
  return `${who} found ${pic.name}`;
}
// The frost rasps away, the picture plops in; a pair rings once, three of a kind sparkle.
export function sounds(f, add, won, mini, last) {
  add('scratch', 0); add('scratch', 220, 1.08); add('scratch', 440, .96);
  add('plop', SCR.rub);
  const s = f.scratch;
  if (won) add('sparkle', SCR.rub + SCR.pop);
  else if (s && s.c === 2) add('ding', SCR.rub + SCR.pop);
}
