// Coin Pusher: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { PUSH, pushBar, pushCfg, pushSim } from './rules.js';
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, state, waitLine, zoomedType } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { repNote } from '../../ui/replay.js';
import { runCanvas, runColours } from '../../ui/runner.js';
import { markSvgG, thumbArt } from '../../ui/thumbs.js';

// The machine seen from above, on one canvas: the cabinet, the shelf of coins, the pusher bar across its back, the
// side walls that stop short of the front (the gutters) and the tray under the front edge. A tap on the machine
// queues a coin at the slot above it (a ghost coin at the top, the slot's mark lit); Clear empties the queue and Drop
// sends the move. The move plays from its flash (rules.js pushSim again, from the coins before it and the drops:
// the same frames the server worked out): each coin drops in at its moment, the bar pushes, coins over the front
// slide into the tray, coins off the sides tip away. Everything is timed from the move's event, never from a redraw.
let draft = null;                                     // this phone's queue: { key, slots: [s...] }
let src = null, raf = 0, sim = null;                  // the last render's state; the frames of the move on show (cached by its flash)
const keyOf = sq => `${sq}:${state.moves}:${state.turn}`;
const queued = sq => (draft && draft.key === keyOf(sq) ? draft.slots : []);
const W1 = 1, TRAY = 0.13, TOP = 0.08;                // the machine in shelf units: the shelf 1 x 1, the tray under it, the slot strip over it
function pushTable(mini, a, o) {
  const c = pushCfg(mini), n = Math.max(1, c.perMove | 0), g = a && a.push ? a.push : null, turn = o.turn, who = g ? a.by : o.view && mini.last ? mini.last.by : turn;
  const mine = !o.view && !g && !o.locked && !o.done, q = g || o.done ? [] : queued(o.zoom);   // (a replay's queued coins show too: ui/replay.js presses them here)
  const was = p => (g && a.by === p ? g.before : mini.score[p]);
  const tal = p => arcTally(p, o, `<span class="pshsc" aria-label="${mini.score[p]} of ${c.target} coins">${g && a.by === p && g.after !== g.before ? `<b class="cnt" data-from="${was(p)}" data-delay="${lastOff(g, c)}">${mini.score[p]}</b>` : `<b>${mini.score[p]}</b>`}<small>/${c.target}</small></span>`);
  const res = g ? `<p ${lateAt('arcres ' + (g.scored ? 'ok' : 'no'), REDUCED ? null : g.ms)} role="status">${g.scored ? `+${g.scored} coin${g.scored === 1 ? '' : 's'}` : 'None over the edge'}${g.lost ? ` · ${g.lost} off the side` : ''}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const btns = o.view ? '' : `<div class="cbtns pshbtns"><button class="btn" data-act="pshclr"${mine && q.length ? '' : ' disabled tabindex="-1"'}>Clear</button><button class="big ${turn}" data-act="pshdrop"${mine && q.length === n ? '' : ' disabled tabindex="-1"'}>Drop ${n}</button></div>`;
  src = { mini, a: g ? a : null, who, zoom: o.zoom, mine, q, n };
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="psh${mine ? ' live' : ''}"><canvas class="pshcv" aria-label="${N(who)}'s coin pusher: ${mini.coins[who].length} coins on the shelf${mine ? `; tap along the top to drop a coin (${q.length} of ${n})` : ''}"></canvas></div>${res}${btns}</div>`;
}
const lastOff = (g, c) => { const e = moveFrames(g, c).events.filter(v => v.kind === 'off'); return e.length ? e[e.length - 1].t + 250 : g.ms; };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pushTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
export function moveText(f, who) {
  const g = f.push;
  return g ? `${who} dropped ${g.slots.length} coins · ${g.scored ? `+${g.scored}` : 'none over'}` : `${who} dropped coins`;
}
// The move's sounds at their moments: a clink as each coin lands, a run of coins sliding into the tray, then a ding for
// coins won or a thud for none.
export function sounds(f, add, won, mini, last) {
  const g = f.push;
  if (!g) return;
  const fr = moveFrames(g, pushCfg(mini));
  let offs = 0;
  for (const e of fr.events) {
    if (e.kind === 'drop') add('clink', e.t);
    else if (e.kind === 'off' && offs++ < 4) add('coinSpin', e.t + 120);
    else if (e.kind === 'lost') add('plop', e.t + 120);
  }
  add(g.scored ? 'ding' : 'thud', g.ms);
}
// ---- the frames of a move (cached by the flash: the same as the server's, played again from its start) ----
function moveFrames(g, c) {
  if (sim && sim.g === g) return sim;
  const r = pushSim(c, g.from, g.drops, true, g.ph);
  sim = { g, frames: r.frames, events: r.events };
  return sim;
}
// ---- the input: a tap on the machine queues a coin at the slot above it ----
function slotAt(cv, x) {
  const G = geom(cv.offsetWidth || 300, cv.offsetHeight || 300), u = (x - G.ox) / G.S;
  if (u < 0 || u > W1) return null;
  return Math.max(0, Math.min(PUSH.slots - 1, Math.floor(u * PUSH.slots)));
}
function addSlot(sq, s, from) {
  if (!draft || draft.key !== keyOf(sq)) draft = { key: keyOf(sq), slots: [] };
  if (draft.slots.length >= src.n) { if (from !== 'rep') SND.play('error'); return false; }
  draft.slots.push(s);
  return true;
}
function onDown(e) {
  const cv = e.target.closest && e.target.closest('canvas.pshcv');
  if (!cv || zoomedType() !== 'pusher' || !src || !src.mine || state.flash || blocked()) return;
  const s = slotAt(cv, e.clientX - cv.getBoundingClientRect().left);
  if (s == null) return;
  e.preventDefault();
  if (!addSlot(state.zoom, s)) return;
  repNote('pshslot', 'v=' + s);
  SND.play('select');
  render();
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('pointerdown', onDown, { passive: false });
function clearAct() { if (zoomedType() !== 'pusher' || state.flash) return; draft = null; SND.play('deselect'); render(); }
function dropAct() {
  if (zoomedType() !== 'pusher' || state.flash || !src || !src.mine) return;
  const q = queued(state.zoom);
  if (q.length !== src.n) return;
  draft = null;
  attemptMove({ s: q.slice() });
}
export const actions = { pshclr: clearAct, pshdrop: dropAct };
// Someone else's drops replayed (ui/replay.js): their coins queue at their slots one by one, then the drop.
function replayInput(act, val, r) {
  if (act === 'pshslot' && /^v=\d$/.test(val || '')) { if (addSlot(r.sq, Number(val.slice(2)), 'rep')) SND.play('select'); return true; }
  if (act === 'pshclr') { draft = null; return true; }
  return act === 'pshdrop';
}
const replaySynth = m => (m && Array.isArray(m.s) ? m.s.map((s, k) => [k * 350, 'pshslot', 'v=' + s]).concat([[m.s.length * 350 + 150, 'pshdrop', null]]) : null);
export const replay = { input: replayInput, synth: replaySynth };
// The square's line while the turn is held to it (ui/mini.js): only with "Go again on success" on (coins won).
export function heldSub(mini, turn, f) { return f ? '' : `<b class="${turn}">${N(turn)}</b> won coins · goes again`; }

// ---- the drawing ----
function geom(W, H) {
  const pad = 6, S = Math.max(10, Math.min((W - 2 * pad) / W1, (H - 2 * pad) / (1 + TRAY + TOP)));
  return { S, ox: (W - S * W1) / 2, oy: (H - S * (1 + TRAY + TOP)) / 2 + S * TOP, W, H };
}
function schedulePaint() { if (raf) cancelAnimationFrame(raf); raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(paint) : 0; }
function paint() {
  raf = 0;
  const cv = typeof document !== 'undefined' && document.querySelector ? document.querySelector('canvas.pshcv') : null;
  if (!cv || !src) return;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  if (frame(c, geom(W, H), performance.now())) schedulePaint();
}
const GOLD = '#f2c14e', GOLD_D = '#a8781c';
function coin(c, X, Y, R, a) {
  if (a <= 0) return;
  c.globalAlpha = a;
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = GOLD; c.fill(); c.lineWidth = Math.max(1, R * 0.16); c.strokeStyle = GOLD_D; c.stroke();
  c.beginPath(); c.arc(X, Y, R * 0.62, 0, Math.PI * 2); c.lineWidth = Math.max(0.8, R * 0.09); c.stroke();
  const k = R * 0.3; c.beginPath(); c.moveTo(X, Y - k); c.lineTo(X + k * 0.7, Y); c.lineTo(X, Y + k); c.lineTo(X - k * 0.7, Y); c.closePath(); c.fillStyle = GOLD_D; c.fill();   // (the emblem: a little diamond)
  c.globalAlpha = 1;
}
// One frame: true while the move is still playing (another frame wanted).
function frame(c, G, now) {
  const P = runColours(), mini = src.mini, cfg = pushCfg(mini), S = G.S, X = u => G.ox + u * S, Y = v => G.oy + v * S, R = PUSH.r * S;
  const a = src.a, g = a ? a.push : null, at = a ? fxAt('move', a) : null, t = at == null ? null : Math.max(0, now - at);
  c.clearRect(0, 0, G.W, G.H);
  // the cabinet and the shelf
  c.fillStyle = '#4a3a6b'; c.beginPath(); c.roundRect(X(0) - 6, Y(-TOP) - 4, S + 12, S * (1 + TRAY + TOP) + 8, 10); c.fill();
  c.fillStyle = '#2f7f86'; c.fillRect(X(0), Y(0), S, S);
  c.fillStyle = 'rgba(255,255,255,.07)'; for (let k = 1; k < PUSH.slots; k++) c.fillRect(X(k / PUSH.slots) - 0.5, Y(0), 1, S);
  c.fillStyle = '#26203a'; c.fillRect(X(0), Y(1), S, S * TRAY);                                       // the tray
  c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(X(0), Y(1)); c.lineTo(X(1), Y(1)); c.stroke();   // the front edge
  c.fillStyle = '#c9b48a'; c.fillRect(X(0) - 5, Y(0), 5, (PUSH.gut) * S); c.fillRect(X(1), Y(0), 5, PUSH.gut * S);   // the side walls (stopping at the gutters)
  const m = g && !REDUCED && t != null ? moveFrames(g, cfg) : null, step = m ? Math.min(m.frames.length - 1, Math.floor(t / 1000 * PUSH.hz)) : -1;
  const bar = m && step >= 0 ? pushBar(cfg, (step + 1) / PUSH.hz, g.ph) : PUSH.back;
  // the pusher bar
  c.fillStyle = '#d9d2c3'; c.fillRect(X(0), Y(0), S, bar * S);
  c.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 0; k < 6; k++) c.fillRect(X(k / 6 + 1 / 12) - S * 0.01, Y(0) + 3, S * 0.02, bar * S - 6);
  c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(X(0), Y(0), S, bar * S);
  // the coins
  if (m) {
    for (const [x, y] of m.frames[step]) coin(c, X(x), Y(y), R, 1);
    for (const e of m.events) {                                  // a coin gone: into the tray (over the front) or off a side, fading as it goes
      if (e.kind === 'drop') continue;
      const dt = t - e.t;
      if (dt < 0 || dt > 450) continue;
      const k = dt / 450;
      if (e.kind === 'off') coin(c, X(e.x), Y(1) + R + k * (S * TRAY - R), R * (1 - 0.2 * k), 1 - k * 0.6);
      else coin(c, X(e.x < 0.5 ? -k * 0.08 : 1 + k * 0.08), Y(PUSH.gut + 0.06), R * (1 - 0.4 * k), 1 - k);
    }
  } else {
    const rest = g ? null : mini.coins[src.who];
    for (const [xi, yi] of rest || mini.coins[src.who]) coin(c, X(xi / PUSH.Q), Y(yi / PUSH.Q), R, 1);
  }
  // the slots' marks along the top, the queued coins over them
  const counts = Array(PUSH.slots).fill(0);
  for (const s of src.q) counts[s]++;
  for (let s = 0; s < PUSH.slots; s++) {
    const cx = X((s + 0.5) / PUSH.slots), on = counts[s] > 0;
    c.fillStyle = on ? (src.mini && state.turn === 'O' ? P.O : P.X) : 'rgba(255,255,255,.35)';
    c.beginPath(); c.roundRect(cx - S * 0.03, Y(-TOP) + 2, S * 0.06, S * TOP * 0.45, 3); c.fill();
    for (let k = 0; k < counts[s]; k++) coin(c, cx, Y(bar) + R + 2 + k * R * 0.5, R * 0.9, 0.55);
  }
  if (g && !m) return false;
  return !!m && t < g.ms + 500;
}

// ---- the miniature: both machines from above, side by side (X's left, O's right), the coins on each shelf, and each
// player's coins won toward the target beside them ----
export function miniature(mini, final) {
  const c = pushCfg(mini), mach = (p, ox) => {
    const coins = mini.coins[p].map(([xi, yi]) => `<circle cx="${(ox + 1 + (xi / PUSH.Q) * 24).toFixed(1)}" cy="${(4 + (yi / PUSH.Q) * 24).toFixed(1)}" r="1.25"/>`).join('');
    return `<g class="tpshm ${p}"><rect class="tpshc" x="${ox}" y="0" width="26" height="31" rx="3"/><rect class="tpshs" x="${ox + 1}" y="4" width="24" height="24"/><rect class="tpshb" x="${ox + 1}" y="4" width="24" height="${(PUSH.back * 24).toFixed(1)}"/><g class="tpshk">${coins}</g><g transform="translate(${ox + 13} 1.9)">${markSvgG(p, 1.6)}</g></g>`;
  };
  const rows = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tsn">${mini.score[p]}</span></div>`).join('');
  return thumbArt(`<svg class="tpsh" viewBox="0 0 56 31" aria-hidden="true">${mach('X', 0)}${mach('O', 30)}</svg>`, rows, 'tpshw', `Coin Pusher: X ${mini.score.X}, O ${mini.score.O} of ${c.target} coins`);
}
