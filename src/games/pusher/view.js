// Coin Pusher: the screen, the miniature, the move's words and sounds, and the inputs (November 2026; reworked the same
// month: a live machine and a dropper to time).
import { OWN, OWNER, PUSH, pushBar, pushCfg, pushDropX, pushInit, pushMaxSteps, pushR, pushRest, pushSettleSteps, pushShelf, pushStars, pushStep, pushReplay, pushWorth } from './rules.js';
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
// the push, the coins over the front tipping into the tray. Idle, the bar and the dropper keep moving on the page's clock.
// Whatever leaves the shelf is shown going (`gone`: a coin over the front turns over into the tray and lies there for
// the rest of the move; one off a side drops into its gutter), the same live and in a replay, and the mover's total
// counts on coin by coin as each lands (liveNow / frame: written into the page from the machine's own events).
let pd = null;                                       // this phone's move under way: { sq, p, sim, ph, dp, k, c, n, at, acc, phase, raf, endStep, queued }
let pLive = null;                                    // the move just made here: { sq, p, view (its last frame), at } (kept on show while it goes in)
let src = null, raf = 0, ready = false, skipped = null, rsim = null;
const PSH_EARLY = 700;                               // online: a move under way is finished and goes in this long before the turn's time is up
// The picture's own moments (ms; none of them the machine's): a coin's fall from the dropper to the shelf, a coin
// tipping over the front edge into the tray (its clink, its buzz and its points as it lands) and its little bounce
// there, a coin sliding off a side into the gutter, a star coin's sparkle in the tray.
export const PSHT = { drop: 170, fall: 340, bounce: 140, gone: 320, spark: 480 };
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
  const was = p => (g && a.by === p ? g.before : g && g.ob != null ? g.ob : mini.score[p]);   // (the shared machine: both totals as they were before the move)
  // a player's total: counting on as each coin lands in the tray while a move is made here (liveNow), kept while that
  // move goes in (online: until the record has it), and for someone else's move counting on as its last coin lands
  const kept = !g && pLive && pLive.sq === o.zoom && pLive.n === mini.moves[pLive.p] && performance.now() - pLive.at < 6000 ? pLive : null;   // (a move made here going in: its points shown until the record has them)
  const now = p => mini.score[p] + (live ? landed(live, p) : kept ? kept.by[p] : 0);
  const rp = g && pre && (g.after !== g.before || (g.oa || 0) !== (g.ob || 0)) ? replayOf(g, c) : null;   // (someone else's move with coins won: both totals count on coin by coin as the replay plays, frame)
  if (rp) { const at = fxAt('move', a), tm = at == null ? 0 : performance.now() - at; rp.shown = { X: landedPts(rp.gone, tm, 'X'), O: landedPts(rp.gone, tm, 'O') }; }
  const tal = p => arcTally(p, o, `<span class="pshsc" aria-label="${mini.score[p]} of ${c.target} coins">${rp ? `<b data-psh="sc-${p}">${was(p) + rp.shown[p]}</b>` : `<b data-psh="sc-${p}">${now(p)}</b>`}<small>/${c.target}</small></span>`);
  const other = a && a.by === 'X' ? 'O' : 'X', reached = g && !o.done && mini.final && mini.final.by === a.by;
  const res = g ? `<p ${lateAt('arcres ' + (g.scored ? 'ok' : 'no'), REDUCED || !pre ? null : g.ms)} role="status">${reached ? `${c.target}! Last turn: <b class="${other}">${N(other)}</b>` : g.scored ? pushWords(g.by, g.pts, g.opp || 0) : g.lost ? `None over · ${g.lost} lost` : 'None over'}</p>`
    : live ? `<p class="arcres ok pshnow" data-psh="now" role="status">${pushWords(live.p, landed(live, live.p), landed(live, other1(live.p)), true)}</p>`
    : `<p class="arcnote">${o.view || mine ? '' : waitLine(turn)}</p>`;
  src = { mini, a: g ? a : null, who: live ? live.p : who, zoom: o.zoom, mine, c };
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="psh${mine || live ? ' live' : ''}"><canvas class="pshcv" aria-label="The coin pusher: ${pushShelf(mini, src.who).length} coins on the shelf${mine ? '; tap to drop a coin where the dropper is' : ''}"></canvas></div>${res}</div>`;
}
const other1 = p => (p === 'X' ? 'O' : 'X');
// A move's result in words: the mover's points, and the other player's when their coins went over too (the shared machine).
function pushWords(by, mine, theirs, live) {
  if (!mine && !theirs) return '';
  const o = other1(by), a = mine ? `+${mine}` : '', b = theirs ? `+${theirs} <b class="${o}">${N(o)}</b>` : '';
  return live ? [a, b].filter(Boolean).join(' · ') : [a && `${a}`, b].filter(Boolean).join(' · ');
}
// Someone else's move, worked out again from its flash (rules.js pushReplay: the server's own sums), with what the
// drawing needs beside it: where each coin that left the shelf was (`gone`: a coin off a side has only its x in the
// move's events, so its place along the wall is read off the frame before it went).
function replayOf(g, c) {
  if (rsim && rsim.g === g) return rsim;
  const r = pushReplay(c, g), gone = [];
  for (const e of r.events) {
    if (e.kind === 'drop') continue;
    let y = 1;
    if (e.kind === 'lost') {
      const fr = r.frames[Math.round(e.t * PUSH.hz / 1000) - 2] || [], left = e.x < 0.5;
      let best = null;
      for (const q of fr) if (q[1] >= PUSH.gut - 0.04 && (left ? q[0] < 0.12 : q[0] > 0.88) && (!best || (left ? q[0] < best[0] : q[0] > best[0]))) best = q;
      y = best ? best[1] : PUSH.gut + 0.06;
    }
    gone.push({ t: e.t, kind: e.kind, x: e.x, y, st: e.st, ow: e.ow | 0, to: e.to || null, w: e.kind === 'off' ? pushWorth(c, e.st) : 0 });
  }
  rsim = { g, frames: r.frames, events: r.events, gone, shown: { X: 0, O: 0 } };
  return rsim;
}
// The points of the coins that have landed in the tray by tm (ms into the move); in a move under way here, by now.
// side: whose points (a coin's `to`: its owner, or the mover for the machine's own coins).
const landedPts = (gone, tm, side) => { let n = 0; for (const e of gone) if (e.kind === 'off' && (!side || e.to === side) && tm - e.t >= PSHT.fall) n += e.w; return n; };
const landed = (fd, side) => landedPts(fd.gone, fd.sim.s * 1000 / PUSH.hz, side);

// ---- this phone's move ----
function tap() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || sq.mini.type !== 'pusher' || sq.owner || state.flash || state.done || state.winner || blocked()) return false;
  const mini = sq.mini, c = pushCfg(mini), n = Math.max(1, c.perMove | 0), now = performance.now();
  if (!pd) {
    if (!src || !src.mine) return false;
    const p = state.turn, ph = Math.round(idlePh(c, now) * 1000) % 1000, dp = Math.round(idleDp(c, now) * 1000) % 1000;
    pd = { sq: state.zoom, p, c, n, mini, ph, dp, k: [], stars: pushStars(mini, p, c, n), sim: pushInit(c, pushShelf(mini, p), ph / 1000, false, p), at: now, last: now, acc: 0, phase: 'play', raf: 0, endStep: 0, queued: null, gone: [], shown: 0 };
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
  const s = fd.sim.s, i = fd.k.indexOf(s), drop = i >= 0 ? { x: pushDropX(fd.c, s / PUSH.hz, fd.dp / 1000), st: fd.stars[i], ow: OWN[fd.p] } : null;
  if (i >= 0) fd.queued = null;
  const was = fd.sim.list;
  pushStep(fd.sim, drop);
  const out = was.length > fd.sim.list.length ? was.filter(o => !fd.sim.list.includes(o)) : [];   // (the coins this step took off the shelf, in the order of its events)
  let offs = 0, k = 0;
  for (const e of fd.sim.last || []) {
    if (e.kind === 'drop') { SND.play('pshDrop', { at: PSHT.drop / 1000 }); continue; }
    const o = out[k++];
    fd.gone.push({ t: e.t, kind: e.kind, x: e.x, y: o ? o.y : 1, st: e.st, ow: e.ow | 0, to: e.to || null, w: e.kind === 'off' ? pushWorth(fd.c, e.st) : 0 });
    if (e.kind === 'off' && offs++ < 3) { SND.play(e.st ? 'pshStar' : 'pshTray', { at: PSHT.fall / 1000 }); setTimeout(() => haptic('medium'), PSHT.fall); }   // (the clink and the buzz as it lands in the tray)
    else if (e.kind === 'lost') SND.play('pshGone');
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
  while (fd.sim.s < fd.endStep) { const s = fd.sim.s, i = fd.k.indexOf(s); pushStep(fd.sim, i >= 0 ? { x: pushDropX(fd.c, s / PUSH.hz, fd.dp / 1000), st: fd.stars[i], ow: OWN[fd.p] } : null); }
  const pts = fd.sim.pts;
  pLive = { sq: fd.sq, p: fd.p, coins: pushRest(fd.sim), at: performance.now(), gone: fd.gone, pts, by: { X: fd.sim.by.X, O: fd.sim.by.O }, n: fd.mini.moves[fd.p] };
  if (pts > 0) { SND.play('ding'); haptic('medium'); } else SND.play('thud');   // (its result's sound here: the flash of a move made here goes straight to its result)
  attemptMove({ ph: fd.ph, dp: fd.dp, k: fd.k.slice() });
  render();
}
// The running result of a move under way here, as each coin lands in the tray: the line under the machine and the
// mover's total (a little bump each time it changes), written straight into the page (no redraw).
function liveNow(fd) {
  const a = landed(fd, 'X'), b = landed(fd, 'O'), key = a + ':' + b;
  if (key === fd.shown) return;
  fd.shown = key; showPts({ X: fd.mini.score.X + a, O: fd.mini.score.O + b }, pushWords(fd.p, landed(fd, fd.p), landed(fd, other1(fd.p)), true));
}
// Both totals (the shared machine: either can change on any move) and, for a move made here, its running line.
function showPts(tot, line) {
  if (!app.querySelector) return;
  const el = app.querySelector('[data-psh="now"]');
  if (el && line != null) el.innerHTML = line;
  for (const p of ['X', 'O']) {
    const sc = app.querySelector(`[data-psh="sc-${p}"]`);
    if (!sc || String(tot[p]) === sc.textContent) continue;
    sc.textContent = tot[p];
    if (!REDUCED && sc.classList) { sc.classList.remove('pshbump'); void sc.offsetWidth; sc.classList.add('pshbump'); }
  }
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
// The move's sounds at their moments (someone else's move as it plays): a clink as each coin is let go and a tick as it
// lands on the shelf, a coin tipping into the tray (a star coin with its chime), one sliding off a side, then a ding
// for coins won or a thud for none. A move made here had its sounds live (stepOnce, finish).
export function sounds(f, add, won, mini, last) {
  const g = f.push;
  if (!g || !pushPre(f)) return;
  const fr = replayOf(g, pushCfg(mini));
  let offs = 0;
  for (const e of fr.events) {
    if (e.kind === 'drop') { add('clink', e.t); add('pshDrop', e.t + PSHT.drop); }
    else if (e.kind === 'off' && offs++ < 6) add(e.st ? 'pshStar' : 'pshTray', e.t + PSHT.fall);
    else if (e.kind === 'lost') add('pshGone', e.t);
  }
  add(g.scored ? 'ding' : 'thud', g.ms);
}
export const replay = { synth: () => [] };          // the move is its taps: the replay plays them from the flash
// The square's line while the turn is held to it (ui/mini.js): only with "Go again on success" on (coins won).
export function heldSub(mini, turn, f) { return f ? '' : `<b class="${turn}">${N(turn)}</b> won coins · goes again`; }

// ---- the drawing ----
// The machine from above, lit from the top left: the cabinet, the dropper's rail, the shelf between its side walls (they
// stop short of the front: the gutters, two dark gaps a coin can slide off into) and the tray under the front edge are
// painted once into a layer (machineLayer); over it each frame the pusher bar (its top with the player's mark on it,
// its front face, the shadow it casts), every coin with its shadow (two kept sprites: a gold coin, a star coin), the
// coin just let go falling from the dropper, the coins tipping over the front edge into the tray and lying there for
// the rest of the move, a coin off a side dropping into its gutter, and the dropper with the coins still to drop.
// Where a coin is on the shelf is the machine's own number (X, Y: the shelf 1 x 1); the rest is the picture's.
const TRAY = 0.16, TOP = 0.115, WALL = 0.045;        // the machine in shelf units: the tray under the shelf, the dropper's rail over it, a side wall's width
function geom(W, H) {
  const pad = 5, S = Math.max(10, Math.min((W - 2 * pad) / (1 + 2 * WALL), (H - 2 * pad) / (1 + TRAY + TOP)));
  return { S, ox: (W - S) / 2, oy: (H - S * (1 + TRAY + TOP)) / 2 + S * TOP, W, H };
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
const COL0 = { gold: '#f2c14e', goldD: '#a8781c', goldL: '#ffe08a' };
const COL = { body: '#5b4a8c', dark: '#3d3163', lite: '#7d6bb3', shelf: '#2f7f86', shelfL: '#3b959c', tray: '#241f38', wall: '#d8c59b', wallD: '#a8946a', bar: '#e3dccb', barD: '#b5a98f', gold: '#f2c14e', goldD: '#a8781c', goldL: '#ffe08a', star: '#9fd4f5', starD: '#2f6f9e', starL: '#d6eefc' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
// A coin about (x, y): its edge showing under its face (it has a thickness), the rim, a diamond (a star coin: a star),
// a gleam towards the light.
// kind: a coin's look, (star ? 1 : 0) + 2 x its owner (0 the machine's own: silver, 1 X's: red, 2 O's: gold; a star
// coin's face blue inside its owner's rim).
const OWNC = [['#cfd6de', '#6f7a87', '#f5f8fb'], ['#e5604a', '#8e2414', '#ffad9c'], [COL0.gold, COL0.goldD, COL0.goldL]];
const kindOf = (st, ow) => (st ? 1 : 0) + 2 * (ow | 0);
function coinArt(c, x, y, R, kind) {
  const st = kind & 1, [rf, rd, rl] = OWNC[kind >> 1] || OWNC[0];
  const face = st ? COL.star : rf, dk = st ? rd : rd, lt = st ? COL.starL : rl;
  c.fillStyle = dk; c.beginPath(); c.arc(x, y + R * 0.13, R, 0, 7); c.fill();
  c.fillStyle = face; c.strokeStyle = dk; c.lineWidth = Math.max(1, R * 0.14); c.beginPath(); c.arc(x, y, R - c.lineWidth / 2, 0, 7); c.fill(); c.stroke();
  c.lineWidth = Math.max(0.8, R * 0.08); c.beginPath(); c.arc(x, y, R * 0.62, 0, 7); c.stroke();
  c.fillStyle = dk; c.beginPath();
  if (st) { for (let i = 0; i < 10; i++) { const rr = i % 2 ? R * 0.2 : R * 0.48, an = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } }
  else { const k = R * 0.3; c.moveTo(x, y - k); c.lineTo(x + k * 0.7, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.7, y); }
  c.closePath(); c.fill();
  c.strokeStyle = lt; c.lineCap = 'round'; c.lineWidth = Math.max(0.8, R * 0.1); c.beginPath(); c.arc(x, y, R * 0.8, -2.7, -1.75); c.stroke();
}
let sprites = null;
function coinSprites(c, R) {                                          // the two coins, drawn once per size
  const t = c.getTransform ? c.getTransform() : null, dpr = t && t.a > 0 ? t.a : 1, key = R.toFixed(2) + '|' + dpr;
  if (sprites && sprites.key === key) return sprites;
  sprites = null;
  try {
    const size = Math.ceil(2 * R * 1.2 + 4), make = kind => { const cv = document.createElement('canvas'); cv.width = cv.height = Math.max(1, Math.round(size * dpr)); const k = cv.getContext('2d'); k.setTransform(dpr, 0, 0, dpr, 0, 0); coinArt(k, size / 2, size / 2, R, kind); return cv; };
    sprites = { key, size, R, k: [0, 1, 2, 3, 4, 5].map(make) };
  } catch (e) { sprites = null; }
  return sprites;
}
// A coin on the page: k its size (1: on the shelf), sy a squash top to bottom (a coin turning over as it falls), a its alpha.
function coin(c, sp, x, y, R, st, k, sy, a) {
  k = k == null ? 1 : k; sy = sy == null ? 1 : sy;
  if (a != null) { if (a <= 0) return; c.globalAlpha = Math.min(1, a); }
  if (sp && sy === 1) { const d = sp.size * k; c.drawImage(sp.k[st] || sp.k[0], x - d / 2, y - d / 2, d, d); }
  else { c.save(); c.translate(x, y); c.scale(k, k * sy); if (sp) c.drawImage(sp.k[st] || sp.k[0], -sp.size / 2, -sp.size / 2, sp.size, sp.size); else coinArt(c, 0, 0, R, st); c.restore(); }
  if (a != null) c.globalAlpha = 1;
}
function drawMark(c, p, x, y, r, P, a) {                               // the player's drawn X or O (on the pusher bar: whose machine this is)
  c.save(); c.lineCap = 'round'; c.globalAlpha = a == null ? 1 : a;
  for (const [w, col] of [[r * 0.62, P.ink], [r * 0.34, p === 'X' ? P.X : P.O]]) {
    c.lineWidth = w; c.strokeStyle = col; c.beginPath();
    if (p === 'X') { c.moveTo(x - r * 0.6, y - r * 0.6); c.lineTo(x + r * 0.6, y + r * 0.6); c.moveTo(x + r * 0.6, y - r * 0.6); c.lineTo(x - r * 0.6, y + r * 0.6); }
    else c.arc(x, y, r * 0.64, 0, 7);
    c.stroke();
  }
  c.restore();
}
function paintMachine(c, G, P) {
  const S = G.S, X = u => G.ox + u * S, Y = v => G.oy + v * S, wl = WALL * S, L = X(0) - wl - 3, Rt = X(1) + wl + 3, T = Y(-TOP) - 2, B = Y(1 + TRAY) + 3, gy = Y(PUSH.gut);
  // the cabinet
  c.fillStyle = 'rgba(22,18,16,.16)'; c.beginPath(); c.roundRect(L + 2, T + 3, Rt - L, B - T, 11); c.fill();
  c.fillStyle = COL.body; c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.roundRect(L, T, Rt - L, B - T - 1, 11); c.fill();
  c.fillStyle = COL.dark; c.beginPath(); c.roundRect(L, T, Rt - L, Y(0) - T, [11, 11, 0, 0]); c.fill();                 // the dropper's panel
  c.fillStyle = COL.lite; c.fillRect(L + 2.5, T + 8, 2, B - T - 20);
  c.beginPath(); c.roundRect(L, T, Rt - L, B - T - 1, 11); c.stroke();
  const ry = Y(-TOP * 0.5);                                                                                                // the rail
  c.fillStyle = '#b9bfca'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(X(0) - wl * 0.5, ry - 2.5, S + wl, 5, 2.5); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(X(0), ry - 1.6, S, 1.2);
  // the shelf, a sheen across it, the shade the left wall and the panel above throw on it
  c.fillStyle = COL.shelf; c.fillRect(X(0), Y(0), S, S);
  c.fillStyle = 'rgba(255,255,255,.05)'; for (const [a, b] of [[0.1, 0.24], [0.5, 0.56], [0.7, 0.9]]) { c.beginPath(); c.moveTo(X(a), Y(0)); c.lineTo(X(b), Y(0)); c.lineTo(X(b - 0.22), Y(1)); c.lineTo(X(a - 0.22), Y(1)); c.fill(); }
  c.fillStyle = 'rgba(10,8,20,.16)'; c.fillRect(X(0), Y(0), S * 0.016, PUSH.gut * S);
  // the tray under the front edge: darker under the lip
  c.fillStyle = COL.tray; c.fillRect(X(0) - wl, Y(1), S + 2 * wl, TRAY * S);
  const tg = c.createLinearGradient(0, Y(1), 0, Y(1 + TRAY * 0.5)); tg.addColorStop(0, 'rgba(0,0,0,.45)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = tg; c.fillRect(X(0) - wl, Y(1), S + 2 * wl, TRAY * S * 0.5);
  c.fillStyle = 'rgba(255,255,255,.09)'; c.fillRect(X(0) - wl, Y(1 + TRAY) - 3, S + 2 * wl, 3);
  // the gutters (where the side walls stop) and the walls
  c.fillStyle = COL.tray; c.fillRect(X(0) - wl, gy, wl, Y(1) - gy); c.fillRect(X(1), gy, wl, Y(1) - gy);
  const gg = c.createLinearGradient(0, gy, 0, gy + S * 0.05); gg.addColorStop(0, 'rgba(0,0,0,.5)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gg; c.fillRect(X(0) - wl, gy, wl, S * 0.05); c.fillRect(X(1), gy, wl, S * 0.05);
  for (const x of [X(0) - wl, X(1)]) {
    c.fillStyle = COL.wall; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.rect(x, Y(0), wl, gy - Y(0)); c.fill();
    c.fillStyle = COL.wallD; c.fillRect(x, gy - S * 0.02, wl, S * 0.02); c.fillRect(x + wl * 0.72, Y(0), wl * 0.28, gy - Y(0));
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x + 1.5, Y(0) + 2, 1.5, gy - Y(0) - S * 0.03);
    c.beginPath(); c.rect(x, Y(0), wl, gy - Y(0)); c.stroke();
  }
  // the front edge: the shelf's lip
  c.fillStyle = COL.shelfL; c.fillRect(X(0), Y(1) - 2.5, S, 2.5);
  c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(0), Y(1)); c.lineTo(X(1), Y(1)); c.stroke();
  c.lineWidth = 2; c.strokeRect(X(0) - wl, Y(0), S + 2 * wl, (1 + TRAY) * S);
}
let layer = null;
function machineLayer(c, G, P) {
  const t = c.getTransform ? c.getTransform() : null, dpr = t && t.a > 0 ? t.a : 1, key = [G.W, G.H, dpr].join('|');
  if (layer && layer.key === key) return layer.cv;
  layer = null;
  try {
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(G.W * dpr)); cv.height = Math.max(1, Math.round(G.H * dpr));
    const lc = cv.getContext('2d'); lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintMachine(lc, G, P);
    layer = { key, cv };
  } catch (e) { layer = null; }                                     // (no canvas to keep it in: painted straight on, below)
  return layer ? layer.cv : null;
}
// Where a coin over the front edge comes to lie in the tray (the i-th of the move: a loose row or two).
const trayAt = (e, i, r) => ({ x: clamp(e.x, r * 0.9, 1 - r * 0.9), y: 1 + TRAY * (0.52 + (((i * 7) % 5) - 2) * 0.075) });
// One frame: true while something moves (another frame wanted: idle, the bar and the dropper always do).
function frame(c, G, now) {
  const P = runColours(), mini = src.mini, cfg = src.c, S = G.S, X = u => G.ox + u * S, Y = v => G.oy + v * S, rr = pushR(cfg), R = rr * S, wl = WALL * S;
  const fd = pd && pd.sq === src.zoom ? pd : null, a = fd ? null : src.a, g = a ? a.push : null;
  const at = a ? fxAt('move', a) : null, t = at == null ? null : Math.max(0, now - at);
  const m = g && pushPre(a) && t != null ? replayOf(g, cfg) : null, step = m ? Math.min(m.frames.length - 1, Math.floor(t / 1000 * PUSH.hz)) : -1;
  const who = fd ? fd.p : src.who, col = who === 'O' ? P.O : P.X, n = Math.max(1, cfg.perMove | 0);
  // where the bar and the dropper are: the move under way's, a replay's, else the page's clock; the coins on the shelf,
  // the move's time (tm, ms), its drops ([step, x]) and what has left the shelf so far
  let bar, dx, list, tm = null, drops = [], gone = null, stepNow = -1, left = 0;
  if (fd) {
    bar = pushBar(cfg, fd.sim.s / PUSH.hz, fd.ph / 1000); dx = pushDropX(cfg, fd.sim.s / PUSH.hz, fd.dp / 1000);
    list = fd.sim.list.map(o => [o.x, o.y, kindOf(o.st, o.ow)]); tm = fd.sim.s * 1000 / PUSH.hz; stepNow = fd.sim.s - 1; gone = fd.gone;
    drops = fd.k.filter(k => k <= stepNow).map(k => [k, pushDropX(cfg, k / PUSH.hz, fd.dp / 1000)]); left = fd.n - fd.k.length;
  } else if (m && step >= 0) {
    bar = pushBar(cfg, (step + 1) / PUSH.hz, g.ph / 1000); dx = pushDropX(cfg, (step + 1) / PUSH.hz, g.dp / 1000);
    list = m.frames[step].map(q => [q[0], q[1], kindOf(q[2], q[3])]); tm = t; stepNow = step; gone = m.gone;
    const sx = landedPts(gone, tm, 'X'), so = landedPts(gone, tm, 'O');
    if (sx !== m.shown.X || so !== m.shown.O) { m.shown = { X: sx, O: so }; const bx = g.by === 'X' ? g.before : g.ob, bo = g.by === 'O' ? g.before : g.ob; if (bx != null && bo != null) showPts({ X: bx + sx, O: bo + so }); }   // (both totals counting on as each coin lands in the tray)
    drops = g.k.filter(k => k <= step).map(k => [k, pushDropX(cfg, k / PUSH.hz, g.dp / 1000)]); left = g.k.length - drops.length;
  } else {
    bar = pushBar(cfg, 0, idlePh(cfg, now)); dx = pushDropX(cfg, 0, idleDp(cfg, now));
    const own = pLive && pLive.sq === src.zoom && pLive.p === src.who ? pLive : null;
    list = (own && !g ? own.coins : pushShelf(mini, src.who)).map(q => [q[0] / PUSH.Q, q[1] / PUSH.Q, kindOf(q[2], q[3])]);
    if (own && (g || own.n === mini.moves[src.who]) && now - own.at < 6000) { gone = own.gone; tm = Infinity; }   // (a move made here, its result on show or going in: its coins still lie in the tray)
    left = src.mine ? n : 0;
  }
  c.clearRect(0, 0, G.W, G.H);
  const lay = machineLayer(c, G, P);
  if (lay) c.drawImage(lay, 0, 0, G.W, G.H); else paintMachine(c, G, P);
  const sp = coinSprites(c, R);
  // the pusher bar: its top (grooves, the player's mark), its front face, the shadow it throws on the shelf
  const by = Y(bar), ft = S * 0.03;
  c.fillStyle = COL.bar; c.fillRect(X(0), Y(0), S, bar * S - ft);
  c.fillStyle = 'rgba(22,18,16,.09)'; for (let i = 0; i < 6; i++) c.fillRect(X(i / 6 + 1 / 12) - S * 0.008, Y(0) + 3, S * 0.016, bar * S - ft - 6);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(X(0), by - ft - 2, S, 2);
  drawMark(c, who, X(0.5), by - ft - S * 0.068, S * 0.048, P, 0.92);
  c.fillStyle = COL.barD; c.fillRect(X(0), by - ft, S, ft);
  c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(X(0), Y(0), S, bar * S); c.beginPath(); c.moveTo(X(0), by - ft); c.lineTo(X(1), by - ft); c.lineWidth = 1.2; c.stroke();
  c.fillStyle = 'rgba(10,8,20,.2)'; c.fillRect(X(0), by, S, S * 0.022);
  // the coins on the shelf: their shadows (one fill: none darkens another), then the coins; the ones just let go fall
  // from the dropper to where the machine has them (the last of the list, newest last)
  const fall = new Map();
  drops.forEach(([k, x0], j) => { const age = (stepNow - k) * 1000 / PUSH.hz + (fd ? fd.acc * 1000 : 0); if (age < PSHT.drop && !REDUCED) fall.set(list.length - (drops.length - j), { u: clamp(age / PSHT.drop, 0, 1), x0 }); });
  c.save(); c.beginPath(); c.rect(X(0) - wl, Y(0), S + 2 * wl, (1 + TRAY) * S); c.clip();   // (a coin over the front edge or in a gutter hangs out over it)
  c.fillStyle = 'rgba(10,8,20,.24)'; c.beginPath();
  list.forEach(([x, y], i) => { const f = fall.get(i), h = f ? 1 - f.u * f.u : 0, px = X(x) + R * (0.14 + 0.5 * h), py = Y(y) + R * (0.2 + 0.7 * h), r = R * (1 - 0.25 * h); c.moveTo(px + r, py); c.arc(px, py, r, 0, 7); });
  c.fill();
  list.forEach(([x, y, st], i) => { if (!fall.has(i)) coin(c, sp, X(x), Y(y), R, st); });
  c.restore();
  // the tray: the coins that went over the front edge, tipping in (turning over as they fall, a little bounce), lying
  // there for the rest of the move; a star coin sparkles as it lands; a coin off a side drops into its gutter
  if (gone && tm != null) {
    let i = 0;
    for (const e of gone) {
      const dt = tm - e.t;
      if (e.kind === 'off') {
        const q = trayAt(e, i++, rr), kd = kindOf(e.st, e.ow);
        if (dt < 0) continue;
        if (REDUCED || dt >= PSHT.fall + PSHT.bounce) { coin(c, sp, X(q.x), Y(q.y), R, kd, 0.94); continue; }
        const u = Math.min(1, dt / PSHT.fall), b = dt > PSHT.fall ? Math.sin((dt - PSHT.fall) / PSHT.bounce * Math.PI) * 0.014 : 0;
        coin(c, sp, X(lerp(e.x, q.x, u)), Y(lerp(1 + rr * 0.15, q.y, u * u) - b), R, kd, lerp(1, 0.94, u), Math.max(0.16, Math.abs(Math.cos(u * Math.PI))));
      } else if (dt >= 0 && dt < PSHT.gone && !REDUCED) {
        const u = dt / PSHT.gone, lf = e.x < 0.5, x0 = lf ? X(0) - wl * 0.5 : X(1) + wl * 0.5;
        c.save(); c.beginPath(); c.rect(lf ? X(0) - wl : X(1), Y(PUSH.gut), wl, Y(1 + TRAY) - Y(PUSH.gut)); c.rect(X(0), Y(0), S, S); c.clip();
        coin(c, sp, lerp(X(e.x), x0, Math.min(1, u * 1.6)), Y(e.y) + u * u * S * 0.05, R, kindOf(e.st, e.ow), 1 - 0.45 * u, 1, 1 - u * u);
        c.restore();
      }
    }
    i = 0;
    for (const e of gone) if (e.kind === 'off') { const q = trayAt(e, i++, rr), u = (tm - e.t - PSHT.fall) / PSHT.spark; if (e.st && u > 0 && u < 1 && !REDUCED) sparkle(c, X(q.x), Y(q.y), u, R); }
  }
  // the coins falling from the dropper (over the shelf's coins, under the dropper)
  for (const [i, f] of fall) { const q = list[i]; if (!q) continue; const e = f.u * f.u; coin(c, sp, lerp(X(f.x0), X(q[0]), e), lerp(Y(-TOP * 0.5), Y(q[1]), e), R, q[2], 1.3 - 0.3 * e); }
  // the dropper on its rail: a carriage in the mover's colour, the coins still to drop in its window, its spout
  const ry = Y(-TOP * 0.5), dw = R * 3.5, dh = Math.min(TOP * S * 0.8, R * 1.7), x = X(dx);
  c.fillStyle = 'rgba(10,8,20,.22)'; c.beginPath(); c.roundRect(x - dw / 2 + 3, ry - dh / 2 + 4, dw, dh, 5); c.fill();
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - R * 0.7, ry + dh / 2 - 1); c.lineTo(x + R * 0.7, ry + dh / 2 - 1); c.lineTo(x + R * 0.45, ry + dh / 2 + R * 0.42); c.lineTo(x - R * 0.45, ry + dh / 2 + R * 0.42); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(x - dw / 2, ry - dh / 2, dw, dh, 5); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - dw / 2 + 4, ry - dh / 2 + 2.5, dw - 8, 1.6);
  const pr = Math.min(R * 0.42, dw / (2 * n + 1.5)), gap = pr * 2.35, x0 = x - gap * (n - 1) / 2;
  for (let i = 0; i < n; i++) {                                    // (its window: a place for each coin of the move, the ones still to drop in them)
    const on = i < left;
    c.fillStyle = on ? col : COL.dark; c.strokeStyle = P.ink; c.lineWidth = Math.max(1, pr * 0.3);   // (the coins still to drop: the mover's colour, as they will lie on the shelf)
    c.beginPath(); c.arc(x0 + i * gap, ry + 0.5, pr, 0, 7); c.fill(); c.stroke();
  }
  // the attempt's time bar (from the first coin to the time limit), while coins are still to drop
  if (fd && fd.phase === 'play') drawTimeBar(c, G.W, G.H, 1 - fd.sim.s / pushMaxSteps(cfg), P);
  return true;                                                   // (the machine never stops)
}
function sparkle(c, x, y, u, R) {                                      // a star coin in the tray: little stars flying off it
  c.save(); c.globalAlpha = 1 - u * u; c.fillStyle = '#fff6c9'; c.strokeStyle = 'rgba(22,18,16,.5)'; c.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const an = -Math.PI / 2 + (i - 2.5) * 0.62, d = R * (0.6 + 1.5 * (1 - (1 - u) * (1 - u))), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * 0.8, r = R * (i % 2 ? 0.26 : 0.38) * (1 - 0.4 * u);
    c.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.4 : r, a2 = k * Math.PI / 4 + u * 2; if (k) c.lineTo(px + Math.cos(a2) * rr, py + Math.sin(a2) * rr); else c.moveTo(px + Math.cos(a2) * rr, py + Math.sin(a2) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}

// ---- the miniature: the one machine from above (the shared machine, v 3): its coins in their owners' colours (the
// machine's own pale, a star coin blue inside its rim), and each player's points beside it (a square from before: the
// mover's machine stands in until its next move makes it shared) ----
export function miniature(mini) {
  const c = pushCfg(mini), r = Math.max(1.1, pushR(c) * 30), shelf = pushShelf(mini, 'X');
  const coins = shelf.map(q => `<circle class="${['n', 'X', 'O'][q[3] | 0] || 'n'}${q[2] ? ' st' : ''}" cx="${(4 + (q[0] / PUSH.Q) * 30).toFixed(1)}" cy="${(4 + (q[1] / PUSH.Q) * 30).toFixed(1)}" r="${r.toFixed(2)}"/>`).join('');
  const art = `<svg class="tpsh one" viewBox="0 0 38 40" aria-hidden="true"><rect class="tpshc" x="0" y="0" width="38" height="40" rx="3"/><rect class="tpshs" x="4" y="4" width="30" height="30"/><rect class="tpshb" x="4" y="4" width="30" height="${(PUSH.back * 30).toFixed(1)}"/><g class="tpshk">${coins}</g><rect class="tpsht" x="4" y="34" width="30" height="4"/></svg>`;
  const rows = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tsn">${mini.score[p]}</span></div>`).join('');
  return thumbArt(art, rows, 'tpshw', `Coin Pusher: X ${mini.score.X}, O ${mini.score.O} of ${c.target} coins`);
}
