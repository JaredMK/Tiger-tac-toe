// Flood: the screen, the miniature, the move's words and sounds, and the inputs.
import { FLOOD, FLOOD_MS, floodCfg, floodNear, floodWaves } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt, sbar } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// Flood: the 6x6 grid of colour tiles; the blob is one joined shape, and every cell a player has grabbed carries their
// token (a disc in their colour with their drawn mark). The colour buttons below (not the blob's own). A move: the
// blob takes the colour in a ripple out from its start, then the cells it grabs join it wave by wave, each with a
// token dropping on; the count by the name and the bar under the grid run on as the waves land. Pressing a colour
// rings the cells it would grab (the stylesheet's :has rule: no control changes).
const FLOOD_COL = ['#3d7fe0', '#21b2a6', '#8d5bd8', '#86c440', '#f06aa8'];
const FLOOD_NAMES = ['blue', 'teal', 'purple', 'green', 'pink'];
// The move's moments (ms from the move; rules.js FLOOD_MS and flashMs): the blob is dyed by `wave0`, the k-th wave of
// grabbed cells joins at wave0 + k * step, and the move is over at `end` (a win's payoff runs from there).
export const floodTimes = fl => { const w = fl ? fl.waves.length : 0, wave0 = Math.round(FLOOD_MS.base * 0.55); return { wave0, step: FLOOD_MS.wave, last: wave0 + Math.max(0, w - 1) * FLOOD_MS.wave, end: FLOOD_MS.base + w * FLOOD_MS.wave }; };
const tok = p => `<span class="fltok ${p}"><svg viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, 5)}</svg></span>`;
// How far each cell of the blob as it was before the move is from the start cell, through the blob (the dye's ripple).
function dyeDepth(owner, fresh) {
  const d = {}; let front = [0], k = 0;
  d[0] = 0;
  while (front.length) { const next = []; k++; for (const i of front) for (const j of floodNear(i)) if (d[j] == null && owner[j] != null && !fresh[j]) { d[j] = k; next.push(j); } front = next; }
  return d;
}
function floodTable(mini, a, o) {
  const fl = a && a.flood ? a.flood : null, turn = o.turn === 'O' ? 'O' : 'X', blob = mini.colors[0];
  const { goal, colors: nc } = floodCfg(mini), T = floodTimes(fl), n = FLOOD.n;
  const now = p => Math.min(goal, mini.score[p]), was = p => (fl && a.by === p ? Math.min(goal, mini.score[p] - fl.gain) : now(p));
  const runMs = fl ? Math.max(200, (fl.waves.length - 1) * T.step + 200) : 0;
  const tal = p => arcTally(p, o, `<span class="flsc" aria-label="${now(p)} of ${goal} squares">${was(p) !== now(p) ? `<b class="cnt" data-from="${was(p)}" data-delay="${T.wave0}" data-ms="${runMs}">${now(p)}</b>` : `<b>${now(p)}</b>`}<small>/${goal}</small></span>`);
  // the bar chart: each player's cells against the target
  const fbar = p => `<div class="fbr ${p}"><b class="${p}">${p}</b>${sbar([{ cls: p, n: now(p), n0: was(p), label: p }, { cls: 'E', n: goal - now(p), n0: goal - was(p), label: 'To go' }], goal, fl && a.by === p ? T.wave0 : null, true)}<i class="fgoal${now(p) >= goal ? ' on' : ''}" aria-hidden="true"></i></div>`;
  const waveOf = {};
  if (fl) fl.waves.forEach((w, k) => w.forEach(i => { waveOf[i] = k; }));
  const depth = fl ? dyeDepth(mini.owner, waveOf) : null, maxD = depth ? Math.max(1, ...Object.values(depth)) : 1, dyeStep = Math.min(42, (T.wave0 - 170) / maxD);
  const lastOf = {};                                                 // the cells grabbed last, ringed (a finished square shows the grid alone)
  if (!fl && !o.view && mini.last && Array.isArray(mini.last.waves)) mini.last.waves.forEach(w => w.forEach(i => { lastOf[i] = 1; }));
  const would = {};                                                  // what each colour would grab now: ringed while its button is pressed
  if (!o.view && !o.locked) for (let c = 0; c < nc; c++) if (c !== blob) floodWaves(mini.colors, mini.owner, c).forEach(w => w.forEach(i => { would[i] = c; }));
  const winner = fl && o.fresh ? a.by : null;                        // the square just won: the winner's tokens hop in a ripple out from the start
  const cells = mini.colors.map((c, i) => {
    const own = mini.owner[i], pl = own === 'X' || own === 'O', fresh = waveOf[i] != null;
    const r = Math.floor(i / n), k = i % n, inBlob = j => mini.owner[j] != null;
    let cls = 'flc' + (pl ? ' own ' + own : '') + (i === 0 ? ' start' : '') + (own != null ? ' blob' : '');
    if (own != null) { if (r > 0 && inBlob(i - n)) cls += ' jt'; if (k < n - 1 && inBlob(i + 1)) cls += ' jr'; if (r < n - 1 && inBlob(i + n)) cls += ' jb'; if (k > 0 && inBlob(i - 1)) cls += ' jl'; }   // the blob's cells run together: no line between two of them
    let st = `background:${FLOOD_COL[c]}`;
    if (fresh) { cls += ' grab'; st += `;--t:${T.wave0 + waveOf[i] * T.step}ms`; }
    else if (fl && own != null) { cls += ' recolor'; st += `;--c0:${FLOOD_COL[fl.from == null ? c : fl.from]};--c1:${FLOOD_COL[c]};--t:${Math.round((depth[i] || 0) * dyeStep)}ms`; }
    if (lastOf[i]) cls += ' last';
    if (would[i] != null) cls += ' w' + would[i];
    if (winner && pl) { cls += own === winner ? ' won' : ' lost'; st += `;--w:${T.end + (r + k) * 18}ms`; }
    return `<i class="${cls}" style="${st}">${pl ? tok(own) : ''}</i>`;
  }).join('');
  const btns = o.view ? '' : `<div class="fbtns">${FLOOD_COL.slice(0, nc).map((col, c) => `<button class="fsw fc${c}${c === blob ? ' isblob' : ''}" style="background:${col}" data-act="move" ${mv(c)} aria-label="${FLOOD_NAMES[c]}"${c === blob || o.locked ? ' disabled' : ''}>${c === blob ? '<i>blob</i>' : ''}</button>`).join('')}</div>`;
  const res = fl ? `<p ${lateAt('arcres ' + (fl.gain ? 'ok' : 'no'), fl.gain ? T.wave0 : FLOOD_MS.base)} role="status">${fl.gain ? `+${fl.gain}` : 'Nothing grabbed'}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  return `<div class="g-arc g-fl t${turn}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="flood"><div class="flgrid">${cells}</div><div class="fbars">${fbar('X')}${fbar('O')}</div>${res}</div>${btns}</div>`;
}
// The miniature: the grid in small (a grabbed cell carries a dot in its player's colour), and under it a bar each of
// how far they are to the target.
export function miniature(mini, final) {
  const goal = floodCfg(mini).goal, pct = p => Math.min(100, 100 * mini.score[p] / goal).toFixed(1);
  const pl = w => w === 'X' || w === 'O';
  return `<div class="tfl" aria-label="Flood: X ${mini.score.X}, O ${mini.score.O} of ${goal}"><div class="tg gfl">${mini.colors.map((c, i) => `<i class="${pl(mini.owner[i]) ? 'own ' + mini.owner[i] : ''}" style="background:${FLOOD_COL[c]}"></i>`).join('')}</div><div class="tflbars" aria-hidden="true">${['X', 'O'].map(p => `<span class="${p}"><i style="width:${pct(p)}%"></i></span>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = floodTable(mini, a, { view, locked, turn, fresh: !!fresh, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.flood ? `${who} went ${FLOOD_NAMES[f.flood.color]} · +${f.flood.gain}` : `${who} picked a colour`;
}
// The dye's splash as the colour is picked; a drop for each wave of cells as it joins, each a little higher; nothing
// grabbed: a dull thud once the dye has run.
export function sounds(f, add, won, mini, last) {
  if (!f.flood) return;
  const T = floodTimes(f.flood);
  add('splash', 0);
  if (!f.flood.gain) add('thud', FLOOD_MS.base);
  f.flood.waves.slice(0, 8).forEach((w, k) => add('plop', T.wave0 + k * T.step, 1 + k * 0.07));
}
