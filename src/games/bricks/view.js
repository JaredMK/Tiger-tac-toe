// Brick Break: the screen, the miniature, the move's words and sounds, and the inputs.
// A square opens on the player's wall as it stands (the bricks they have broken gone), the paddle under it with the
// ball on it, and Start below. Start begins one go: the ball is served and the finger, anywhere on the screen, slides
// the paddle (a drag, one to one with the field). The go is stepped here with the engine's own simulation (rules.js:
// fixed steps, the finger's place recorded as it changes), so it goes in as its inputs and the server plays them
// through again. Someone else's go (the computer's, the other phone's) plays here first, from its inputs, then the
// result; the go this phone just played is not replayed to it (its last moment stays while the result shows).
import { tune } from '../../core/tune.js';
import { BRK, brkBroken, brkClampX, brkLog, brkMs, brkRaw, brkRecorder, brkResult, brkStart, brkStep, brkTotal, brkUnlog } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, state } from '../../ui/app.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG } from '../../ui/thumbs.js';
import { drawTimeBar, outlined, rr, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { cpuTurn, skipFlash } from '../../ui/turns.js';

const BRK_EARLY = 700;                                           // online: a go ends this long before the turn's time is up, so it goes in before the timeout
const BRICK_ROWS = ['#e0603a', '#f09a3a', '#f6c21b', '#8ccf5c', '#58a8cf', '#9b7fe0', '#e86aa0', '#c9a06a'];   // a colour a row (the wall's top row first)
const fmt = n => Math.floor(n + 1e-9).toLocaleString('en-US');
export let draft = null;                                         // the go under way on this phone (brkGo)
let live = null;                                                 // the go just made here: { sq, p, try, view, at } (its last moment stays on the field while its result shows)
let raf = 0;                                                     // the replay's frame loop
const reps = new WeakMap();                                      // flash -> someone else's go, ready to play
const skipped = new WeakSet();                                   // this phone's own go: its flash skipped past the replay it does not need
const trysOf = (sq, p) => { const m = sq.mini; return m.tries ? m.tries[p] : 0; };
const isOwn = (f, sq) => !!(f && f.brk && live && live.sq === sq && f.brk.by === live.p && f.brk.try === live.try && !f.brk.auto);
export const brkPinned = () => !!(draft && state.screen === 'mini' && state.zoom === draft.sq && !state.flash);
// Someone else's go plays first: how long (ms on screen), none for this phone's own.
export function brkPre(f, sq) { return f && f.brk && !f.brk.auto && !f.timeout && !REDUCED && !isOwn(f, sq) ? brkMs(f.brk) + (BRK.end[f.brk.end] || 0) : 0; }
// The square as it was before a go (the bricks it broke standing again): a replay starts there.
function brkBefore(mini, b) {
  const m = JSON.parse(JSON.stringify(mini)), w = m.wall[b.by];
  for (const k of b.broke || []) w[k] = 1;
  m.tries[b.by] = b.try;
  return m;
}
// The go as a move, as it stands (one still under way: as if it ended now, 'out').
const brkMove = fd => { const r = brkResult(fd.sim); return { log: brkLog(fd.rec.pairs), steps: r.steps, n: r.n, end: r.end }; };

// ---- Start: the go begins (held to the square here: the Board button goes while it is on) ----
function brkGo() {
  const sq0 = state.squares && state.squares[state.zoom];
  if (!sq0 || sq0.mini.type !== 'bricks' || sq0.owner || draft || state.flash || state.done || blocked()) return;
  const p = state.turn, i = state.zoom, now = performance.now(), mini = sq0.mini;
  draft = { sq: i, p, try: trysOf(sq0, p), mini, sim: brkStart(mini, p), rec: brkRecorder(), phase: 'play', at: now, last: now, acc: 0, raf: 0, ptr: null, dir: 0, kpx: 30, tx: BRK.w / 2, broke: {}, end: null, endAt: 0 };
  live = null;
  SND.play('go');
  render();
  draft.raf = requestAnimationFrame(brkFrame);
}
function brkFrame(now) {
  const fd = draft;
  if (!fd) return;
  fd.raf = 0;
  if (state.screen !== 'mini' || state.zoom !== fd.sq || state.winner) { brkFinish(); return; }   // (taken off the square somehow: it ends where it stands)
  const dt = Math.min(0.1, Math.max(0, (now - fd.last) / 1000));
  fd.last = now;
  if (fd.phase === 'play') {
    const left = clockLeft();
    if (left != null && left <= (state.online ? BRK_EARLY : 0)) { brkFinish(); return; }   // the turn's time is up: the go ends here, its bricks kept
    if (fd.dir) fd.tx = brkClampX(fd.tx + fd.dir * 12 * dt, fd.sim.half);   // (a keyboard's arrows)
    fd.acc += dt;
    while (fd.acc >= BRK.step - 1e-9 && !fd.sim.end) { fd.acc -= BRK.step; brkTick(fd, fd.sim, fd.rec.at(fd.sim.n, fd.tx), true, now); }
    if (fd.sim.end) brkEnd(fd, fd.sim.end, now);
    brkHud(fd);
  } else if (now - fd.endAt >= (BRK.end[fd.end] || 500)) { brkFinish(); return; }
  const cv = app.querySelector('canvas[data-brk="cv"]');
  if (cv) brkDraw(cv, brkDraftView(fd, now), now);
  fd.raf = requestAnimationFrame(brkFrame);
}
// One step (the phone's own, or a replay's), noting what it did for the drawing and, loud, its sounds and buzzes.
function brkTick(v, sim, tx, loud, now) {
  brkStep(sim, tx);
  if (sim.last === 'brick') { v.broke[sim.hit] = sim.t; if (loud) { SND.play('brkBrick'); haptic('tap'); } }
  else if (sim.last === 'pad') { v.padAt = sim.t; if (loud) SND.play('brkPaddle'); }
  else if (sim.last === 'serve') { if (loud) SND.play('pop'); }
  else if ((sim.last === 'wall' || sim.last === 'top') && loud) SND.play('brkWall');
}
// The go has ended (a miss, the wall cleared, the time up): its end plays, then it goes in.
function brkEnd(fd, end, now) {
  if (fd.phase !== 'play') return;
  fd.phase = 'end'; fd.end = end; fd.endAt = now; fd.ptr = null;
  if (end === 'clear') { SND.play('sparkle'); haptic('success'); }
  else { SND.play('thud'); haptic('medium'); }
}
// The go goes in: as it ended, or as it stands (the time ran out, the screen went away).
export function brkFinish() {
  const fd = draft;
  if (!fd) return;
  cancelAnimationFrame(fd.raf); draft = null;
  if (fd.sim.n === 0) brkTick(fd, fd.sim, fd.rec.at(0, fd.tx), false);   // (at least one step: a go of none is no go)
  const m = brkMove(fd);
  live = { sq: fd.sq, p: fd.p, try: fd.try, view: brkDraftView(fd, performance.now()), at: performance.now() };
  const sq = state.squares && state.squares[fd.sq];
  if (state.screen === 'mini' && state.zoom === fd.sq && sq && !sq.owner && state.turn === fd.p && !state.flash && !state.done && !blocked()) attemptMove(m);   // (else the turn moved on without it: nothing to send)
  render();
}
function brkHud(fd) {
  const hud = app.querySelector('[data-brk="hud"]');
  if (hud) hud.textContent = `+${fd.sim.broke.length}`;
  const row = app.querySelector(`.brkp.${fd.p}`), total = brkTotal(fd.mini), at = brkBroken(fd.mini, fd.p) + fd.sim.broke.length;
  if (!row) return;
  const bi = row.querySelector('.rbar i'), w = (100 * Math.min(1, at / total)).toFixed(2) + '%';
  if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); }
  const sm = row.querySelector('small');
  if (sm) sm.textContent = brkSay(at, total);
}
const brkSay = (at, total) => `${fmt(at)} / ${fmt(total)}`;

// ---- what the field shows: the go under way, a replay, the last moment, or the clean start ----
const brkDraftView = (fd, now) => ({ p: fd.p, sim: fd.sim, broke: fd.broke, padAt: fd.padAt, end: fd.end, endAt: fd.endAt, tx: fd.tx });
const brkStill = (mini, p) => ({ p, sim: brkStart(mini, p), broke: {}, still: true });
// Someone else's go, ready to play from its inputs (stepped as the replay goes).
function brkReplayOf(f) {
  if (reps.has(f)) return reps.get(f);
  const sq = shownSq(f.square), b = f.brk;
  let rep = null;
  if (sq && b && !b.auto) {
    const log = brkUnlog(b.log, b.steps) || [], raw = brkRaw(b), ms = brkMs(b);
    rep = { p: b.by, mini0: brkBefore(sq.mini, b), log, steps: b.steps, ms, raw, speed: ms > 0 ? raw / ms : 1, end: b.end };
  }
  reps.set(f, rep);
  return rep;
}
// A replay's view at T seconds into the go (the sim stepped on to there).
function brkRepView(rep, T, now) {
  if (!rep.sim || rep.sim.n > T / BRK.step + 1) { rep.sim = brkStart(rep.mini0, rep.p); rep.k = 0; rep.broke = {}; rep.tx = rep.sim.px; rep.endAt = null; }
  const sim = rep.sim, want = Math.min(rep.steps, Math.floor(T / BRK.step + 1e-6));
  while (sim.n < want && !sim.end) {
    let tx = null;
    if (rep.k < rep.log.length && rep.log[rep.k][0] === sim.n) { tx = rep.log[rep.k++][1] / BRK.q; rep.tx = tx; }
    brkTick(rep, sim, tx, false);
  }
  if (sim.n >= rep.steps && !sim.end) sim.end = rep.end;         // (the go ran out of time: as sent)
  if (sim.end && rep.endAt == null) rep.endAt = now;
  return { p: rep.p, sim, broke: rep.broke, padAt: rep.padAt, end: sim.end, endAt: rep.endAt, tx: rep.tx };
}
// After every render (view.js screen queues it): the field of a Brick Break square.
export function brkPaint() {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  const cv = app.querySelector('canvas[data-brk="cv"]');
  if (!cv || !['mini', 'review-mini'].includes(state.screen)) return;
  const sq = shownSq(state.zoom);
  if (!sq || sq.mini.type !== 'bricks') return;
  if (draft && draft.sq === state.zoom) { brkDraw(cv, brkDraftView(draft, performance.now()), performance.now()); return; }   // (its own loop draws it)
  if (brkRepFrame(performance.now())) raf = requestAnimationFrame(brkRepLoop);
}
function brkRepLoop(now) {
  raf = 0;
  if (brkRepFrame(now)) raf = requestAnimationFrame(brkRepLoop);
}
// One drawing of the field with no go under way here; true while a replay wants more frames.
function brkRepFrame(now) {
  const cv = app.querySelector('canvas[data-brk="cv"]'), sq = shownSq(state.zoom);
  if (!cv || !sq || sq.mini.type !== 'bricks' || (draft && draft.sq === state.zoom)) return false;
  const f = state.flash && state.flash.square === state.zoom && state.flash.brk ? state.flash : null;
  const pre = f ? brkPre(f, state.zoom) : 0, start = f ? fxAt('move', f) : null;
  if (pre && start != null) {                                      // someone else's go, as it played (then its last moment while the result shows)
    const rep = brkReplayOf(f);
    if (rep) {
      const e = Math.max(0, now - start), T = (Math.min(e, rep.ms) * rep.speed) / 1000, v = brkRepView(rep, T, now);
      brkDraw(cv, v, now);
      const hud = app.querySelector('[data-brk="hud"]');
      if (hud) hud.textContent = `+${v.sim.broke.length}`;
      return e < pre + 1200;
    }
  }
  const lv = live && live.sq === state.zoom && live.view ? live : null;   // this phone's go just made: its last moment, while it goes in and its result shows
  if (lv && (f ? f.brk.by === lv.p : trysOf(sq, lv.p) === lv.try && now - lv.at < 15000)) { brkDraw(cv, lv.view, now); return now - lv.at < 1500; }
  brkDraw(cv, brkStill(sq.mini, sq.owner || (f ? f.by : state.turn)), now);
  return false;
}

// ---- the drawing: a deep field, the wall in a colour a row, the paddle and ball in the player's colour ----
export function brkDraw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, k = Math.min(W / BRK.w, H / BRK.h), ox = (W - BRK.w * k) / 2, oy = (H - BRK.h * k) / 2;
  const X = x => ox + x * k, Y = y => oy + (BRK.h - y) * k, col = v.p === 'O' ? P.O : P.X;
  if (draft && v.sim === draft.sim) draft.kpx = k;
  c.fillStyle = '#1b2236'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#243052'; c.fillRect(ox, oy, BRK.w * k, BRK.h * k);   // the field
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;         // a faint grid of tiles on it
  for (let g = 1; g < BRK.w; g++) { c.beginPath(); c.moveTo(X(g), oy); c.lineTo(X(g), oy + BRK.h * k); c.stroke(); }
  for (let g = 1; g < BRK.h; g++) { c.beginPath(); c.moveTo(ox, Y(g)); c.lineTo(ox + BRK.w * k, Y(g)); c.stroke(); }
  const bw = sim.bw * k, bh = BRK.bh * k, gap = Math.max(1.5, k * 0.06);
  for (let i = 0; i < sim.rows; i++) for (let j = 0; j < sim.cols; j++) {   // the wall: standing bricks solid, broken ones a faint outline where they were
    const idx = i * sim.cols + j, x = X(j * sim.bw) + gap, y = Y(BRK.top - i * BRK.bh) + gap, w = bw - 2 * gap, h = bh - 2 * gap, at = v.broke[idx];
    if (sim.wall[idx]) { rr(c, x, y, w, h, Math.min(5, h * 0.3)); outlined(c, BRICK_ROWS[i % BRICK_ROWS.length], P.ink, 2); c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x + 3, y + 2.5, Math.max(0, w - 6), Math.max(1, h * 0.18)); }
    else if (at != null && sim.t - at < 0.4) brkShards(c, x + w / 2, y + h / 2, w, h, (sim.t - at) / 0.4, BRICK_ROWS[i % BRICK_ROWS.length], P);
    else { c.save(); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1; rr(c, x, y, w, h, 3); c.stroke(); c.restore(); }
  }
  const ph = BRK.padH * k, pw = sim.half * 2 * k, px = X(sim.px), py = Y(BRK.padY), squash = v.padAt != null && sim.t - v.padAt < 0.12 ? 1 - 0.25 * (1 - (sim.t - v.padAt) / 0.12) : 1;   // the paddle, dipping a little as it takes the ball
  c.save(); c.translate(px, py + ph * (1 - squash)); c.scale(1, squash);
  rr(c, -pw / 2, 0, pw, ph, ph / 2); outlined(c, col, P.ink, 2.5);
  c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, -pw / 2 + 5, 2.5, Math.max(0, pw - 10), Math.max(1.5, ph * 0.22), 2); c.fill();
  c.restore();
  const r = BRK.r * k, bx = X(sim.x), by = Y(sim.y);
  if (sim.flying && !v.still && !v.end) { c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = r * 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - sim.vx * k * 0.04, by + sim.vy * k * 0.04); c.stroke(); }   // a short trail
  if (v.end !== 'miss' || !v.endAt || now - v.endAt < 250) {
    c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); outlined(c, P.paper, P.ink, 2.2);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(bx + r * 0.25, by + r * 0.25, r * 0.5, 0, Math.PI * 2); c.fill();
  }
  if (v.end === 'clear' && v.endAt) {                              // the wall cleared: stars burst across where it stood
    const u = Math.min(1, (now - v.endAt) / 700), cx = X(BRK.w / 2), cy = Y(BRK.top - (sim.rows * BRK.bh) / 2);
    c.strokeStyle = P.O; c.lineWidth = 3; c.lineCap = 'round';
    for (let s = 0; s < 14; s++) { const a = (s / 14) * Math.PI * 2, d0 = k * (1 + 4 * u), d1 = d0 + k * (0.6 + u); c.beginPath(); c.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d1 * 0.5); c.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * (d1 + k * 0.5) * 0.5); c.stroke(); }
  }
  if (v.end === 'out' && v.endAt) { c.fillStyle = 'rgba(27,34,54,.35)'; c.fillRect(ox, oy, BRK.w * k, BRK.h * k); }   // the time up: the field dims
  const wall = Math.max(4, k * 0.16);                              // the sides: a pale edge inside either wall
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(ox, oy, wall, BRK.h * k); c.fillRect(ox + BRK.w * k - wall, oy, wall, BRK.h * k); c.fillRect(ox, oy, BRK.w * k, wall);
  // the attempt's time limit: a bar along the top, clear of the score at the top left (ui/runner.js drawTimeBar), while the attempt runs or replays
  if (!v.still) { const x0 = Math.round(W * 0.36); c.save(); c.translate(x0, 0); drawTimeBar(c, W - x0, H, 1 - sim.t / sim.cfg.runSecs, P); c.restore(); }
}
function brkShards(c, cx, cy, w, h, u, fill, P) {                   // a brick just broken: four pieces flying apart and fading
  c.save(); c.globalAlpha = 1 - u;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.save(); c.translate(cx + sx * (w * 0.25 + u * w * 0.5), cy + sy * (h * 0.25 + u * h * 0.9) + u * u * h * 1.5); c.rotate(sx * sy * u * 1.2);
    rr(c, -w * 0.22, -h * 0.22, w * 0.44, h * 0.44, 2); outlined(c, fill, P.ink, 1.5);
    c.restore();
  }
  c.restore();
}

// ---- the square: both players' walls as bars, the field, a line of words, Start ----
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const b = a && a.brk ? a.brk : null, pre = b ? brkPre(a, state.zoom) : 0, total = brkTotal(mini), zoom = state.zoom;
  const lv = draft && draft.sq === zoom ? draft : null, own = b ? isOwn(a, zoom) : false;
  const mine = !view && !b && !d && !cpuTurn() && !remoteTurn();   // this phone's go to make
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const row = p => {
    const fresh2 = b && a.by === p, here = lv && lv.p === p;
    const at = here ? brkBroken(mini, p) + lv.sim.broke.length : fresh2 ? b.to : brkBroken(mini, p);
    const grow = fresh2 && pre > 0, w1 = 100 * Math.min(1, at / total), w0 = grow ? 100 * Math.min(1, b.from / total) : w1;
    const say = grow ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${brkSay(b.from, total)}</span><span class="tf" style="--f:${pre}ms">${brkSay(at, total)}</span></span>` : brkSay(at, total);
    return `<div class="rprog brkp ${p}${!view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${total}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:900ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${say}</small></div>`;
  };
  const shown = b || ((d || view) && mini.last && !mini.last.auto ? mini.last : null), who = b ? a.by : shown ? shown.by : turn;
  const said = shown ? brkResultText(shown, total, W(who)) : { text: '', ok: false };
  const words = b ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is having a go…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : lv ? '<span></span>'
    : view ? (shown ? `<span>${said.text}</span>` : '')
    : '<span></span>';   // (how to play is in the ? explainer; whose turn it is, the header says)
  const hudV = lv ? lv.sim.broke.length : b && !own && pre ? 0 : null;
  const hud = `<div class="rhud brkhud" data-brk="hud">${hudV == null ? '' : `+${hudV}`}</div>`;
  const scene = `<div class="brkscene" data-brk="scene" aria-label="The wall of bricks, the paddle and the ball"><canvas data-brk="cv"></canvas>${hud}</div>`;
  const go = mine && !lv && !locked;
  const btn = view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="brk-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the field never moves
  if (typeof queueMicrotask === 'function' && typeof HTMLCanvasElement !== 'undefined') {   // (once this markup is on the page; never in the tests' stubbed page)
    queueMicrotask(brkPaint);
    if (own && a && !skipped.has(a)) queueMicrotask(() => { if (state.flash === a && fxAt('move', a) != null && !skipped.has(a)) { skipped.add(a); skipFlash(); } });   // this phone's own go: already seen as it was played, so its result comes at once (no replay of it here)
  }
  return `<div class="g-arc"><div class="brkw${lv ? ' run' : ''}"><div class="rprogs">${row('X')}${row('O')}</div>${scene}<p class="atwords brkwords">${words}</p></div>${btn}</div>`;
}
// What a go came to, in words (text) and whether it gained anything (ok).
function brkResultText(s, total, who) {
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const gain = s.to - s.from, left = total - s.to;   // (one short line: the words' room is two lines at most with a long name)
  if (s.to >= total) return { text: `${who} cleared the wall!`, ok: true };
  return { text: gain > 0 ? `${who} broke ${gain} brick${gain === 1 ? '' : 's'} · ${left} left` : `${who} broke none · ${left} left`, ok: gain > 0 };
}
export function moveText(f, who) {
  const b = f.brk;
  if (!b || b.auto) return `${who} ran out of time`;
  const g = b.to - b.from;
  return b.to >= b.total ? `${who} cleared the wall` : g > 0 ? `${who} broke ${g} brick${g === 1 ? '' : 's'} · ${b.total - b.to} left` : `${who} broke none · ${b.total - b.to} left`;
}
// The sounds of a go, for moveSounds: someone else's as it replays (from its inputs, at the replay's speed: the serve,
// the bounces, each brick, its end), then the result for them: a ding for a gain, a thud for none. This phone's own go
// sounded as it was played (brkTick, brkEnd): nothing more here.
export function sounds(f, add, won, mini, last) {
  const b = f.brk;
  if (!b || isOwn(f, f.square)) return;
  const pre = brkPre(f, f.square), rep = pre ? brkReplayOf(f) : null;
  if (rep) {
    const at = t => Math.round((t * 1000) / rep.speed), sim = brkStart(rep.mini0, rep.p), v = { broke: {} };
    let k = 0, n = 0;
    add('go', 0);
    while (sim.n < rep.steps && !sim.end) {
      let tx = null;
      if (k < rep.log.length && rep.log[k][0] === sim.n) tx = rep.log[k++][1] / BRK.q;
      brkTick(v, sim, tx, false);
      if (n > 220 || !sim.last) continue;
      const s = sim.last === 'brick' ? 'brkBrick' : sim.last === 'pad' ? 'brkPaddle' : sim.last === 'serve' ? 'pop' : 'brkWall';
      add(s, at(sim.t)); n++;
    }
    add(rep.end === 'clear' ? 'sparkle' : 'thud', rep.ms);
  }
  add(b.auto ? 'thud' : b.to > b.from ? 'ding' : 'thud', pre + 250);
}
// The miniature: each player's wall (the bricks they still have to break solid, the broken ones faint), their paddle and
// ball under it, in their colour, side by side.
const MINI_W = 42, MINI_H = 26;
export function miniature(mini, final) {
  const total = brkTotal(mini), t = tune(mini), fits = t.rows * t.cols === total, rows = fits ? t.rows : Math.max(1, Math.round(Math.sqrt(total * 5 / 7))), cols = fits ? t.cols : Math.ceil(total / rows);
  const label = `X: ${brkBroken(mini, 'X')} of ${total} bricks broken, O: ${brkBroken(mini, 'O')} of ${total}`;
  const half = (p, x0) => {
    const w = mini.wall[p], bw = MINI_W / cols, bh = MINI_H / rows;
    let up = '', down = '';
    for (let k = 0; k < total; k++) { const i = Math.floor(k / cols), j = k % cols, d = `M${(x0 + j * bw + 0.5).toFixed(1)} ${(4 + i * bh + 0.4).toFixed(1)}h${(bw - 1).toFixed(1)}v${(bh - 0.8).toFixed(1)}h-${(bw - 1).toFixed(1)}z`; if (w[k]) up += d; else down += d; }
    return `${down ? `<path class="tbrkg" d="${down}"/>` : ''}${up ? `<path class="tbrkb" d="${up}"/>` : ''}<rect class="tbrkp ${p}" x="${(x0 + MINI_W / 2 - 7).toFixed(1)}" y="52" width="14" height="4" rx="2"/><circle class="tbrko" cx="${(x0 + MINI_W / 2).toFixed(1)}" cy="49" r="2.4"/><g class="tbrkl ${p}" transform="translate(${(x0 + 4.5).toFixed(1)} 56.5)">${markSvgG(p, 2.8)}</g>`;   // (the player's mark drawn: a letter would be too small to read)
  };
  return `<div class="tbrk" aria-label="${label}"><svg viewBox="0 0 100 62" aria-hidden="true"><rect class="tbrkf" x="0" y="0" width="47" height="62" rx="3"/><rect class="tbrkf" x="53" y="0" width="47" height="62" rx="3"/>${half('X', 2.5)}${half('O', 55.5)}</svg></div>`;
}
export const actions = { 'brk-start': () => { ownPress(); brkGo(); } };
export const replay = { synth: () => [[0, 'brk-start']] };   // the computer's go: its Start pressed, then the go itself (the move carries its inputs)

// ---- the inputs: from pointerdown, anywhere on the mini-game screen but its header (registered as the view loads) ----
function brkUp(e) { const fd = draft; if (fd && fd.ptr && fd.ptr.id === e.pointerId) fd.ptr = null; }
if (app && typeof app.addEventListener === 'function') {
  app.addEventListener('pointerdown', e => {
    const fd = draft;
    if (!fd || fd.phase !== 'play' || !runInputAt(e.target)) return;
    e.preventDefault(); ownPress();
    const scene = app.querySelector('[data-brk="scene"]');
    try { (e.target.closest('main.scr.mini') || scene).setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    fd.ptr = { id: e.pointerId, x: e.clientX };
  });
  app.addEventListener('pointermove', e => {
    const fd = draft;
    if (!fd || fd.phase !== 'play' || !fd.ptr || fd.ptr.id !== e.pointerId) return;
    const dx = e.clientX - fd.ptr.x;
    fd.ptr.x = e.clientX;
    fd.tx = brkClampX(fd.tx + dx / Math.max(1, fd.kpx), fd.sim.half);   // one to one with the field
  });
  app.addEventListener('pointerup', brkUp);
  app.addEventListener('pointercancel', brkUp);
  ['touchstart', 'touchmove', 'touchend'].forEach(ev => app.addEventListener(ev, e => { if (draft && runInputAt(e.target) && e.cancelable) e.preventDefault(); }, { passive: false }));   // while a go is on, touches do nothing else
  app.addEventListener('contextmenu', e => { if (e.target && e.target.closest && e.target.closest('.brkscene, main.scr.mini:has(.brkw)')) e.preventDefault(); });
}
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', e => {                      // a keyboard: the arrows slide the paddle
    const fd = draft;
    if (!fd || fd.phase !== 'play') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); fd.dir = e.key === 'ArrowLeft' ? -1 : 1; }
  });
  document.addEventListener('keyup', e => { const fd = draft; if (fd && ((e.key === 'ArrowLeft' && fd.dir < 0) || (e.key === 'ArrowRight' && fd.dir > 0))) fd.dir = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && draft && draft.phase === 'play') brkFinish(); });   // the page hidden mid-go: it ends there, its bricks kept
}
