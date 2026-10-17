// Sniff: the screen, the miniature, the move's words and sounds, and the inputs.
import { SNIFF, sniffDirs, sniffStep } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Sniff: the 5x5 field and the dog, nothing else: no trail. The dog's four neighbours (inside the field)
// are the moves: a tap walks it there; it trots over leaving two paw prints behind it (warm for hotter,
// cool for colder, ringed in the walker's colour), then "Hotter!" or "Colder!" for a moment; once the move
// is over the prints and the word are gone. Onto the treasure: it digs, the chest pops up.
const SNIFF_HOT = '#f2763a', SNIFF_COLD = '#5aa6e8';
const sniffXY = c => [Math.floor(c % SNIFF.n) * 20 + 10, Math.floor(c / SNIFF.n) * 20 + 10];   // a cell's middle, in a 100 x 100 field
const SNIFF_PAW = '<ellipse cx="0" cy="1.3" rx="2" ry="1.7"/><circle cx="-1.9" cy="-1.5" r=".75"/><circle cx="-.65" cy="-2.5" r=".75"/><circle cx=".65" cy="-2.5" r=".75"/><circle cx="1.9" cy="-1.5" r=".75"/>';
function sniffPaws(trail, fresh) {
  const seen = {};
  return trail.map((s, k) => {
    const [x0, y0] = sniffXY(s.f), [x1, y1] = sniffXY(s.t), dx = (x1 - x0) / 20, dy = (y1 - y0) / 20, ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    const edge = Math.min(s.f, s.t) + ':' + Math.max(s.f, s.t), n = seen[edge] = (seen[edge] || 0) + 1, off = ((n - 1) % 3 - 1) * 2.4;   // the same way again: a little to one side
    const px = -dy, py = dx, isNew = fresh && k === trail.length - 1;
    return [0.12, 0.42].map((f, j) => { const side = (j ? 2.6 : -2.6) + off, x = x0 + (x1 - x0) * f + px * side, y = y0 + (y1 - y0) * f + py * side;   // behind the dog as it arrives, one either side: never under it
      return `<g class="spaw ${s.by}${isNew ? ' fresh' : ''}" style="--t:${isNew ? SNIFF.step * (0.25 + 0.3 * j) : 0}ms" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(0)}) scale(1.15)"><g class="sring">${SNIFF_PAW}</g><g class="sfill" fill="${s.hot ? SNIFF_HOT : SNIFF_COLD}">${SNIFF_PAW}</g></g>`; }).join('');
  }).join('');
}
const SNIFF_DOG = '<g class="sdogart"><ellipse cx="-6.2" cy="-1.4" rx="2.6" ry="4.6" transform="rotate(18 -6.2 -1.4)" class="sear"/><ellipse cx="6.2" cy="-1.4" rx="2.6" ry="4.6" transform="rotate(-18 6.2 -1.4)" class="sear"/><circle r="6.6" class="shead"/><ellipse cx="0" cy="2.6" rx="3.6" ry="2.7" class="smuz"/><circle cx="-2.4" cy="-1.6" r=".95" class="seye"/><circle cx="2.4" cy="-1.6" r=".95" class="seye"/><ellipse cx="0" cy="1.6" rx="1.4" ry="1" class="snose"/></g>';
function sniffTable(mini, a, o) {
  const s = a && a.sniff ? a.sniff : null, turn = o.turn;
  const tal = p => arcTally(p, o, '');
  const cells = Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [x, y] = sniffXY(c); return `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="scell${(Math.floor(c / SNIFF.n) + c % SNIFF.n) % 2 ? ' alt' : ''}"/>`; }).join('');
  const paws = s ? sniffPaws([{ f: s.f, t: s.t, by: a.by, hot: s.hot }], true) : '';   // this move's prints only, while it plays
  const [dx, dy] = sniffXY(mini.dog), [fx, fy] = s ? sniffXY(s.f) : [dx, dy];
  const moves = o.locked || s ? '' : sniffDirs(mini.dog).map(d => { const to = sniffStep(mini.dog, d), [x, y] = sniffXY(to), ar = { N: 0, E: 90, S: 180, W: 270 }[d];
    return `<g class="smove" data-act="move" ${mv(d)} role="button" tabindex="0" aria-label="Walk ${{ N: 'up', S: 'down', E: 'right', W: 'left' }[d]}"><rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="shit"/><path class="sarrow" transform="translate(${x} ${y}) rotate(${ar})" d="M0 -4.5 L4 0.5 L1.4 0.5 L1.4 4.5 L-1.4 4.5 L-1.4 0.5 L-4 0.5 Z"/></g>`; }).join('');
  const found = s ? s.found : !!(mini.last && mini.last.found);
  const chest = found ? `<g transform="translate(${dx + 4} ${dy - 4}) scale(.8)"><g ${lateAt('schest', s ? SNIFF.step : null)}><rect x="-6" y="-3" width="12" height="8" rx="1.5" class="sbox"/><path d="M-6 -3 Q0 -9 6 -3 Z" class="slid"/><rect x="-1.3" y="-1.5" width="2.6" height="3" class="slock"/></g></g>` : '';
  const dog = `<g class="sdog${s ? ' walk' : ''}" style="--dx:${((fx - dx) / 0.85).toFixed(1)}px;--dy:${((fy - dy) / 0.85).toFixed(1)}px;--d:${SNIFF.step}ms" transform="translate(${dx} ${dy}) scale(.85)"><g class="sdogin">${SNIFF_DOG}</g></g>`;
  const word = s ? (s.found ? 'Found it!' : s.hot ? 'Hotter!' : 'Colder!') : null;
  const res = s ? `<p ${lateAt('arcres ' + (s.found || s.hot ? 'hot' : 'cold'), SNIFF.step)} role="status">${word}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : `<p class="arcnote">${o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="sniff"><svg class="sfield" viewBox="0 0 100 100" role="group" aria-label="The field and the dog">${cells}${paws}${dog}${chest}${moves}</svg>${res}</div></div>`;
}
export function miniature(mini, final) {
  const [x, y] = sniffXY(mini.dog); return `<svg class="tsniff" viewBox="0 0 100 100" aria-hidden="true">${Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [cx, cy] = sniffXY(c); return `<rect x="${cx - 9}" y="${cy - 9}" width="18" height="18" rx="3"/>`; }).join('')}<circle class="tdog" cx="${x}" cy="${y}" r="7"/></svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = sniffTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.sniff ? `${who} walked the dog: ${f.sniff.found ? 'found it!' : f.sniff.hot ? 'hotter' : 'colder'}` : `${who} walked the dog`;
}
export function sounds(f, add, won, mini, last) {
  if (f.sniff) { add('hop', 0); add('hop', Math.round(SNIFF.step * 0.5)); if (f.sniff.found) { add('dig', SNIFF.step); add('sparkle', SNIFF.step + 250); } else add(f.sniff.hot ? 'higher' : 'lower', SNIFF.step); } return;   // the dog trots (its paws), then hotter or colder, or it digs up the chest
}
