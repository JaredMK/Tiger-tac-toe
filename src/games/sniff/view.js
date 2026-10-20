// Sniff: the screen, the miniature, the move's words and sounds, and the inputs.
import { SNIFF, sniffDirs, sniffStep } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { other } from '../../core/util.js';

// Sniff: the 5x5 field and the dog, nothing else: no trail. The dog's eight neighbours (inside the field,
// diagonals too) are the moves: a tap walks it there; it trots over leaving two paw prints behind it (warm
// for hotter, cool for colder, grey for the same, ringed in the walker's colour), then "Hotter!", "Colder!"
// or "Same" for a moment; once the move is over the prints and the word are gone. Onto the treasure: it
// digs, the chest pops up.
const SNIFF_HOT = '#f2763a', SNIFF_COLD = '#5aa6e8', SNIFF_SAME = '#a89a80';
const SNIFF_ANG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const SNIFF_WAY = { N: 'up', NE: 'up and right', E: 'right', SE: 'down and right', S: 'down', SW: 'down and left', W: 'left', NW: 'up and left' };
const resOf = s => s.res || s.r || (s.hot ? 'hot' : 'cold');
const sniffXY = c => [Math.floor(c % SNIFF.n) * 20 + 10, Math.floor(c / SNIFF.n) * 20 + 10];   // a cell's middle, in a 100 x 100 field
const SNIFF_PAW = '<ellipse cx="0" cy="1.3" rx="2" ry="1.7"/><circle cx="-1.9" cy="-1.5" r=".75"/><circle cx="-.65" cy="-2.5" r=".75"/><circle cx=".65" cy="-2.5" r=".75"/><circle cx="1.9" cy="-1.5" r=".75"/>';
function sniffPaws(trail, fresh) {   // (a step with own: a path's print in its owner's colour only, not the step's word)
  const seen = {};
  return trail.map((s, k) => {
    const [x0, y0] = sniffXY(s.f), [x1, y1] = sniffXY(s.t), len = Math.hypot(x1 - x0, y1 - y0) || 1, dx = (x1 - x0) / len, dy = (y1 - y0) / len, ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;   // (a diagonal step: the prints a little further apart)
    const edge = Math.min(s.f, s.t) + ':' + Math.max(s.f, s.t), n = seen[edge] = (seen[edge] || 0) + 1, off = ((n - 1) % 3 - 1) * 2.4;   // the same way again: a little to one side
    const px = -dy, py = dx, isNew = fresh && k === trail.length - 1;
    return [0.12, 0.42].map((f, j) => { const side = (j ? 2.6 : -2.6) + off, x = x0 + (x1 - x0) * f + px * side, y = y0 + (y1 - y0) * f + py * side;   // behind the dog as it arrives, one either side: never under it
      return `<g class="spaw ${s.by}${isNew ? ' fresh' : ''}" style="--t:${isNew ? SNIFF.step * (0.25 + 0.3 * j) : 0}ms" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(0)}) scale(1.15)"><g class="sring">${SNIFF_PAW}</g>${s.own ? '' : `<g class="sfill" fill="${resOf(s) === 'hot' ? SNIFF_HOT : resOf(s) === 'same' ? SNIFF_SAME : SNIFF_COLD}">${SNIFF_PAW}</g>`}</g>`; }).join('');
  }).join('');
}
const SNIFF_DOG = '<g class="sdogart"><ellipse cx="-6.2" cy="-1.4" rx="2.6" ry="4.6" transform="rotate(18 -6.2 -1.4)" class="sear"/><ellipse cx="6.2" cy="-1.4" rx="2.6" ry="4.6" transform="rotate(-18 6.2 -1.4)" class="sear"/><circle r="6.6" class="shead"/><ellipse cx="0" cy="2.6" rx="3.6" ry="2.7" class="smuz"/><circle cx="-2.4" cy="-1.6" r=".95" class="seye"/><circle cx="2.4" cy="-1.6" r=".95" class="seye"/><ellipse cx="0" cy="1.6" rx="1.4" ry="1" class="snose"/></g>';
function sniffTable(mini, a, o) {
  if (mini.dogs) return sniffScTable(mini, a, o);
  const s = a && a.sniff ? a.sniff : null, turn = o.turn;
  const tal = p => arcTally(p, o, '');
  const cells = Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [x, y] = sniffXY(c); return `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="scell${(Math.floor(c / SNIFF.n) + c % SNIFF.n) % 2 ? ' alt' : ''}"/>`; }).join('');
  const paws = s ? sniffPaws([{ f: s.f, t: s.t, by: a.by, hot: s.hot, res: resOf(s) }], true) : '';   // this move's prints only, while it plays
  const [dx, dy] = sniffXY(mini.dog), [fx, fy] = s ? sniffXY(s.f) : [dx, dy];
  const moves = o.locked || s ? '' : sniffDirs(mini.dog).map(d => { const to = sniffStep(mini.dog, d), [x, y] = sniffXY(to), ar = SNIFF_ANG[d];
    return `<g class="smove" data-act="move" ${mv(d)} role="button" tabindex="0" aria-label="Walk ${SNIFF_WAY[d]}"><rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="shit"/><path class="sarrow" transform="translate(${x} ${y}) rotate(${ar})" d="M0 -4.5 L4 0.5 L1.4 0.5 L1.4 4.5 L-1.4 4.5 L-1.4 0.5 L-4 0.5 Z"/></g>`; }).join('');
  const found = s ? s.found : !!(mini.last && mini.last.found);
  const chest = found ? `<g transform="translate(${dx + 4} ${dy - 4}) scale(.8)"><g ${lateAt('schest', s ? SNIFF.step : null)}><rect x="-6" y="-3" width="12" height="8" rx="1.5" class="sbox"/><path d="M-6 -3 Q0 -9 6 -3 Z" class="slid"/><rect x="-1.3" y="-1.5" width="2.6" height="3" class="slock"/></g></g>` : '';
  const dog = `<g class="sdog${s ? ' walk' : ''}" style="--dx:${((fx - dx) / 0.85).toFixed(1)}px;--dy:${((fy - dy) / 0.85).toFixed(1)}px;--d:${SNIFF.step}ms" transform="translate(${dx} ${dy}) scale(.85)"><g class="sdogin">${SNIFF_DOG}</g></g>`;
  const r = s ? resOf(s) : null, word = s ? (s.found ? 'Found it!' : r === 'hot' ? 'Hotter!' : r === 'same' ? 'Same' : 'Colder!') : null;
  const res = s ? `<p ${lateAt('arcres ' + (s.found || r === 'hot' ? 'hot' : r === 'same' ? 'same' : 'cold'), SNIFF.step)} role="status">${word}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : `<p class="arcnote">${o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="sniff"><svg class="sfield" viewBox="0 0 100 100" role="group" aria-label="The field and the dog">${cells}${paws}${dog}${chest}${moves}</svg>${res}</div></div>`;
}
// Super Chaos: a dog each (a ring in its owner's colour), both from the middle, and both paths: each step's
// two prints in its walker's colour. The arrows are round the mover's own dog; the step playing out walks that
// dog, its prints warm, cool or grey for its word, as in the normal game. Two dogs on one cell stand side by side.
const SNIFF_SC = 0.72;
function sniffScTable(mini, a, o) {
  const s = a && a.sniff ? a.sniff : null, turn = o.turn, by = s ? a.by : null;
  const cells = Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [x, y] = sniffXY(c); return `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="scell${(Math.floor(c / SNIFF.n) + c % SNIFF.n) % 2 ? ' alt' : ''}"/>`; }).join('');
  const steps = [];
  for (const p of ['X', 'O']) {
    const path = mini.paths[p];
    for (let k = 1; k < path.length; k++) if (!(p === by && k === path.length - 1)) steps.push({ f: path[k - 1], t: path[k], by: p, own: true });
  }
  const paws = sniffPaws(steps, false) + (s ? sniffPaws([{ f: s.f, t: s.t, by, hot: s.hot, res: resOf(s) }], true) : '');
  const same = mini.dogs.X === mini.dogs.O;
  const dog = p => {
    const [x0, y0] = sniffXY(mini.dogs[p]), sh = same ? (p === 'X' ? -4 : 4) : 0, dx = x0 + sh, dy = y0, walk = p === by;
    const [fx, fy] = walk ? sniffXY(s.f) : [x0, y0], fsh = walk && s.f === mini.dogs[other(p)] ? (p === 'X' ? -4 : 4) : sh;
    return `<g class="sdog ${p}${walk ? ' walk' : ''}" style="--dx:${((fx + fsh - dx) / SNIFF_SC).toFixed(1)}px;--dy:${((fy - dy) / SNIFF_SC).toFixed(1)}px;--d:${SNIFF.step}ms" transform="translate(${dx} ${dy}) scale(${SNIFF_SC})"><g class="sdogin"><circle r="9.2" class="sown"/>${SNIFF_DOG}</g></g>`;
  };
  const me = o.view ? null : turn, at = me ? mini.dogs[me] : null;
  const moves = o.locked || s || !me ? '' : sniffDirs(at).map(d => { const to = sniffStep(at, d), [x, y] = sniffXY(to), ar = SNIFF_ANG[d];
    return `<g class="smove" data-act="move" ${mv(d)} role="button" tabindex="0" aria-label="Walk ${SNIFF_WAY[d]}"><rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="shit"/><path class="sarrow" transform="translate(${x} ${y}) rotate(${ar})" d="M0 -4.5 L4 0.5 L1.4 0.5 L1.4 4.5 L-1.4 4.5 L-1.4 0.5 L-4 0.5 Z"/></g>`; }).join('');
  const found = s ? s.found : !!(mini.last && mini.last.found), fby = s ? by : mini.last && mini.last.by;
  const [cx, cy] = found && fby ? sniffXY(mini.dogs[fby]) : [0, 0];
  const chest = found && fby ? `<g transform="translate(${cx + 4} ${cy - 4}) scale(.8)"><g ${lateAt('schest', s ? SNIFF.step : null)}><rect x="-6" y="-3" width="12" height="8" rx="1.5" class="sbox"/><path d="M-6 -3 Q0 -9 6 -3 Z" class="slid"/><rect x="-1.3" y="-1.5" width="2.6" height="3" class="slock"/></g></g>` : '';
  const r = s ? resOf(s) : null, word = s ? (s.found ? 'Found it!' : r === 'hot' ? 'Hotter!' : r === 'same' ? 'Same' : 'Colder!') : null;
  const res = s ? `<p ${lateAt('arcres ' + (s.found || r === 'hot' ? 'hot' : r === 'same' ? 'same' : 'cold'), SNIFF.step)} role="status">${word}</p>` : '<p class="arcnote"></p>';
  const order = by === 'X' ? ['O', 'X'] : ['X', 'O'];             // (the walking dog over the other)
  return `<div class="g-arc"><div class="ctals">${arcTally('X', o, '')}${arcTally('O', o, '')}</div><div class="sniff"><svg class="sfield" viewBox="0 0 100 100" role="group" aria-label="The field and both dogs">${cells}${paws}${order.map(dog).join('')}${chest}${moves}</svg>${res}</div></div>`;
}
export function miniature(mini, final) {
  if (mini.dogs) {
    const line = p => `<polyline class="tpath ${p}" points="${mini.paths[p].map(c => sniffXY(c).map(v => v + (mini.paths[p].length && p === 'X' ? -2 : 2)).join(',')).join(' ')}"/>`;
    const dot = p => { const [x, y] = sniffXY(mini.dogs[p]), sh = mini.dogs.X === mini.dogs.O ? (p === 'X' ? -6 : 6) : 0; return `<circle class="tdog ${p}" cx="${x + sh}" cy="${y}" r="6.5"/>`; };
    return `<svg class="tsniff" viewBox="0 0 100 100" aria-hidden="true">${Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [cx, cy] = sniffXY(c); return `<rect x="${cx - 9}" y="${cy - 9}" width="18" height="18" rx="3"/>`; }).join('')}${line('X')}${line('O')}${dot('X')}${dot('O')}</svg>`;
  }
  const [x, y] = sniffXY(mini.dog); return `<svg class="tsniff" viewBox="0 0 100 100" aria-hidden="true">${Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [cx, cy] = sniffXY(c); return `<rect x="${cx - 9}" y="${cy - 9}" width="18" height="18" rx="3"/>`; }).join('')}<circle class="tdog" cx="${x}" cy="${y}" r="7"/></svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = sniffTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.sniff ? `${who} walked ${f.sc ? 'their' : 'the'} dog: ${f.sniff.found ? 'found it!' : resOf(f.sniff) === 'hot' ? 'hotter' : resOf(f.sniff) === 'same' ? 'the same' : 'colder'}` : `${who} walked the dog`;
}
export function sounds(f, add, won, mini, last) {
  if (f.sniff) { add('hop', 0); add('hop', Math.round(SNIFF.step * 0.5)); if (f.sniff.found) { add('dig', SNIFF.step); add('sparkle', SNIFF.step + 250); } else add(resOf(f.sniff) === 'hot' ? 'higher' : resOf(f.sniff) === 'same' ? 'hiloBlip' : 'lower', SNIFF.step); } return;   // the dog trots (its paws), then hotter, colder or the same, or it digs up the chest
}
