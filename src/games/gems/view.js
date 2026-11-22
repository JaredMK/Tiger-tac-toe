// Gem Swap: the screen, the miniature, the move's words and sounds, and the picking and dragging of gems.
// The board is a tray of gems, one button a cell, sized from the room it has. Six original gems, each its own SHAPE as
// well as its own colour (a round one, a square-cut one, a triangle, a hexagon, a star and a teardrop: never told apart
// by colour alone, and none in a player's red or yellow). A tap picks a gem (a ring in the mover's colour), a tap on a
// neighbour swaps the two; a drag from a gem towards a neighbour swaps at once. A swap that makes no line is not sent:
// the two gems nudge towards each other and come back with a soft "no".
// A move plays from the move itself (its flash), for everyone: the two gems change places (GEMS.swap), then each step
// of the cascade: its gems burst (GEMS.pop), the rest fall and the new ones drop in from the top (GEMS.fall), the
// mover's points counting on with each burst ("+3", then "+7 Combo!" in the line under the board), and a shuffle's
// swirl at the end where the board was left with no swap (GEMS.shuffle: the line says "Shuffle!"). Every moment comes from `gemsTimes`. The board
// is drawn as one layer a moment (the board as it was, then before each step, then as it ends), each on show only in
// its own time (`--f` to `--u`), so a gem's whole way down is plain stylesheet animation and a redraw mid-move carries on.
// Online the new gems are the server's draw: until its record lands the two gems only show pressed.
import { GEMS, gemsArr, gemsCfg, gemsFrames, gemsNear, gemsTimes, gemsValid } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, moveWait } from '../../net/room.js';
import { N, REDUCED, app, state } from '../../ui/app.js';
import { arcTally, gaugeBar } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // a pick is never sent: the swap plays from the move, for everyone
export const hold = f => (f.kind === 'again' ? 0 : null);         // a swap that keeps the turn ("Go again" on): on to the next the moment it has played
export const GEMSV = { drag: 0.38, nudge: 240 };                   // a drag this share of a cell swaps; the nudge of a swap refused (ms)
// The gems (40 by 40): the cut stone's outline, its table (the lighter facet), its colours, and its name for a screen reader.
const KINDS = [
  { name: 'round blue gem', o: 'M5.5 20a14.5 14.5 0 1 0 29 0a14.5 14.5 0 1 0-29 0z', i: 'M11.5 20a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', c: '#3f8ff0', l: '#a9d0ff' },
  { name: 'square green gem', o: 'M11 5.5h18l5.5 5.5v18l-5.5 5.5H11L5.500 29V11z', i: 'M12.5 12.5h15v15h-15z', c: '#3fbf62', l: '#a8ecb6' },
  { name: 'pink triangle gem', o: 'M20 4.500 36.500 33.500h-33z', i: 'M20 14.500 28 28.500H12z', c: '#f062a6', l: '#ffc0dc' },
  { name: 'purple hexagon gem', o: 'M20 3.500 34.300 11.750v16.500L20 36.500 5.700 28.250v-16.500z', i: 'M20 11 27.800 15.500v9L20 29l-7.800-4.500v-9z', c: '#9a66e6', l: '#d6c0ff' },
  { name: 'white star gem', o: 'M20 3.500 24.300 14.600 36.200 15.200 26.900 22.700 30 34.200 20 27.700 10 34.200 13.100 22.700 3.800 15.200 15.700 14.600z', i: 'M20 13.500 22.600 18.200 27.400 19 23.900 22.600 24.600 27.500 20 25.300 15.400 27.500 16.100 22.600 12.600 19 17.400 18.200z', c: '#f1f5ff', l: '#bccdf2' },
  { name: 'teal teardrop gem', o: 'M20 3.500C25.500 11 32 17.500 32 24.500a12 12 0 0 1-24 0C8 17.500 14.500 11 20 3.500z', i: 'M13.500 24.500a6.500 6.500 0 1 0 13 0a6.500 6.500 0 1 0-13 0z', c: '#18bfb9', l: '#a6f0ec' },
];
const DEFS = `<svg class="gsdefs" width="0" height="0" aria-hidden="true"><defs>${KINDS.map((q, k) => `<symbol id="gsk${k}" viewBox="0 0 40 40"><path d="${q.o}" transform="translate(0 2.2)" fill="rgba(0,0,0,.4)" stroke="rgba(0,0,0,.4)" stroke-width="2.6" stroke-linejoin="round"/><path d="${q.o}" fill="${q.c}" stroke="#161210" stroke-width="2.6" stroke-linejoin="round"/><path d="${q.i}" fill="${q.l}"/><path d="M12.500 14.500l3-3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></symbol>`).join('')}</defs></svg>`;
const gem = k => `<svg class="gsg" viewBox="0 0 40 40" aria-hidden="true"><use href="#gsk${k}"/></svg>`;
const at = (i, n) => `--gc:${i % n};--gr:${Math.floor(i / n)}`;
// ---- this phone's pick, its swap on the way to the server, and the drag ----
let pick = null, sent = null, drag = null, eat = false, hooked = false;   // pick: { sq, i, b }; sent: { sq, a, b, was }
const cur = () => { const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini; return m && m.type === 'gems' && !state.flash && !state.done && !blocked() ? m : null; };
const picked = mini => (pick && pick.sq === state.zoom && pick.b === mini.b ? pick.i : -1);
// A swap refused: the two gems lean towards each other and come back (on the page as it stands: nothing is redrawn for it).
function nudge(a, b, n) {
  if (REDUCED || !app || typeof app.querySelector !== 'function') return;
  const dx = (b % n) - (a % n), dy = Math.floor(b / n) - Math.floor(a / n);
  for (const [i, s] of [[a, 1], [b, -1]]) {
    const el = app.querySelector(`.gsgrid .gsc[data-i="${i}"]`);
    try { if (el && el.animate) el.animate([{ translate: '0 0' }, { translate: `${dx * s * 28}% ${dy * s * 28}%`, offset: 0.4 }, { translate: '0 0' }], { duration: GEMSV.nudge, easing: 'ease-out' }); } catch (e) { /* (no individual transforms: no nudge) */ }
  }
}
function trySwap(m, a, b) {
  pick = null;
  if (!gemsValid(gemsArr(m.b), m.n, a, b)) { render(); nudge(a, b, m.n); SND.play('gsNo'); haptic('tap'); return; }
  sent = { sq: state.zoom, a, b, was: m.b };
  attemptMove({ a, b });
}
function tapAct(el) {
  const m = cur(); if (!m) return;
  const i = Number(el.dataset.i); if (!(i >= 0 && i < m.n * m.n)) return;
  const pk = picked(m);
  if (pk === i) { pick = null; SND.play('gsPick', { rate: 0.8 }); render(); return; }   // put down
  if (pk >= 0 && gemsNear(m.n, pk, i)) { trySwap(m, pk, i); return; }
  pick = { sq: state.zoom, i, b: m.b }; SND.play('gsPick'); haptic('tap'); render();
}
export const actions = { 'gems-cell': el => { ownPress(); tapAct(el); } };
// The drag: a press on a gem that travels a good part of a cell towards a neighbour swaps with it (the click that ends
// the press is swallowed: it would be read as a tap on the move now playing).
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('.gsgrid.live .gsc[data-i]');
    drag = el && cur() ? { id: e.pointerId, i: Number(el.dataset.i), x: e.clientX, y: e.clientY, u: el.getBoundingClientRect().width || 40 } : null;
  }, { passive: true });
  app.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < drag.u * GEMSV.drag) return;
    const d = drag, m = cur(); drag = null;
    if (!m) return;
    const n = m.n, across = Math.abs(dx) > Math.abs(dy), r = Math.floor(d.i / n) + (across ? 0 : Math.sign(dy)), c = d.i % n + (across ? Math.sign(dx) : 0);
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    eat = true; ownPress(); trySwap(m, d.i, r * n + c);
  }, { passive: true });
  const end = e => { if (drag && e.pointerId === drag.id) drag = null; if (eat) setTimeout(() => { eat = false; }, 80); };
  app.addEventListener('pointerup', end); app.addEventListener('pointercancel', end);
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('click', e => { if (eat) { eat = false; e.stopPropagation(); e.preventDefault(); } }, true);
}
// What the line says once step k of a cascade has burst: the swap's points so far, and the cascade's count.
const words = (tot, k) => `+${tot}${k >= 2 ? ` Combo x${k + 1}!` : k === 1 ? ' Combo!' : ''}`;
// A move as layers: the board as it was (the two gems changing places), the board before each step (its gems bursting,
// the rest falling, the new ones dropping in), the board at the end (after a shuffle's swirl, the board laid out again).
function layers(s, n, T) {
  const fr = gemsFrames(s, n), K = s.steps.length, out = [];
  const layer = (cls, f, u, cells) => `<div class="gsl${cls}" style="--f:${Math.round(f)}ms${u != null ? `;--u:${Math.round(u)}ms` : ''}">${cells}</div>`;
  const dc = (s.b % n) - (s.a % n), dr = Math.floor(s.b / n) - Math.floor(s.a / n);
  out.push(layer('', 0, GEMS.swap, fr[0].map((k, i) => `<i class="gsc${i === s.a || i === s.b ? ' swap' : ''}" style="${at(i, n)}${i === s.a ? `;--dx:${dc};--dy:${dr}` : i === s.b ? `;--dx:${-dc};--dy:${-dr}` : ''}">${gem(k)}</i>`).join('')));
  s.steps.forEach((st, k) => {
    const g = fr[k + 1], after = fr[k + 2], t = T.steps[k], gone = new Set(st.x), col = new Array(n).fill(0); let cells = '';
    for (const i of st.x) col[i % n]++;
    for (let i = 0; i < n * n; i++) {
      if (gone.has(i)) { cells += `<i class="gsc pop" style="${at(i, n)};--t:${t.pop}ms">${gem(g[i])}</i>`; continue; }
      let d = 0; for (let j = i + n; j < n * n; j += n) if (gone.has(j)) d++;
      cells += `<i class="gsc${d ? ' fall' : ''}" style="${at(i, n)}${d ? `;--d:${d};--t:${t.fall}ms` : ''}">${gem(g[i])}</i>`;
    }
    for (let c = 0; c < n; c++) for (let r = 0; r < col[c]; r++) cells += `<i class="gsc drop" style="${at(r * n + c, n)};--d:${col[c]};--t:${t.fall}ms">${gem(after[r * n + c])}</i>`;
    out.push(layer('', t.pop, k + 1 < K ? T.steps[k + 1].pop : T.casc, cells));
  });
  const still = g => g.map((k, i) => `<i class="gsc" style="${at(i, n)}">${gem(k)}</i>`).join('');
  if (T.sh != null) { const half = T.sh + GEMS.shuffle / 2; out.push(layer(' swirl', T.sh, half, still(fr[K + 1]))); out.push(layer(' fin unswirl', half, null, still(gemsArr(s.sh)))); }
  else out.push(layer(' fin', T.casc, null, still(fr[K + 1])));
  return out.join('');
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = gemsCfg(mini), n = mini.n, s = a && a.gs && a.gs.steps ? a.gs : null, o = { view, locked, turn };
  if (s || (sent && sent.was !== mini.b)) sent = null;             // (the swap has landed, or the board has moved on)
  const rest = !s && (view || d) && mini.last ? mini.last : null, by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d;
  const T = s ? gemsTimes(s) : null, cap = v => Math.min(c.target, v);
  // each player's points: the mover's count on burst by burst (a stack of figures, each on show from its burst to the next)
  const tal = p => {
    const mover = s && a.by === p, to = cap(mover ? s.to : mini.pts[p]), from = mover ? cap(s.from) : to;
    let num = `<b>${to}</b>`, bar = gaugeBar({ goal: c.target, now: to });
    if (mover && to !== from) {
      const vals = [[from, 0]]; let acc = s.from;
      s.steps.forEach((st, k) => { acc += st.x.length; vals.push([cap(acc), T.steps[k].pop + GEMS.pop / 2]); });
      num = `<span class="gsn">${vals.map(([v, t], k) => `<b class="gsv${k + 1 < vals.length ? '' : ' fin'}" style="--f:${Math.round(t)}ms${k + 1 < vals.length ? `;--u:${Math.round(vals[k + 1][1])}ms` : ''}">${v}</b>`).join('')}</span>`;
      bar = gaugeBar({ goal: c.target, now: to, was: from, at: vals[1][1], ms: vals[vals.length - 1][1] - vals[1][1] + 300 });
    }
    return arcTally(p, o, `<span class="wtal">${bar}<span class="npts" aria-label="${to} of ${c.target}">${num}<small>/${c.target}</small></span></span>`);
  };
  let board, line = '';
  if (s) {
    board = layers(s, n, T);
    let acc = 0; const say = s.steps.map((st, k) => { acc += st.x.length; return [words(acc, k), T.steps[k].pop + GEMS.pop / 2]; });
    if (T.sh != null) say.push(['Shuffle!', T.sh]);              // (short: on a small phone the line shares its height with a replay's Skip and the reactions' button in the corners)
    line = say.map(([w, t], k) => `<span class="gsw${k + 1 < say.length ? '' : ' fin'}" style="--f:${Math.round(t)}ms${k + 1 < say.length ? `;--u:${Math.round(say[k + 1][1])}ms` : ''}">${w}</span>`).join('');
  } else {
    const arr = gemsArr(mini.b), pk = mine ? picked(mini) : -1, wait = sent && sent.sq === state.zoom && moveWait && !view ? sent : null;
    board = `<div class="gsl still">${arr.map((k, i) => {
      const on = pk === i, w = wait && (wait.a === i || wait.b === i), cls = `gsc${on || w ? ' pick' : ''}${w ? ' pend' : ''}`;
      return mine ? `<button class="${cls}" data-act="gems-cell" data-i="${i}" style="${at(i, n)}" aria-pressed="${on}" aria-label="${KINDS[k].name}, row ${Math.floor(i / n) + 1}, column ${i % n + 1}">${gem(k)}</button>` : `<i class="${cls}" data-i="${i}" style="${at(i, n)}">${gem(k)}</i>`;
    }).join('')}</div>`;
    const fin = mini.final, ans = fin ? (fin.by === 'X' ? 'O' : 'X') : null;
    if (rest && rest.steps) line = `<span class="gsw fin">${words(rest.n, rest.steps.length - 1)}</span>`;
    else if (fin && !view) line = `<span class="gsw fin note">${turn === ans ? `Beat ${fin.pts} to take it` : `${fin.pts} to beat`}</span>`;   // (Equal turns: the answer owed; the tally stops at the target, so the total to beat is said here)
  }
  return `<div class="g-gs pc-${by}" style="--ts:${GEMS.swap}ms;--tp:${GEMS.pop}ms;--tf:${GEMS.fall}ms;--th:${GEMS.shuffle / 2}ms">${DEFS}<div class="ctals two">${tal('X')}${tal('O')}</div><div class="gsbox"><div class="gsgrid${mine ? ' live' : ''}" style="--n:${n}" role="group" aria-label="The gems">${board}</div><p class="gsline" role="status">${line}</p></div></div>`;
}
// The line under the game's name while a big swap keeps the turn ("Go again on success" on: ui/mini.js heldSub).
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> burst a big bunch · goes again`; }
// The miniature: the tray of gems as it stands (each a small shape in its colour), beside each player's points as a bar.
const q = v => +v.toFixed(1);
const MINI = [
  (x, y) => `<circle cx="${x}" cy="${y}" r="3.7"/>`,
  (x, y) => `<rect x="${q(x - 3.4)}" y="${q(y - 3.4)}" width="6.8" height="6.8" rx="1.2"/>`,
  (x, y) => `<path d="M${x} ${q(y - 4)}l4.2 7.4h-8.4z"/>`,
  (x, y) => `<path d="M${x} ${q(y - 4.2)}l3.7 2.1v4.2l-3.7 2.1-3.7-2.1v-4.2z"/>`,
  (x, y) => `<path d="M${x} ${q(y - 4.4)}l1.3 3 3.2.2-2.5 2 .9 3.2-2.9-1.800-2.9 1.800.9-3.200-2.500-2 3.200-.200z"/>`,
  (x, y) => `<path d="M${x} ${q(y - 4.4)}c1.5 2 3.3 3.6 3.3 5.500a3.300 3.300 0 0 1-6.600 0c0-1.900 1.800-3.500 3.300-5.500z"/>`,
];
export function miniature(mini, final) {
  const c = gemsCfg(mini), n = mini.n, W = n * 10 + 4, arr = gemsArr(mini.b);
  const art = `<svg class="tgs" viewBox="0 0 ${W} ${W}"><rect class="tgsb" x="1" y="1" width="${W - 2}" height="${W - 2}" rx="5"/>${arr.map((k, i) => `<g class="tgsk" fill="${(KINDS[k] || KINDS[0]).c}">${(MINI[k] || MINI[0])(i % n * 10 + 7, Math.floor(i / n) * 10 + 7)}</g>`).join('')}</svg>`;
  return thumbArt(art, barRows(mini.pts, c.target), 'tgsw', `Gem Swap: X ${Math.min(c.target, mini.pts.X)}, O ${Math.min(c.target, mini.pts.O)} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.gs; return s ? `${who} swapped for ${s.n}${s.steps.length > 1 ? ' with a combo' : ''}` : `${who} swapped`; }
// The two gems sliding past each other; then each step's burst, a note higher with every step of the cascade, and the
// gems landing; a chime where the cascade ran three steps or more; the rattle of a shuffle.
export function sounds(f, add, won, mini, last) {
  const s = f.gs; if (!s || !s.steps) return;
  const T = gemsTimes(s);
  add('gsSwap', 0);
  T.steps.slice(0, 12).forEach((t, k) => { add('gsPop', t.pop, 1 + Math.min(k, 8) * 0.12); add('gsLand', t.land - 50, 1 + Math.min(k, 8) * 0.04); });
  if (T.steps.length >= 3) add('sparkle', T.steps[2].pop + 90);
  if (T.sh != null) add('gsShuffle', T.sh);
}
