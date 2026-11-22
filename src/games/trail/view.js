// Trail Race: the screen, the miniature, the move's words and sounds, and this phone's trail in hand.
// The board is an SVG grid: X's trail a thick red line up from the bottom row, O's a yellow one down from the top,
// each with its token at its head; the far row of each is tinted in its colour. The mover's next squares carry a dot
// (forward or sideways from the head, or from the last square lined up): a tap lines a square up (drawn dashed), and
// the move goes in when the turn's squares are all lined up, or at Done with fewer; Undo takes the last one back.
// Only the move is sent. It then plays from the move, for everyone: the new squares one by one (TRAIL.step), and a
// trail that was boxed in fading away as its player starts again from their edge (TRAIL.wipe).
import { TRAIL, trailCfg, trailFar, trailGrid, trailHead, trailMs, trailSteps } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { N, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG, thumbArt } from '../../ui/thumbs.js';
import { barRows } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // lining squares up is never sent: the move plays from the flash
let draft = null;                                                  // this phone's move in hand: { sq, p, n (the mover's moves so far), m (the ways), at: [[r, c]...] }
const cur = () => { const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini; return mini && mini.type === 'trail' && draft && draft.sq === state.zoom && !state.flash && !state.done ? mini : null; };
function send() { const d = draft; if (!d || !d.m) return; draft = null; attemptMove(d.m); }
export const actions = {
  'tl-go': b => {
    const mini = cur(); if (!mini) return; ownPress();
    draft.m += b.dataset.w; draft.at.push([Number(b.dataset.r), Number(b.dataset.c)]); SND.play('tlStep', { rate: 1 + draft.at.length * 0.08 }); haptic('tap');
    if (draft.m.length >= trailCfg(mini).cells || Number(b.dataset.r) === trailFar(mini, draft.p)) send(); else render();
  },
  'tl-undo': () => { const mini = cur(); if (!mini || !draft.m) return; ownPress(); draft.m = draft.m.slice(0, -1); draft.at.pop(); SND.play('rtTick'); render(); },
  'tl-done': () => { const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini; ownPress(); if (mini && mini.type === 'trail' && mini.final && mini.final.by === state.turn && !state.flash) { attemptMove('claim'); return; } if (cur()) send(); },
};
const U = 10;                                                      // a square's size in the SVG
const xy = (n, r, c) => [c * U + U / 2, (n - 1 - r) * U + U / 2];
const line = (n, cells) => cells.map(([r, c], i) => `${i ? 'L' : 'M'}${xy(n, r, c).join(' ')}`).join('');
function board(mini, o) {                                          // o: { tr (the trails to draw), by, fresh: { p, from (the cells that are new), t }, gone: { p, cells, t }, dots, lined }
  const n = mini.n, W = n * U; let s = `<svg class="tlsvg" viewBox="-1 -1 ${W + 2} ${W + 2}" aria-hidden="true"><rect class="tlbg" x="0" y="0" width="${W}" height="${W}" rx="2"/><rect class="tlfar X" x="0" y="0" width="${W}" height="${U}"/><rect class="tlfar O" x="0" y="${W - U}" width="${W}" height="${U}"/>`;
  for (let k = 1; k < n; k++) s += `<path class="tlgrid" d="M${k * U} 0V${W}M0 ${k * U}H${W}"/>`;
  if (o.gone) s += `<path ${lateAt('tltrail gone ' + o.gone.p, o.gone.t, 'tlfade')} d="${line(n, o.gone.cells)}"/>`;
  for (const p of ['X', 'O']) {
    const cells = o.tr[p], f = o.fresh && o.fresh.p === p ? o.fresh : null, old = f ? cells.slice(0, f.from) : cells;
    if (old.length > 1) s += `<path class="tltrail ${p}" d="${line(n, old)}"/>`;
    if (f) cells.slice(f.from).forEach((q, k) => { s += `<path ${lateAt('tltrail ' + p, f.t + k * TRAIL.step)} d="${line(n, [cells[f.from + k - 1], q])}"/>`; });
    const lateHead = f && f.t != null ? f.t + (cells.length - f.from) * TRAIL.step : null, [hx, hy] = xy(n, ...cells[cells.length - 1]);
    if (f && f.from > 0 && f.t != null) { const [ox, oy] = xy(n, ...cells[f.from - 1]); s += `<g ${lateAt('tlhead was ' + p, lateHead, 'tlhide')} transform="translate(${ox} ${oy})"><circle r="3.800"/>${markSvgG(p, 2)}</g>`; }
    s += `<g ${lateAt('tlhead ' + p + (o.by === p ? ' now' : ''), lateHead)} transform="translate(${hx} ${hy})"><circle r="3.800"/>${markSvgG(p, 2)}</g>`;
  }
  if (o.lined && o.lined.cells.length > 1) { const [gx, gy] = xy(n, ...o.lined.cells[o.lined.cells.length - 1]); s += `<path class="tltrail lined ${o.lined.p}" d="${line(n, o.lined.cells)}"/><circle class="tlghost ${o.lined.p}" cx="${gx}" cy="${gy}" r="2.800"/>`; }
  s += '</svg>';
  if (o.dots) s += o.dots.map(d => `<button class="tldot ${o.by}" data-act="tl-go" data-w="${d.w}" data-r="${d.r}" data-c="${d.c}" style="--cx:${d.c};--cy:${n - 1 - d.r};--n:${n}" aria-label="Row ${d.r + 1}, column ${d.c + 1}"><i></i></button>`).join('');
  return s;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = trailCfg(mini), s = a && a.tl ? a.tl : null, o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, fin = mini.final, claim = mine && fin && fin.by === turn;
  if (draft && (draft.sq !== state.zoom || draft.p !== turn || draft.n !== mini.moves[turn] || !mine)) draft = null;
  if (mine && !claim && !draft) draft = { sq: state.zoom, p: turn, n: mini.moves[turn], m: '', at: [] };
  const end = s ? trailMs(s) : 0, far = p => Math.abs(trailHead(mini, p)[0] - (p === 'X' ? 0 : mini.n - 1));
  const tal = p => arcTally(p, o, `<span class="tlrow" aria-label="${far(p)} of ${mini.n - 1} rows">${far(p)}<small>/${mini.n - 1}</small></span>`);
  const opt = { tr: mini.tr, by };
  if (s) { if (s.wipe !== s.by) opt.fresh = { p: s.by, from: s.from, t: 0 }; if (s.wipe) opt.gone = { p: s.wipe, cells: s.was, t: s.wipe === s.by ? 0 : s.path.length * TRAIL.step }; }   // (a trail that boxed itself in: its whole trail, the new steps with it, fades as it starts again)
  else if (mine && draft) {
    const grid = trailGrid(mini); draft.at.forEach(([r, cc]) => { grid[r][cc] = turn; });
    const [hr, hc] = draft.at.length ? draft.at[draft.at.length - 1] : trailHead(mini, turn);
    opt.dots = trailSteps(grid, turn, hr, hc); opt.lined = { p: turn, cells: [trailHead(mini, turn)].concat(draft.at) };
  }
  const txt = l ? (l.wipe ? `${N(l.wipe)} is boxed in: back to the start` : l.ans ? `${l.ans.used} squares to ${l.ans.fused}` : '') : fin ? `${N(fin.by)} is across: ${N(fin.by === 'X' ? 'O' : 'X')} answers` : '';
  const line = s ? `<p ${lateAt('tlline', end)} role="status">${txt}</p>` : `<p class="tlline">${txt}</p>`;
  const left = mine && draft ? c.cells - draft.m.length : 0;
  const ctl = view ? '' : `<div class="tlctl"><button class="btn tlundo" data-act="tl-undo"${mine && draft && draft.m ? '' : ' disabled'}>Undo</button><button class="big ${turn} tldone" data-act="tl-done"${claim || (mine && draft && draft.m) ? '' : ' disabled'}>${claim ? 'Take it' : mine && draft && !draft.m ? `${left} to go` : 'Done'}</button></div>`;
  return `<div class="g-tl pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="tlbox"><div class="tlboard" role="img" aria-label="${N('X')} is ${far('X')} rows up, ${N('O')} ${far('O')} rows down, of ${mini.n - 1}">${board(mini, opt)}</div></div>${line}${ctl}</div>`;
}
// The miniature: the board with both trails, beside each player's rows crossed as a bar.
export function miniature(mini, final) {
  const n = mini.n, W = n * U, rows = p => Math.abs(trailHead(mini, p)[0] - (p === 'X' ? 0 : n - 1));
  const art = `<svg class="ttl" viewBox="-1 -1 ${W + 2} ${W + 2}"><rect class="tlbg" x="0" y="0" width="${W}" height="${W}" rx="3"/>${['X', 'O'].map(p => `${mini.tr[p].length > 1 ? `<path class="tltrail ${p}" d="${line(n, mini.tr[p])}"/>` : ''}<circle class="ttlh ${p}" cx="${xy(n, ...trailHead(mini, p))[0]}" cy="${xy(n, ...trailHead(mini, p))[1]}" r="4"/>`).join('')}</svg>`;
  return thumbArt(art, barRows({ X: rows('X'), O: rows('O') }, n - 1), 'ttlw', `Trail Race: X ${rows('X')}, O ${rows('O')} of ${n - 1} rows`);
}
export function moveText(f, who) { const s = f.tl; return !s ? `${who} moved` : `${who} grew their trail by ${s.path.length}${s.wipe ? (s.wipe === s.by ? ' and boxed itself in' : ' and boxed the other trail in') : ''}`; }
// A step's tick for each new square (someone else's: a move made here had its ticks as it was lined up), and a falling
// sweep as a boxed-in trail is rubbed out.
export function sounds(f, add, won, mini, last) {
  const s = f.tl; if (!s) return;
  s.path.forEach((q, k) => add('tlStep', k * TRAIL.step, 1 + (k + 1) * 0.08));
  if (s.wipe) add('tlWipe', s.path.length * TRAIL.step);
}
