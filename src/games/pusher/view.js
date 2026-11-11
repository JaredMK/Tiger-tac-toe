// Coin Pusher: the screen, the miniature, the move's words and sounds, and the inputs (November 2026; reworked the same
// month: a live machine and a dropper to time).
import { PUSH, pushBar, pushCfg, pushDropX, pushInit, pushMaxSteps, pushRest, pushSettleSteps, pushStars, pushStep, pushReplay } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { drawTimeBar, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { markSvgG, thumbArt } from '../../ui/thumbs.js';
import { cpuTurn, flashAnimating, skipFlash } from '../../ui/turns.js';

// The machine seen from above, on one canvas: the cabinet, the shelf of coins, the pusher bar across its back sliding
// forward and back all the time, the dropper sliding across the top, the side walls that stop short of the front (the
// gutters) and the tray under the front edge. A tap anywhere on the square drops a coin where the dropper is: the first
// starts the move (the bar's and the dropper's places then go with it, rules.js), the machine playing live on this phone
// step by step (rules.js pushStep, the same arithmetic the server runs), the attempt's time bar running from the first
// coin; after the last coin it pushes on for the settle and the move goes in as its inputs (the server works out the
// very same push: nothing to wait for, and the move's flash goes straight to its result here, as Star Swarm's). Someone
// else's move (the other phone's, the computer's) plays from its flash: the dropper over each coin as it was released,
// the push, the coins over the front sliding into the tray. Idle, the bar and the dropper keep moving on the page's clock.
let pd = null;                                       // this phone's move under way: { sq, p, sim, ph, dp, k, c, n, at, acc, phase, raf, endStep, queued }
let pLive = null;                                    // the move just made here: { sq, p, view (its last frame), at } (kept on show while it goes in)
let src = null, raf = 0, ready = false, skipped = null, rsim = null;
const PSH_EARLY = 700;                               // online: a move under way is finished and goes in this long before the turn's time is up
// Someone else's move plays first (the computer's, the other phone's): its length on screen, in ms; 0 for one made here.
export const pushPre = f => (f && f.type === 'pusher' && f.push && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? f.push.ms : 0);
// The bar's and the dropper's places in their cycles on the page's clock (idle: they never stop).
const idlePh = (c, now) => ((now / 1000) / Math.max(0.5, c.period)) % 1;
const idleDp = (c, now) => ((now / 1000) / Math.max(0.5, c.dropPeriod)) % 1;

function pushTable(mini, a, o) {
  const c = pushCfg(mini), g = a && a.push ? a.push : null, turn = o.turn, who = g ? a.by : o.view && mini.last ? mini.last.by : turn;
  const live = pd && pd.sq === o.zoom ? pd : null;
  const mine = !o.view && !g && !o.done && !cpuTurn() && !remoteTurn() && !o.locked;
  const pre = g ? pushPre(a) : 0;
  const was = p => (g && a.by === p ? g.before : mini.score[p]);
  const tal = p => arcTally(p, o, `<span class="pshsc" aria-label="${mini.score[p]} of ${c.target} coins">${g && a.by === p && g.after !== g.before && pre ? `<b class="cnt" data-from="${was(p)}" data-delay="${lastOff(g, c)}">${mini.score[p]}</b>` : `<b>${mini.score[p]}</b>`}<small>/${c.target}</small></span>`);
  const other = a && a.by === 'X' ? 'O' : 'X', reached = g && !o.done && mini.final && mini.final.by === a.by;
  const res = g ? `<p ${lateAt('arcres ' + (g.scored ? 'ok' : 'no'), REDUCED || !pre ? null : g.ms)} role="status">${reached ? `${c.target}! Last turn: <b class="${other}">${N(other)}</b>` : g.scored ? `+${g.pts}${g.pts > g.scored ? ' · a star!' : ''}` : g.lost ? `None over · ${g.lost} lost` : 'None over'}</p>`
    : live ? `<p class="arcres pshnow" data-psh="now" role="status"></p>`
    : `<p class="arcnote">${o.view || mine ? '' : waitLine(turn)}</p>`;
  src = { mini, a: g ? a : null, who: live ? live.p : who, zoom: o.zoom, mine, c };
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="psh${mine || live ? ' live' : ''}"><canvas class="pshcv" aria-label="${N(src.who)}'s coin pusher: ${mini.coins[src.who].length} coins on the shelf${mine ? '; tap to drop a coin where the dropper is' : ''}"></canvas></div>${res}</div>`;
}
const lastOff = (g, c) => { const e = replayOf(g, c).events.filter(v => v.kind === 'off'); return e.length ? e[e.length - 1].t + 250 : g.ms; };
function replayOf(g, c) {
  if (rsim && rsim.g === g) return rsim;
  const r = pushReplay(c, g);
  rsim = { g, frames: r.frames, events: r.events };
  return rsim;
}

// ---- this phone's move ----
function tap() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || sq.mini.type !== 'pusher' || sq.owner || state.flash || state.done || state.winner || blocked()) return false;
  const mini = sq.mini, c = pushCfg(mini), n = Math.max(1, c.perMove | 0), now = performance.now();
  if (!pd) {
    if (!src || !src.mine) return false;
    const p = state.turn, ph = Math.round(idlePh(c, now) * 1000) % 1000, dp = Math.round(idleDp(c, now) * 1000) % 1000;
    pd = { sq: state.zoom, p, c, n, mini, ph, dp, k: [], stars: pushStars(mini, p, c, n), sim: pushInit(c, mini.coins[p], ph / 1000, false), at: now, last: now, acc: 0, phase: 'play', raf: 0, endStep: 0, queued: null };
    pLive = null;
    queue(pd);
    render();
    pd.raf = requestAnimationFrame(frameLoop);
    return true;
  }
  if (pd.phase !== 'play' || pd.sq !== state.zoom || pd.queued != null) return false;
  queue(pd);
  return true;
}
// A coin for the next step (the one the machine works out next: so the server's run has it at the very same step).
function queue(fd) {
  const s = Math.max(fd.sim.s, fd.k.length ? fd.k[fd.k.length - 1] + 1 : 0);
  fd.k.push(s); fd.queued = s;
  SND.play('clink'); haptic('tap');
  if (fd.k.length >= fd.n) { fd.phase = 'settle'; fd.endStep = s + pushSettleSteps(fd.c); }
}
function stepOnce(fd) {
  const s = fd.sim.s, i = fd.k.indexOf(s), drop = i >= 0 ? { x: pushDropX(fd.c, s / PUSH.hz, fd.dp / 1000), st: fd.stars[i] } : null;
  if (i >= 0) fd.queued = null;
  pushStep(fd.sim, drop);
  let offs = 0;
  for (const e of fd.sim.last || []) {
    if (e.kind === 'off' && offs++ < 3) { SND.play('coinSpin'); haptic('medium'); }
    else if (e.kind === 'lost') SND.play('plop');
  }
}
function frameLoop(now) {
  const fd = pd;
  if (!fd) return;
  fd.raf = 0;
  if (state.screen !== 'mini' || state.zoom !== fd.sq || state.winner) { finish(true); return; }   // (taken off the square: it ends as it stands)
  const dt = Math.min(0.1, Math.max(0, (now - fd.last) / 1000));
  fd.last = now;
  const left = clockLeft();
  if (left != null && left <= (state.online ? PSH_EARLY : 0)) { finish(true); return; }        // the turn's time is up: the rest at once
  fd.acc += dt;
  while (fd.acc >= 1 / PUSH.hz - 1e-9) {
    fd.acc -= 1 / PUSH.hz;
    if (fd.phase === 'play' && fd.queued == null && fd.sim.s >= pushMaxSteps(fd.c) - (fd.n - fd.k.length - 1)) { queue(fd); continue; }   // the attempt's time limit: the coins left drop where the dropper is, a step apart, the last on the limit
    stepOnce(fd);
    if (fd.phase === 'settle' && fd.sim.s >= fd.endStep) { finish(false); return; }
  }
  liveNow(fd);
  paint();
  fd.raf = requestAnimationFrame(frameLoop);
}
// The move goes in: played to its end here (at once, when the time ran out or the square went away), then sent.
function finish(rush) {
  const fd = pd;
  if (!fd) return;
  cancelAnimationFrame(fd.raf); pd = null;
  while (fd.k.length < fd.n) { const s = Math.max(fd.sim.s, fd.k[fd.k.length - 1] + 1); fd.k.push(s); fd.queued = s; if (fd.k.length >= fd.n) fd.endStep = s + pushSettleSteps(fd.c); }
  if (!fd.endStep) fd.endStep = fd.k[fd.k.length - 1] + pushSettleSteps(fd.c);
  while (fd.sim.s < fd.endStep) { const s = fd.sim.s, i = fd.k.indexOf(s); pushStep(fd.sim, i >= 0 ? { x: pushDropX(fd.c, s / PUSH.hz, fd.dp / 1000), st: fd.stars[i] } : null); }
  const pts = fd.sim.pts;
  pLive = { sq: fd.sq, p: fd.p, coins: pushRest(fd.sim), at: performance.now() };
  if (pts > 0) { SND.play('ding'); haptic('medium'); } else SND.play('thud');   // (its result's sound here: the flash of a move made here goes straight to its result)
  attemptMove({ ph: fd.ph, dp: fd.dp, k: fd.k.slice() });
  render();
}
function liveNow(fd) {
  const el = app.querySelector && app.querySelector('[data-psh="now"]');
  if (el) el.textContent = fd.sim.pts ? `+${fd.sim.pts}` : '';
}

// ---- the view's hooks ----
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  init();
  // A move made here has been watched already: its flash (whose length allows for the replay on the other phone) goes
  // straight to its result, once.
  if (a && a.push && !a.timeout && !pushPre(a) && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }
  g = pushTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
function init() {
  if (ready || typeof document === 'undefined' || !app || !app.addEventListener) return;
  ready = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !src || !runInputAt(e.target)) return;
    const sq = state.squares && state.squares[state.zoom];
    if (!sq || sq.mini.type !== 'pusher') return;
    if (e.target.closest && e.target.closest('button')) return;
    if (tap()) { e.preventDefault(); ownPress(); }
  }, { passive: false });
}
export function moveText(f, who) {
  const g = f.push;
  return g ? `${who} dropped ${g.k.length} coins · ${g.scored ? `+${g.pts}` : 'none over'}` : `${who} dropped coins`;
}
// The move's sounds at their moments (someone else's move as it plays): a clink as each coin drops, coins sliding into
// the tray, then a ding for coins won or a thud for none. A move made here had its sounds live.
export function sounds(f, add, won, mini, last) {
  const g = f.push;
  if (!g || !pushPre(f)) return;
  const fr = replayOf(g, pushCfg(mini));
  let offs = 0;
  for (const e of fr.events) {
    if (e.kind === 'drop') add('clink', e.t);
    else if (e.kind === 'off' && offs++ < 4) add('coinSpin', e.t + 120);
    else if (e.kind === 'lost') add('plop', e.t + 120);
  }
  add(g.scored ? 'ding' : 'thud', g.ms);
}
export const replay = { synth: () => [] };          // the move is its taps: the replay plays them from the flash
// The square's line while the turn is held to it (ui/mini.js): only with "Go again on success" on (coins won).
export function heldSub(mini, turn, f) { return f ? '' : `<b class="${turn}">${N(turn)}</b> won coins · goes again`; }

// ---- the drawing ----
const W1 = 1, TRAY = 0.13, TOP = 0.1;                // the machine in shelf units: the shelf 1 x 1, the tray under it, the dropper's rail over it
function geom(W, H) {
  const pad = 6, S = Math.max(10, Math.min((W - 2 * pad) / W1, (H - 2 * pad) / (1 + TRAY + TOP)));
  return { S, ox: (W - S * W1) / 2, oy: (H - S * (1 + TRAY + TOP)) / 2 + S * TOP, W, H };
}
function schedulePaint() { if (raf) cancelAnimationFrame(raf); raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(paintLoop) : 0; }
function paintLoop() { raf = 0; if (pd) return; if (paint()) schedulePaint(); }
function paint() {
  const cv = typeof document !== 'undefined' && document.querySelector ? document.querySelector('canvas.pshcv') : null;
  if (!cv || !src) return false;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return false;
  return frame(c, geom(W, H), performance.now());
}
const GOLD = '#f2c14e', GOLD_D = '#a8781c', STAR = '#9fd4f5', STAR_D = '#2f6f9e';
function coin(c, X, Y, R, a, st) {
  if (a <= 0) return;
  c.globalAlpha = a;
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = st ? STAR : GOLD; c.fill(); c.lineWidth = Math.max(1, R * 0.16); c.strokeStyle = st ? STAR_D : GOLD_D; c.stroke();
  c.beginPath(); c.arc(X, Y, R * 0.62, 0, Math.PI * 2); c.lineWidth = Math.max(0.8, R * 0.09); c.stroke();
  c.beginPath();
  if (st) { for (let i = 0; i < 10; i++) { const rr = i % 2 ? R * 0.22 : R * 0.5, an = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(X + Math.cos(an) * rr, Y + Math.sin(an) * rr); } }   // (a star coin: a five-point star)
  else { const k = R * 0.3; c.moveTo(X, Y - k); c.lineTo(X + k * 0.7, Y); c.lineTo(X, Y + k); c.lineTo(X - k * 0.7, Y); }   // (a coin: a little diamond)
  c.closePath(); c.fillStyle = st ? STAR_D : GOLD_D; c.fill();
  c.globalAlpha = 1;
}
// One frame: true while something moves (another frame wanted: idle, the bar and the dropper always do).
function frame(c, G, now) {
  const P = runColours(), mini = src.mini, cfg = src.c, S = G.S, X = u => G.ox + u * S, Y = v => G.oy + v * S, R = PUSH.r * S;
  const fd = pd && pd.sq === src.zoom ? pd : null, a = fd ? null : src.a, g = a ? a.push : null;
  const at = a ? fxAt('move', a) : null, t = at == null ? null : Math.max(0, now - at);
  const m = g && pushPre(a) && t != null ? replayOf(g, cfg) : null, step = m ? Math.min(m.frames.length - 1, Math.floor(t / 1000 * PUSH.hz)) : -1;
  // where the bar and the dropper are: the move under way's, a replay's, else the page's clock
  let bar, dx, k = null;
  if (fd) { bar = pushBar(cfg, fd.sim.s / PUSH.hz, fd.ph / 1000); dx = pushDropX(cfg, fd.sim.s / PUSH.hz, fd.dp / 1000); }
  else if (m && step >= 0) { bar = pushBar(cfg, (step + 1) / PUSH.hz, g.ph / 1000); dx = pushDropX(cfg, (step + 1) / PUSH.hz, g.dp / 1000); k = step; }
  else { bar = pushBar(cfg, 0, idlePh(cfg, now)); dx = pushDropX(cfg, 0, idleDp(cfg, now)); }
  c.clearRect(0, 0, G.W, G.H);
  // the cabinet and the shelf
  c.fillStyle = '#4a3a6b'; c.beginPath(); c.roundRect(X(0) - 6, Y(-TOP) - 4, S + 12, S * (1 + TRAY + TOP) + 8, 10); c.fill();
  c.fillStyle = '#2f7f86'; c.fillRect(X(0), Y(0), S, S);
  c.fillStyle = '#26203a'; c.fillRect(X(0), Y(1), S, S * TRAY);                                       // the tray
  c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(X(0), Y(1)); c.lineTo(X(1), Y(1)); c.stroke();   // the front edge
  c.fillStyle = '#c9b48a'; c.fillRect(X(0) - 5, Y(0), 5, PUSH.gut * S); c.fillRect(X(1), Y(0), 5, PUSH.gut * S);   // the side walls (stopping at the gutters)
  // the pusher bar
  c.fillStyle = '#d9d2c3'; c.fillRect(X(0), Y(0), S, bar * S);
  c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 6; i++) c.fillRect(X(i / 6 + 1 / 12) - S * 0.01, Y(0) + 3, S * 0.02, bar * S - 6);
  c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(X(0), Y(0), S, bar * S);
  // the coins
  if (fd) for (const o of fd.sim.list) coin(c, X(o.x), Y(o.y), R, 1, o.st);
  else if (m) {
    for (const [x, y, st] of m.frames[step]) coin(c, X(x), Y(y), R, 1, st);
    for (const e of m.events) {                                  // a coin gone: into the tray (over the front) or off a side, fading as it goes
      if (e.kind === 'drop') continue;
      const dt = t - e.t;
      if (dt < 0 || dt > 450) continue;
      const u = dt / 450;
      if (e.kind === 'off') coin(c, X(e.x), Y(1) + R + u * (S * TRAY - R), R * (1 - 0.2 * u), 1 - u * 0.6, e.st);
      else coin(c, X(e.x < 0.5 ? -u * 0.08 : 1 + u * 0.08), Y(PUSH.gut + 0.06), R * (1 - 0.4 * u), 1 - u, e.st);
    }
  } else {
    const lv = pLive && pLive.sq === src.zoom && pLive.p === src.who && !g ? pLive.coins : mini.coins[src.who];
    for (const [xi, yi, st] of lv) coin(c, X(xi / PUSH.Q), Y(yi / PUSH.Q), R, 1, st);
  }
  // the dropper on its rail: a little chute in the mover's colour, the next coin in it
  const who = fd ? fd.p : src.who, col = who === 'O' ? P.O : P.X, rail = Y(-TOP * 0.55);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(X(0), rail - 1.5, S, 3);
  const left = fd ? fd.n - fd.k.length : g && m ? g.k.filter(s => s > k).length : 0;
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 2;
  c.beginPath(); c.roundRect(X(dx) - R * 1.4, rail - R * 0.9, R * 2.8, R * 1.5, 4); c.fill(); c.stroke();
  if (left > 0 || (!fd && !m && src.mine)) coin(c, X(dx), rail - R * 0.1, R * 0.75, 1, 0);
  // the attempt's time bar (from the first coin to the time limit), while coins are still to drop
  if (fd && fd.phase === 'play') drawTimeBar(c, G.W, G.H, 1 - fd.sim.s / pushMaxSteps(cfg), P);
  return true;                                                   // (the machine never stops)
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
