// Sniff: the screen, the miniature, the move's words and sounds, and the inputs.
import { SNIFF, sniffDirs, sniffStep, sniffTreasure } from './rules.js';
import { raceSide } from '../../core/race.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { other } from '../../core/util.js';

// Sniff: a meadow of 7x7 cells and the dog, nothing else of the past: no trail stays in the shared game (its rule).
// The dog's eight neighbours (inside the field, diagonals too) are the moves, each a lit tile in the mover's colour: a
// tap trots the dog there (its legs going, two little bounds, its nose down sniffing as it arrives), its paw prints
// in the walker's colour behind it; as it arrives its word lands ("Hotter!", "Colder!" or "Same") with a badge by the
// dog (a flame, a snowflake, a level sign), its nose glowing warm or cold, its tail wagging or its ears down. Once the
// move is over the prints, the badge and the word are gone. Onto the treasure: it digs (the earth flying), the chest
// comes up out of the hole and opens, the dog bounds back beside it.
// The move's moments (ms from the move; SNIFF.step, the trot, is the rules': flashMs = step + hold, + 900 on a find):
// the prints at these shares of the trot, the dig after it, the chest's rise.
export const SNIFFT = { paws: [0.1, 0.38, 0.66], dig: 520, rise: 360 };
const SNIFF_ANG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const SNIFF_WAY = { N: 'up', NE: 'up and right', E: 'right', SE: 'down and right', S: 'down', SW: 'down and left', W: 'left', NW: 'up and left' };
const resOf = s => s.res || s.r || (s.hot ? 'hot' : 'cold');
const sniffXY = c => [Math.floor(c % SNIFF.n) * 20 + 10, Math.floor(c / SNIFF.n) * 20 + 10];   // a cell's middle, 20 units a cell (the field's viewBox: 20 x n square)
const colOf = c => c % SNIFF.n, rowOf = c => Math.floor(c / SNIFF.n);
const fx1 = n => n.toFixed(1);
const SIZE = SNIFF.n * 20;
// The way the dog looks (1 right, -1 left): the way of its last step that went to a side (a step straight up or down keeps it).
const faceOf = steps => { for (let k = steps.length - 1; k >= 0; k--) { const d = colOf(steps[k][1]) - colOf(steps[k][0]); if (d) return d < 0 ? -1 : 1; } return 1; };
const pathSteps = path => (path || []).slice(1).map((c, k) => [path[k], c]);
// ----- the meadow: two greens in a chequer (the cells count: a step is a cell), tufts, clover and pebbles (the same on
// every field: nothing of the treasure), the frame's shade along the top and left -----
const TUFTS = [[14, 33], [47, 12], [93, 27], [126, 52], [31, 71], [68, 88], [109, 95], [12, 112], [52, 127], [88, 126], [129, 118], [73, 49]];
const CLOVER = [[26, 14], [112, 9], [8, 66], [133, 82], [44, 104], [97, 67]];
const DECOR = `<g class="sdecor">${TUFTS.map(([x, y], k) => `<path class="stuft" transform="translate(${x} ${y})${k % 3 === 1 ? ' scale(-1 1)' : ''}" d="M-2.2 1.4 L-1.4 -1.6 M0 1.4 L.2 -2.6 M2.2 1.4 L1.6 -1.2"/>`).join('')}${CLOVER.map(([x, y]) => `<g class="sclov" transform="translate(${x} ${y})"><circle cx="-1" cy="0" r=".9"/><circle cx="1" cy="0" r=".9"/><circle cx="0" cy="-1.2" r=".9"/></g>`).join('')}<ellipse class="speb" cx="61" cy="14.5" rx="2.2" ry="1.4"/><ellipse class="speb" cx="118.5" cy="134" rx="2.6" ry="1.5"/><ellipse class="speb" cx="24" cy="92.5" rx="1.8" ry="1.2"/></g><path class="sshade" d="M0 0 H${SIZE} V3.2 H3.2 V${SIZE} H0 Z"/>`;
const fieldCells = () => Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => { const [x, y] = sniffXY(c); return `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="scell${(rowOf(c) + colOf(c)) % 2 ? ' alt' : ''}"/>`; }).join('') + DECOR;
// ----- a dog's trail -----
// A paw print pointing along +x (a pad and three toes).
const PAW = '<ellipse cx="-.8" cy="0" rx="1.5" ry="1.35"/><circle cx="1.35" cy="-1.55" r=".68"/><circle cx="2.15" cy="0" r=".7"/><circle cx="1.35" cy="1.55" r=".68"/>';
// A dog's path: its paw prints in its owner's colour along every step (left, right, left of the line, pointing the way
// it went), over a faint line from cell to cell with a small dot on every cell it has stood on. The step playing now
// (fresh) leaves its prints one by one as the dog trots. off: a nudge to one side, so two paths along the same cells
// both show.
function sniffPath(cells, p, fresh, off) {
  if (!cells || cells.length < 2) return '';
  const pts = cells.map(c => sniffXY(c).map(v => v + (off || 0)));
  const last = pts.length - 1, [x0, y0] = pts[last - 1], [x1, y1] = pts[last];
  const done = fresh ? pts.slice(0, last) : pts;
  const old = done.length > 1 ? `<polyline class="spath ${p}" points="${done.map(q => q.map(fx1).join(',')).join(' ')}"/>` : '';
  const len = Math.hypot(x1 - x0, y1 - y0);
  const step = fresh ? `<line class="spath ${p} fresh" x1="${fx1(x0)}" y1="${fx1(y0)}" x2="${fx1(x1)}" y2="${fx1(y1)}" style="--len:${fx1(len)};--d:${SNIFF.step}ms"/>` : '';
  const dots = pts.map((q, k) => `<circle class="sdot ${p}${fresh && k === last ? ' fresh' : ''}" cx="${fx1(q[0])}" cy="${fx1(q[1])}" r=".9"${fresh && k === last ? ` style="--t:${SNIFF.step}ms"` : ''}/>`).join('');
  const paws = pts.slice(1).map((b, k) => {
    const a = pts[k], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), deg = ang * 180 / Math.PI, now = fresh && k === last - 1, nx = -Math.sin(ang), ny = Math.cos(ang);
    return SNIFFT.paws.map((f, j) => { const side = j % 2 ? 2.2 : -2.2, x = a[0] + (b[0] - a[0]) * f + nx * side, y = a[1] + (b[1] - a[1]) * f + ny * side;
      return `<g class="spaw ${p}${now ? ' fresh' : k === last - 1 ? ' new' : ''}"${now ? ` style="--t:${Math.round(SNIFF.step * f)}ms"` : ''} transform="translate(${fx1(x)} ${fx1(y)}) rotate(${fx1(deg)})">${PAW}</g>`; }).join('');
  }).join('');
  return `<g class="strail">${old}${step}${dots}${paws}</g>`;
}
// ----- the dog: an original little hound seen from the side (looking right; turned for the other way), a neckerchief in
// its player's colour -----
const SNIFF_DOG = '<g class="sdg">'
  + '<g class="stail"><path class="sto" d="M-6.2 -.6 Q-9.8 -2 -9.2 -6.6"/><path class="sti" d="M-6.2 -.6 Q-9.8 -2 -9.2 -6.6"/></g>'
  + '<rect class="sleg far a" x="-5.7" y="2" width="2.3" height="5.4" rx="1.1"/><rect class="sleg far b" x="2.5" y="2" width="2.3" height="5.4" rx="1.1"/>'
  + '<ellipse class="sbody" cx="-.8" cy=".6" rx="6.6" ry="4.3"/><ellipse class="spatch" cx="-2.8" cy="-.9" rx="2.7" ry="1.9"/>'
  + '<rect class="sleg b" x="-3.9" y="2.5" width="2.4" height="5.2" rx="1.2"/><rect class="sleg a" x=".9" y="2.5" width="2.4" height="5.2" rx="1.2"/>'
  + '<path class="sband" d="M1.6 -3.6 L5.8 -.9 L3.4 3.4 L1.3 .4 Z"/>'
  + '<g class="shd"><ellipse class="shead" cx="5.6" cy="-3.7" rx="4.5" ry="4.2"/><ellipse class="smuz" cx="8.9" cy="-2.3" rx="2.9" ry="2.2"/><circle class="sglow" cx="11.3" cy="-3.1" r="2.3"/><ellipse class="snose" cx="11.3" cy="-3.1" rx="1.2" ry="1"/><circle class="seye" cx="7.3" cy="-5" r=".9"/><path class="smouth" d="M8.3 -.9 Q9.6 .1 10.9 -1"/><g class="searw"><ellipse class="sear" cx="3.5" cy="-4" rx="1.9" ry="3.5" transform="rotate(20 3.5 -6.8)"/></g>'
  + '<g class="ssnf"><path d="M13.4 -1.2 q1.2 .5 1.4 1.8"/><path d="M13.2 .6 q.8 .3 1 1.2"/></g></g>'
  + '</g>';
// The badge by the dog as its word lands: a flame (hotter), a snowflake (colder), a level sign (the same).
const BADGE = {
  hot: '<path class="sbf" d="M0 -3.1 C2.3 -1.1 2.8 .7 1.9 2.1 C1.2 3.2 -1.2 3.2 -1.9 2.1 C-2.9 .3 -1.1 -.5 0 -3.1 Z"/><path class="sbf2" d="M0 -.4 C1 .5 1.1 1.4 .7 2 C.4 2.5 -.4 2.5 -.7 2 C-1.1 1.3 -.5 .7 0 -.4 Z"/>',
  cold: '<path class="sbc" d="M0 -3 V3 M-2.6 -1.5 L2.6 1.5 M-2.6 1.5 L2.6 -1.5"/>',
  same: '<path class="sbs" d="M-2.1 -1 H2.1 M-2.1 1 H2.1"/>',
};
const badgeAt = (c, r, t, face) => {                              // (over the dog's back, clear of its head; kept inside the field)
  if (!BADGE[r]) return '';
  const [x, y] = sniffXY(c), f = face || 1, bx0 = x - 7 * f, bx = bx0 < 5.3 || bx0 > SIZE - 5.3 ? x + 9 * f : bx0, by = Math.max(5.3, y - 10.5);
  return `<g class="sbadge" transform="translate(${bx} ${by})"><g ${lateAt('sbin ' + r, t)}><circle r="4.5" class="sbbg"/>${BADGE[r]}</g></g>`;
};
// The treasure found on cell c by a dog looking `face`: how far the dog bounds back and where the chest stands, in front
// of its nose (at the field's side both are moved in, to keep inside it).
const foundAt = (c, face) => { const x = sniffXY(c)[0], back = -5.5 * face, chest = 3 * face, lo = Math.min(x + back - 8.6, x + chest - 9.4), hi = Math.max(x + back + 8.6, x + chest + 9.4), sh = lo < 0 ? -lo : hi > SIZE ? SIZE - hi : 0; return { back: back + sh, chest: chest + sh }; };
// A dog on its cell. o: p (its owner: 'X' | 'O' | null for the shared dog), tint (the neckerchief's colour: the owner's,
// or the mover's for the shared dog), from (the cell it walks from, while its step plays), face, sc (its size), sh (a
// nudge to one side: two dogs on one cell), fsh (the nudge it starts from), r (its last word: 'hot' | 'cold' | 'same' |
// 'found'), late (the word lands as the dog arrives: timed from the move), ring (a disc of its owner's colour under it).
function dogAt(c, o) {
  const [x0, y0] = sniffXY(c), x = x0 + (o.sh || 0), y = y0, walk = o.from != null, [fx, fy] = walk ? sniffXY(o.from) : [x0, y0], sc = o.sc || 0.85;
  const back = o.r === 'found' ? foundAt(c, o.face).back : 0;     // (the treasure found: the dog bounds back, the chest in front of its nose)
  const cls = `sdw c-${o.tint || 'X'}${o.r ? ' r-' + o.r : ''}${o.r && o.late ? ' late' : ''}`;
  const dirt = o.r === 'found' && o.late ? [[-7, -6], [-10, -2], [-5, -9], [-11, -5], [-8, -8]].map(([ex, ey], k) => `<circle class="sdirt" r="${k % 2 ? 0.9 : 1.2}" cx="5" cy="6" style="--ex:${ex}px;--ey:${ey}px;--k:${k}"/>`).join('') : '';
  return `<g class="sdog${o.p ? ' ' + o.p : ''}${walk ? ' walk' : ''}" style="--dx:${fx1((fx + (o.fsh != null ? o.fsh : o.sh || 0) - x) / sc)}px;--dy:${fx1((fy - y) / sc)}px;--d:${SNIFF.step}ms;--t:${SNIFF.step}ms;--dig:${SNIFFT.dig}ms;--bx:${fx1(back / sc)}px" transform="translate(${x} ${y}) scale(${sc})"><g class="sdogin"><g class="${cls}"><g class="sdbk">${o.ring ? '<ellipse class="sown" cx="0" cy="7" rx="9.4" ry="3.3"/>' : ''}<ellipse class="sdsh" cx="0" cy="7.5" rx="7.6" ry="1.8"/><g class="sdbob"><g transform="scale(${o.face} 1)"><g class="sdrx">${SNIFF_DOG}${dirt}</g></g></g></g></g></g></g>`;
}
// The treasure, where the dog dug it up (c: its cell; face: the way the dog looks at it): the hole, the chest out of it,
// its lid open on the gold, a burst of sparkles as it comes up. late: it rises once the dog has dug (timed from the
// move); else it is simply there (a finished square).
function chestAt(c, face, late) {
  const [cx, cy] = sniffXY(c), t = late ? SNIFF.step + SNIFFT.dig : null, f = face || 1;
  const spark = late ? [[-9, -9], [0, -13], [9, -9], [-12, -1], [12, -1], [-5, -12], [5, -12]].map(([ex, ey], k) => `<path class="sspk" style="--ex:${ex}px;--ey:${ey}px;--t:${t + 80 + k * 30}ms" d="M0 -2.2 L.6 -.6 L2.2 0 L.6 .6 L0 2.2 L-.6 .6 L-2.2 0 L-.6 -.6 Z"/>`).join('') : '';
  return `<g class="schestw" transform="translate(${fx1(cx + foundAt(c, f).chest)} ${cy + 1}) scale(${f} 1)"><ellipse ${lateAt('shole', late ? SNIFF.step + 140 : null, 'sholein')} cx="0" cy="5.6" rx="7.2" ry="2.6"/><g ${lateAt('schest', t, 'srise')}><path class="sglint" d="M0 -9 L1.6 -3 L8 -5 L3 -1 L9 3 L2 2 L0 8 L-2 2 L-9 3 L-3 -1 L-8 -5 L-1.6 -3 Z"/><rect x="-6" y="-2.6" width="12" height="8" rx="1.5" class="sbox"/><path class="sgold" d="M-4.8 -2.6 Q-3.2 -5 -1.6 -2.9 Q0 -5.6 1.8 -2.9 Q3.4 -4.8 4.8 -2.6 Z"/><rect x="-6" y="-.2" width="12" height="1.6" class="sstrap"/><rect x="-1.4" y="-.9" width="2.8" height="3.2" rx=".6" class="slock"/><g ${lateAt('slidw', late ? t + 160 : null, 'slidup')}><path d="M-6 -2.6 Q-6 -8.2 0 -8.2 Q6 -8.2 6 -2.6 Z" class="slid"/></g></g>${spark}</g>`;
}
// The cells the dog may step to: a lit tile each, ringed in the mover's colour, an arrow the way it goes.
const movesAt = (c, p) => `<g class="smoves ${p}">${sniffDirs(c).map(d => { const to = sniffStep(c, d), [x, y] = sniffXY(to), ar = SNIFF_ANG[d];
  return `<g class="smove" data-act="move" ${mv(d)} role="button" tabindex="0" aria-label="Walk ${SNIFF_WAY[d]}"><rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="shit"/><rect x="${x - 8.6}" y="${y - 8.6}" width="17.2" height="17.2" rx="4.2" class="sstep"/><path class="sarrow" transform="translate(${x} ${y}) rotate(${ar})" d="M0 -4.6 L4.1 .4 L1.5 .4 L1.5 4.4 L-1.5 4.4 L-1.5 .4 L-4.1 .4 Z"/></g>`; }).join('')}</g>`;
const field = (inner, label) => `<svg class="sfield" viewBox="0 0 ${SIZE} ${SIZE}" ${label ? `role="group" aria-label="${label}"` : 'aria-hidden="true"'}>${fieldCells()}${inner}</svg>`;
// Race mode (core/race.js, `rv: 2`): a treasure each, both dogs open (ui/race.js raceBoards): this phone's own field large
// (its dog, its whole trail of prints, the lit tiles, its step's word in the reserved line), the other player's smaller
// under it (their dog and trail, their newest step's prints as it lands, its word in the reserved line and their last
// word by their name). Each dog keeps its last word's badge (it is by their name and in the miniature too). A finished
// square reviewed shows both treasures.
const WORD = { hot: 'Hotter', cold: 'Colder', same: 'Same', found: 'Found it' };
// One player's field: their dog and trail (the step playing now leaving its prints, the dog trotting), the chest once found (or, reviewed, where it lay).
function raceField(mini, p, a, o) {
  const part = raceSide(mini, p);
  if (!part) return field('', '');
  const st = a && a.sniff && a.by === p ? a.sniff : null, path = part.path || [part.dog], face = faceOf(pathSteps(path));
  const l = part.last, r = l ? (l.found ? 'found' : l.res || (l.hot ? 'hot' : 'cold')) : null, found = r === 'found';
  const dog = dogAt(part.dog, { p, tint: p, from: st ? st.f : null, face, sc: SNIFF_SC, r, late: !!st, ring: true });
  const t = o.view ? sniffTreasure(mini, p) : null;
  const chest = found ? chestAt(part.dog, face, !!st) : t != null ? chestAt(t, 1, false) : '';
  const badge = r && !found ? badgeAt(part.dog, r, st ? SNIFF.step : null, face) : '';
  const moves = o.moves ? movesAt(part.dog, p) : '';
  return field(`${sniffPath(path, p, !!st, 0)}${moves}${found ? chest + dog : dog + chest}${badge}`, o.label);
}
function sniffRaceTable(mini, a, o) {
  const me = raceMe(), them = raceThem(), part = raceSide(mini, me), s = a && a.sniff ? a.sniff : null;
  const moves = !o.view && !o.locked && !s && part && o.turn === me;
  const r = s ? (s.found ? 'found' : resOf(s)) : null, cls = r === 'found' || r === 'hot' ? 'hot' : r === 'same' ? 'same' : 'cold', at = SNIFF.step + (r === 'found' ? SNIFFT.dig : 0);
  const res = s && a.by === me ? `<p ${lateAt('arcres ' + cls, at)} role="status">${WORD[r]}${r === 'same' ? '' : '!'}</p>`
    : s ? `<p ${lateAt('arcres ' + cls, at)} role="status"><b class="${a.by} srn">${N(a.by)}</b> · ${WORD[r]}${r === 'same' ? '' : '!'}</p>`   // the other dog's step: its word, as it lands on their field
    : `<p class="arcnote">${o.view || !o.locked ? '' : waitLine(o.turn)}</p>`;
  const mine = `<div class="srv2">${raceField(mini, me, a, { view: o.view, moves, label: 'Your field and your dog' })}${res}</div>`;
  const tp = raceSide(mini, them), n = tp ? Math.max(0, (tp.path || []).length - 1) : 0, l = tp && tp.last, w = l ? WORD[l.found ? 'found' : l.res || (l.hot ? 'hot' : 'cold')] : '';
  const theirs = `<div class="sopp">${raceField(mini, them, a, { view: o.view, moves: false, label: 'The other player\'s field and dog' })}</div>`;
  return raceBoards(mine, theirs, `${n} step${n === 1 ? '' : 's'}${w ? ` · ${w}` : ''}`, { cls: 'srb' });
}
function sniffTable(mini, a, o) {
  if (mini.race) return sniffRaceTable(mini, a, o);
  if (mini.dogs) return sniffScTable(mini, a, o);
  const s = a && a.sniff ? a.sniff : null, turn = o.turn, l = mini.last;
  const tal = p => arcTally(p, o, '');
  const by = s ? (a.by === 'O' ? 'O' : 'X') : o.view && l && l.by ? l.by : turn;   // whose neckerchief the shared dog wears: the walker's while a step plays, else the player's on the move
  const paws = s ? sniffPath([s.f, s.t], by, true, 0) : '';        // this move's step only, while it plays (nothing stays on the board)
  const face = faceOf((mini.trail || []).map(x => [x.f, x.t]).concat(s ? [[s.f, s.t]] : l ? [[l.f, l.t]] : []));
  const moves = o.locked || s || o.view ? '' : movesAt(mini.dog, turn);
  const found = s ? s.found : !!(l && l.found), r = s ? (s.found ? 'found' : resOf(s)) : found ? 'found' : null;
  const chest = found ? chestAt(mini.dog, face, !!s) : '';
  const dog = dogAt(mini.dog, { p: null, tint: by, from: s ? s.f : null, face, r, late: !!s });
  const badge = s && !s.found ? badgeAt(mini.dog, r, SNIFF.step, face) : '';
  const word = s ? (s.found ? 'Found it!' : r === 'hot' ? 'Hotter!' : r === 'same' ? 'Same' : 'Colder!') : null;
  const res = s ? `<p ${lateAt('arcres ' + (s.found || r === 'hot' ? 'hot' : r === 'same' ? 'same' : 'cold'), SNIFF.step + (s.found ? SNIFFT.dig : 0))} role="status">${word}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : `<p class="arcnote">${o.locked ? waitLine(turn) : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="sniff">${field(`${paws}${moves}${found ? chest + dog : dog + chest}${badge}`, 'The field and the dog')}${res}</div></div>`;
}
// Super Chaos: a dog each (a disc of its owner's colour under it, its neckerchief theirs), both from the middle, and both
// trails, each in its owner's colour (sniffPath). The lit tiles are round the mover's own dog; the step playing out walks
// that dog and leaves its newest prints (both dogs at once at the round's end when both walked: a.scr.steps).
// Two dogs on one cell stand side by side.
const SNIFF_SC = 0.72;
function sniffScTable(mini, a, o) {
  const s = a && a.sniff ? a.sniff : null, jt = a && a.scr && a.scr.steps ? a.scr.steps : null, turn = o.turn, by = s ? a.by : null;
  const stepOf = p => (jt ? jt[p] || null : p === by ? s : null);
  const twin = mini.paths.X.length > 1 && mini.paths.O.length > 1;   // (both have walked: each path a little to its side)
  const paws = ['X', 'O'].map(p => sniffPath(mini.paths[p], p, !!stepOf(p), twin ? (p === 'X' ? -1.2 : 1.2) : 0)).join('');   // each dog's whole trail in its own colour; the step playing now leaves its prints
  const same = mini.dogs.X === mini.dogs.O;
  const fby = jt ? ['X', 'O'].find(p => jt[p] && jt[p].found) || null : s ? by : mini.last && mini.last.by, found = jt ? !!fby : s ? s.found : !!(mini.last && mini.last.found);
  const dog = p => {
    const st = stepOf(p), sh = same ? (p === 'X' ? -4 : 4) : 0, walk = !!st;
    const was = q => (stepOf(q) ? stepOf(q).f : mini.dogs[q]), fsh = walk && st.f === was(other(p)) ? (p === 'X' ? -4 : 4) : sh;
    const r = st ? (st.found ? 'found' : resOf(st)) : found && fby === p ? 'found' : null;
    return dogAt(mini.dogs[p], { p, tint: p, from: walk ? st.f : null, face: faceOf(pathSteps(mini.paths[p])), sc: SNIFF_SC, sh, fsh, r, late: walk, ring: true });
  };
  const me = o.view ? null : turn, at = me ? mini.dogs[me] : null;
  const moves = o.locked || s || jt || !me ? '' : movesAt(at, me);
  const chest = found && fby ? chestAt(mini.dogs[fby], faceOf(pathSteps(mini.paths[fby])), !!(s || jt)) : '';
  const r = s ? resOf(s) : null, word = s ? (s.found ? 'Found it!' : r === 'hot' ? 'Hotter!' : r === 'same' ? 'Same' : 'Colder!') : null;
  const both = jt ? ['X', 'O'].filter(p => jt[p]).map(p => `<b class="${p}">${N(p)}</b> ${jt[p].found ? 'found it!' : resOf(jt[p]) === 'hot' ? 'hotter' : resOf(jt[p]) === 'same' ? 'same' : 'colder'}`).join(' · ') : '';
  const badges = ['X', 'O'].map(p => { const st = stepOf(p); return st && !st.found ? badgeAt(mini.dogs[p], resOf(st), SNIFF.step, faceOf(pathSteps(mini.paths[p]))) : ''; }).join('');
  const res = jt ? `<p ${lateAt('arcres ' + (fby ? 'hot' : 'same'), SNIFF.step + (fby ? SNIFFT.dig : 0))} role="status">${both}</p>`
    : s ? `<p ${lateAt('arcres ' + (s.found || r === 'hot' ? 'hot' : r === 'same' ? 'same' : 'cold'), SNIFF.step + (s.found ? SNIFFT.dig : 0))} role="status">${word}</p>` : '<p class="arcnote"></p>';
  const order = by === 'X' ? ['O', 'X'] : ['X', 'O'];             // (the walking dog over the other)
  return `<div class="g-arc"><div class="ctals">${arcTally('X', o, '')}${arcTally('O', o, '')}</div><div class="sniff">${field(`${paws}${moves}${chest}${order.map(dog).join('')}${badges}`, 'The field and both dogs')}${res}</div></div>`;
}
// ----- the miniature: the meadow small, the dog's head on its cell, big enough to see -----
const MINI_DOG = '<g class="tsd"><ellipse class="sear" cx="-6" cy="-1" rx="2.7" ry="4.8" transform="rotate(18 -6 -1)"/><ellipse class="sear" cx="6" cy="-1" rx="2.7" ry="4.8" transform="rotate(-18 6 -1)"/><circle r="6.6" class="shead"/><ellipse cx="0" cy="2.7" rx="3.6" ry="2.7" class="smuz"/><circle cx="-2.4" cy="-1.5" r="1" class="seye"/><circle cx="2.4" cy="-1.5" r="1" class="seye"/><ellipse cx="0" cy="1.7" rx="1.5" ry="1.05" class="snose"/></g>';
const miniCells = () => `<rect class="tsnbg" x="1.5" y="1.5" width="${SIZE - 3}" height="${SIZE - 3}" rx="10"/>${Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => ((rowOf(c) + colOf(c)) % 2 ? `<rect class="tsnc" x="${colOf(c) * 20 + 2}" y="${rowOf(c) * 20 + 2}" width="16" height="16" rx="3"/>` : '')).join('')}`;
const miniAt = (c, k, sh) => { const [x, y] = sniffXY(c), lim = v => Math.max(9 * k, Math.min(SIZE - 9 * k, v)); return [lim(x + (sh || 0)), lim(y)]; };   // (the head kept inside the field)
// A race miniature's half: one player's little field, their path and their dog, the dog's ring the colour of their last word
// (hotter orange, colder blue, the same grey; found: gold).
function sniffMiniField(part, p) {
  if (!part) return `<svg class="tsniff tsn2" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${miniCells()}</svg>`;
  const path = part.path || [part.dog], [x, y] = miniAt(part.dog, 2.2), l = part.last, heat = l ? (l.found ? 'found' : l.res || (l.hot ? 'hot' : 'cold')) : 'none';
  return `<svg class="tsniff tsn2" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${miniCells()}${path.length > 1 ? `<polyline class="tpath ${p}" points="${path.map(c => sniffXY(c).join(',')).join(' ')}"/>` : ''}<circle class="tdog ${p} th-${heat}" cx="${x}" cy="${y}" r="19"/><g transform="translate(${x} ${y + 1}) scale(2.2)">${MINI_DOG}</g></svg>`;
}
export function miniature(mini, final) {
  if (mini.race) return raceThumb(p => sniffMiniField(raceSide(mini, p), p), 'tsnr2', `Race: ${['X', 'O'].map(p => { const part = raceSide(mini, p), n = part ? Math.max(0, (part.path || []).length - 1) : 0; return `${p} ${n} step${n === 1 ? '' : 's'}`; }).join(', ')}`);
  if (mini.dogs) {
    const line = p => `<polyline class="tpath ${p}" points="${mini.paths[p].map(c => sniffXY(c).map(v => v + (mini.paths[p].length && p === 'X' ? -2 : 2)).join(',')).join(' ')}"/>`;
    const dot = p => { const [x, y] = miniAt(mini.dogs[p], 1.5, mini.dogs.X === mini.dogs.O ? (p === 'X' ? -11 : 11) : 0); return `<circle class="tdog ${p}" cx="${x}" cy="${y}" r="13"/><g transform="translate(${x} ${y + 1}) scale(1.5)">${MINI_DOG}</g>`; };
    return `<svg class="tsniff" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${miniCells()}${line('X')}${line('O')}${dot('X')}${dot('O')}</svg>`;
  }
  const [x, y] = miniAt(mini.dog, 2.2);
  return `<svg class="tsniff" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${miniCells()}<ellipse class="tsdsh" cx="${x}" cy="${y + 16}" rx="13" ry="3.4"/><g transform="translate(${x} ${y}) scale(2.2)">${MINI_DOG}</g></svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = sniffTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.steps) return ['X', 'O'].filter(p => f.scr.steps[p]).map(p => `${N(p)}: ${f.scr.steps[p].found ? 'found it!' : resOf(f.scr.steps[p]) === 'hot' ? 'hotter' : resOf(f.scr.steps[p]) === 'same' ? 'the same' : 'colder'}`).join(' · ');
  return f.sniff ? `${who} walked ${f.sc || f.race ? 'their' : 'the'} dog: ${f.sniff.found ? 'found it!' : resOf(f.sniff) === 'hot' ? 'hotter' : resOf(f.sniff) === 'same' ? 'the same' : 'colder'}` : `${who} walked the dog`;
}
// The dog trots (its paws, a print at a time), sniffs as it arrives, then its word's sound (hotter, colder, the same) as
// the word lands; onto the treasure: it digs (twice), the chest pops up and sparkles.
function stepSounds(st, add, t0) {
  if (st.found) { add('dig', t0); add('dig', t0 + Math.round(SNIFFT.dig * 0.5)); add('pop', t0 + SNIFFT.dig); add('sparkle', t0 + SNIFFT.dig + 120); }
  else add(resOf(st) === 'hot' ? 'higher' : resOf(st) === 'same' ? 'hiloBlip' : 'lower', t0);
}
export function sounds(f, add, won, mini, last) {
  const trot = () => { SNIFFT.paws.forEach(k => add('hop', Math.round(SNIFF.step * k))); add('sniffSnf', Math.round(SNIFF.step * 0.62)); };
  if (f.scr && f.scr.steps) {                                      // both dogs trot at once, then each one's word (or a dig)
    trot();
    ['X', 'O'].filter(p => f.scr.steps[p]).forEach((p, k) => stepSounds(f.scr.steps[p], add, SNIFF.step + k * 140));
    return;
  }
  if (f.sniff) { trot(); stepSounds(f.sniff, add, SNIFF.step); }
}
