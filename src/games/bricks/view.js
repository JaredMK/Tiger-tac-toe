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
import { hash01 } from '../../ui/art.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG } from '../../ui/thumbs.js';
import { drawTimeBar, outlined, rr, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { banner, impact, jolt, starPath } from '../../ui/runfx.js';
import { cpuTurn, skipFlash } from '../../ui/turns.js';

const BRK_EARLY = 700;                                           // online: a go ends this long before the turn's time is up, so it goes in before the timeout
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
  draft = { sq: i, p, try: trysOf(sq0, p), mini, sim: brkStart(mini, p), rec: brkRecorder(), phase: 'play', at: now, last: now, acc: 0, raf: 0, ptr: null, dir: 0, kpx: 30, tx: BRK.w / 2, broke: {}, fx: [], trail: [], voice: brkVoice(), end: null, endAt: 0 };
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
    while (fd.acc >= BRK.step - 1e-9 && !fd.sim.end) { fd.acc -= BRK.step; brkTick(fd, fd.sim, fd.rec.at(fd.sim.n, fd.tx), fd.voice); }
    if (fd.sim.end) brkEnd(fd, fd.sim.end, now);
    brkHud(fd);
  } else if (now - fd.endAt >= (BRK.end[fd.end] || 500)) { brkFinish(); return; }
  const cv = app.querySelector('canvas[data-brk="cv"]');
  if (cv) brkDraw(cv, brkDraftView(fd, now), now);
  fd.raf = requestAnimationFrame(brkFrame);
}
// What a go sounds like, a step at a time (this phone's own as it is played, someone else's from its inputs: sounds):
// a fresh voice for a go; given the sim after a step, [sound, rate] or null. The bricks of one flight (from the paddle
// until the ball is back on it) crack higher and higher, so a run through the wall climbs like a scale.
export function brkVoice() {
  let run = 0;
  return sim => {
    const l = sim.last;
    if (l === 'brick') return ['brkBrick', run++ ? Math.min(1.6, 1 + 0.075 * (run - 1)) : undefined];
    if (l === 'pad') { run = 0; return ['brkPaddle', undefined]; }
    return l === 'serve' ? ['pop', undefined] : l === 'wall' || l === 'top' ? ['brkWall', undefined] : null;
  };
}
// One step (the phone's own, or a replay's), noting what it did for the drawing (the bricks just broken, the bounces,
// the ball's last places) and, with a voice (this phone's own go), sounding it and buzzing: a tap a brick, a tap as
// the paddle takes the ball.
function brkTick(v, sim, tx, voice) {
  brkStep(sim, tx);
  const l = sim.last;
  if (sim.flying && sim.n % 2 === 0) { const tr = v.trail || (v.trail = []); tr.push(sim.x, sim.y); if (tr.length > BRKV.trail * 2) tr.splice(0, 2); }
  if (!l) return;
  if (l === 'brick') v.broke[sim.hit] = sim.t; else if (l === 'pad') v.padAt = sim.t;
  const fx = v.fx || (v.fx = []);
  fx.push({ k: l, t: sim.t, x: l === 'wall' ? (sim.x < BRK.w / 2 ? 0 : BRK.w) : sim.x, y: l === 'top' ? BRK.h : l === 'pad' || l === 'serve' ? BRK.padY : sim.y });
  if (fx.length > 10) fx.shift();
  const s = voice ? voice(sim) : null;
  if (s) SND.play(s[0], { rate: s[1] });
  if (voice && (l === 'brick' || l === 'pad')) haptic('tap');
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
  if (fd.sim.n === 0) brkTick(fd, fd.sim, fd.rec.at(0, fd.tx), null);   // (at least one step: a go of none is no go)
  const m = brkMove(fd);
  live = { sq: fd.sq, p: fd.p, try: fd.try, view: brkDraftView(fd, performance.now()), at: performance.now() };
  const sq = state.squares && state.squares[fd.sq];
  if (state.screen === 'mini' && state.zoom === fd.sq && sq && !sq.owner && state.turn === fd.p && !state.flash && !state.done && !blocked()) attemptMove(m);   // (else the turn moved on without it: nothing to send)
  render();
}
// The count over the field: set as the go plays (here, or a replay's), with a small pop each time it rises (from the
// brick that raised it: the text is only ever changed by a step of the go).
function brkCount(n) {
  const hud = app.querySelector('[data-brk="hud"]'), txt = `+${n}`;
  if (!hud || hud.textContent === txt) return;
  hud.textContent = txt;
  if (!REDUCED && typeof hud.animate === 'function') hud.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 190, easing: 'cubic-bezier(.4,0,.2,1)' });
}
function brkHud(fd) {
  brkCount(fd.sim.broke.length);
  const row = app.querySelector(`.brkp.${fd.p}`), total = brkTotal(fd.mini), at = brkBroken(fd.mini, fd.p) + fd.sim.broke.length;
  if (!row) return;
  const bi = row.querySelector('.rbar i'), w = (100 * Math.min(1, at / total)).toFixed(2) + '%';
  if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); }
  const sm = row.querySelector('small');
  if (sm) sm.textContent = brkSay(at, total);
}
const brkSay = (at, total) => `${fmt(at)} / ${fmt(total)}`;

// ---- what the field shows: the go under way, a replay, the last moment, or the clean start ----
const brkDraftView = (fd, now) => ({ p: fd.p, sim: fd.sim, broke: fd.broke, fx: fd.fx, trail: fd.trail, padAt: fd.padAt, end: fd.end, endAt: fd.endAt, tx: fd.tx });
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
  if (!rep.sim || rep.sim.n > T / BRK.step + 1) { rep.sim = brkStart(rep.mini0, rep.p); rep.k = 0; rep.broke = {}; rep.fx = []; rep.trail = []; rep.padAt = null; rep.tx = rep.sim.px; rep.endAt = null; }
  const sim = rep.sim, want = Math.min(rep.steps, Math.floor(T / BRK.step + 1e-6));
  while (sim.n < want && !sim.end) {
    let tx = null;
    if (rep.k < rep.log.length && rep.log[rep.k][0] === sim.n) { tx = rep.log[rep.k++][1] / BRK.q; rep.tx = tx; }
    brkTick(rep, sim, tx, null);
  }
  if (sim.n >= rep.steps && !sim.end) sim.end = rep.end;         // (the go ran out of time: as sent)
  if (sim.end && rep.endAt == null) rep.endAt = now;
  return { p: rep.p, sim, broke: rep.broke, fx: rep.fx, trail: rep.trail, padAt: rep.padAt, end: sim.end, endAt: rep.endAt, tx: rep.tx };
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
      brkCount(v.sim.broke.length);
      return e < pre + 1200;
    }
  }
  const lv = live && live.sq === state.zoom && live.view ? live : null;   // this phone's go just made: its last moment, while it goes in and its result shows
  if (lv && (f ? f.brk.by === lv.p : trysOf(sq, lv.p) === lv.try && now - lv.at < 15000)) { brkDraw(cv, lv.view, now); return now - lv.at < 1500; }
  brkDraw(cv, brkStill(sq.mini, sq.owner || (f ? f.by : state.turn)), now);
  return false;
}

// ---- the drawing: the field between its rails, the player's own wall in their colour, the paddle and the ball ----
// Everything is a plain function of the go as it stands, the view's notes of it (brkTick: the bricks just broken, the
// bounces, the ball's last places) and the go's own clock (te: its seconds, running on through its end), so a replay
// draws the very frames the player saw. The still parts (the stone either side, the field, its rails, the pit under the
// paddle) are painted once into a layer (brkBackdrop); the wall, the paddle, the ball and their effects go over it.
export const BRKV = { shard: 0.45, flash: 0.08, ring: 0.22, spark: 0.24, go: 0.7, trail: 8, padH: 0.42 };   // seconds: a broken brick's pieces, its flash, a bounce's ring, the paddle's sparks, the GO! before the serve; trail: the ball's places kept; padH: the paddle's body as drawn (its top is the rules' line)
const cl01 = u => Math.max(0, Math.min(1, u)), ease = u => 1 - (1 - cl01(u)) ** 3;
const rgbOf = h => {                                             // a colour's parts, from '#rgb', '#rrggbb' or 'rgb(r, g, b)'
  const t = String(h).trim(), m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(t), q = m ? null : /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(t);
  if (q) return [+q[1], +q[2], +q[3]];
  if (!m) return null;
  const n = parseInt(m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return A && B ? `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})` : a; };
const shades = new Map();
// A wall's colours, a row at a time: the player's own colour, deep at the top and paler row by row ([body, lip]).
function brkShades(col, rows, P) {
  const key = `${col}|${rows}`;
  if (!shades.has(key)) shades.set(key, Array.from({ length: rows }, (_, i) => { const t = rows > 1 ? i / (rows - 1) : 0, body = t < 0.25 ? mix(col, P.ink, 0.14 * (1 - t / 0.25)) : mix(col, '#ffffff', 0.4 * ((t - 0.25) / 0.75)); return [body, mix(body, P.ink, 0.22)]; }));
  return shades.get(key);
}
let back = null;                                                 // the still layer: { key, cv }
function brkBackdrop(W, H, dpr, k, ox, oy, P) {
  const key = `${W}|${H}|${dpr}`;
  if (back && back.key === key) return back.cv;
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  const c = cv.getContext('2d'), fw = BRK.w * k, fh = BRK.h * k;
  c.scale(dpr, dpr);
  c.fillStyle = '#141a2e'; c.fillRect(0, 0, W, H);
  const sw = Math.max(18, k * 1.3), sh = sw * 0.5;                  // the stone either side of the field (and above and below it on a tall phone): courses of blocks, half a block off, row by row
  for (let row = 0, y = -2; y < H; row++, y += sh) for (let x = (row % 2 ? -sw / 2 : 0) - 2; x < W; x += sw) {
    if (x + sw > ox - 1 && x < ox + fw + 1 && y + sh > oy - 1 && y < oy + fh + 1 && x >= ox && x + sw <= ox + fw && y >= oy && y + sh <= oy + fh) continue;   // (wholly under the field)
    c.fillStyle = (row * 7 + Math.round(x / sw) * 3) % 5 === 0 ? '#232c4b' : '#1d2541'; rr(c, x + 1, y + 1, sw - 2, sh - 2, 2.5); c.fill();
  }
  const fld = c.createLinearGradient(0, oy, 0, oy + fh); fld.addColorStop(0, '#2d3c6e'); fld.addColorStop(1, '#1b2446');
  c.fillStyle = fld; c.fillRect(ox, oy, fw, fh);
  c.fillStyle = 'rgba(255,255,255,.08)';                           // a dot at every unit: the field's floor
  for (let gx = 1; gx < BRK.w; gx++) for (let gy = 1; gy < BRK.h; gy++) { c.beginPath(); c.arc(ox + gx * k, oy + gy * k, Math.max(0.9, k * 0.045), 0, Math.PI * 2); c.fill(); }
  c.save(); c.beginPath(); c.rect(ox, oy + fh - 0.55 * k, fw, 0.55 * k); c.clip();   // the pit under the paddle: where a ball is lost
  c.fillStyle = 'rgba(8,10,22,.5)'; c.fillRect(ox, oy + fh - 0.55 * k, fw, 0.55 * k);
  c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = Math.max(2, k * 0.12);
  for (let x = ox - k; x < ox + fw + k; x += k * 0.5) { c.beginPath(); c.moveTo(x, oy + fh + 2); c.lineTo(x + 0.6 * k, oy + fh - 0.6 * k); c.stroke(); }
  c.restore();
  for (const [x0, x1] of [[ox, ox + 0.5 * k], [ox + fw, ox + fw - 0.5 * k]]) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(6,8,20,.4)'); g.addColorStop(1, 'rgba(6,8,20,0)'); c.fillStyle = g; c.fillRect(Math.min(x0, x1), oy, 0.5 * k, fh); }   // the rails' shade on the field
  const top = c.createLinearGradient(0, oy, 0, oy + 0.6 * k); top.addColorStop(0, 'rgba(6,8,20,.45)'); top.addColorStop(1, 'rgba(6,8,20,0)'); c.fillStyle = top; c.fillRect(ox, oy, fw, 0.6 * k);
  const rail = Math.max(0, Math.min(7, ox - 1)), railT = Math.max(0, Math.min(7, oy - 1)), lip = Math.max(2.5, k * 0.1);   // the rails: outside the field where there is room, a pale lip just inside it
  c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(ox, oy, lip, fh); c.fillRect(ox + fw - lip, oy, lip, fh); c.fillRect(ox, oy, fw, lip);
  if (rail >= 2) for (const x of [ox - rail, ox + fw]) { c.fillStyle = '#8f9bc4'; c.fillRect(x, oy - railT, rail, fh + railT); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, oy - railT, Math.max(1, rail * 0.3), fh + railT); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(x, oy - railT - 2, rail, fh + railT + 4); }
  if (railT >= 2) { c.fillStyle = '#8f9bc4'; c.fillRect(ox - rail, oy - railT, fw + 2 * rail, railT); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(ox - rail, oy - railT, fw + 2 * rail, Math.max(1, railT * 0.3)); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(ox - rail, oy - railT, fw + 2 * rail, railT); }
  back = { key, cv };
  return cv;
}
export function brkDraw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, k = Math.min(W / BRK.w, H / BRK.h), ox = (W - BRK.w * k) / 2, oy = (H - BRK.h * k) / 2;
  const X = x => ox + x * k, Y = y => oy + (BRK.h - y) * k, col = v.p === 'O' ? P.O : P.X;
  if (draft && v.sim === draft.sim) draft.kpx = k;
  const te = sim.t + (v.endAt ? Math.max(0, now - v.endAt) / 1000 : 0), rd = v.endAt ? { at: v.endAt } : null, lw = Math.max(1.5, Math.min(2.4, k * 0.085));
  c.save();
  if (v.end === 'miss') jolt(c, W, H, { crash: true }, rd, now);     // the ball lost: the field kicks (ui/runfx.js); the time bar over it stays still
  c.fillStyle = '#141a2e'; c.fillRect(-6, -6, W + 12, H + 12);       // (under the layer: the kick never shows a bare rim)
  c.drawImage(brkBackdrop(W, H, c.canvas.width / W, k, ox, oy, P), 0, 0, W, H);
  const bw = sim.bw * k, bh = BRK.bh * k, gap = Math.max(1.5, k * 0.06), sh = brkShades(col, sim.rows, P), w = bw - 2 * gap, h = bh - 2 * gap, rad = Math.min(5, h * 0.3), fresh = [];
  const rbox = (x, y, ww, hh, r0) => { c.moveTo(x + r0, y); c.arcTo(x + ww, y, x + ww, y + hh, r0); c.arcTo(x + ww, y + hh, x, y + hh, r0); c.arcTo(x, y + hh, x, y, r0); c.arcTo(x, y, x + ww, y, r0); c.closePath(); };
  const at = (i, j) => [X(j * sim.bw) + gap, Y(BRK.top - i * BRK.bh) + gap];
  c.beginPath();                                                    // the wall, a layer at a time (a path a row: a phone draws 35 bricks in a dozen strokes): every standing brick's shadow on the field
  for (let idx = 0; idx < sim.wall.length; idx++) if (sim.wall[idx]) { const [x, y] = at(Math.floor(idx / sim.cols), idx % sim.cols); rbox(x + k * 0.07, y + k * 0.13, w, h, rad); }
  c.fillStyle = 'rgba(6,8,20,.38)'; c.fill();
  c.beginPath();                                                    // the broken ones: a faint outline where each stood
  for (let idx = 0; idx < sim.wall.length; idx++) if (!sim.wall[idx]) {
    const i = Math.floor(idx / sim.cols), [x, y] = at(i, idx % sim.cols), t0 = v.broke[idx];
    rbox(x, y, w, h, 3);
    if (t0 != null && te - t0 < BRKV.shard) fresh.push([x + w / 2, y + h / 2, w, h, (te - t0) / BRKV.shard, sh[i], idx]);
  }
  c.save(); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = 1; c.stroke(); c.restore();
  for (let i = 0; i < sim.rows; i++) {                              // then row by row in its shade: the bodies, their darker lips, the light along their tops, the ink round them
    const xs = [];
    for (let j = 0; j < sim.cols; j++) if (sim.wall[i * sim.cols + j]) xs.push(at(i, j));
    if (!xs.length) continue;
    c.beginPath(); for (const [x, y] of xs) rbox(x, y, w, h, rad); c.fillStyle = sh[i][0]; c.fill();
    c.fillStyle = sh[i][1]; for (const [x, y] of xs) c.fillRect(x + lw * 0.5, y + h * 0.64, w - lw, h * 0.36 - lw * 0.5);
    c.fillStyle = 'rgba(255,255,255,.42)'; for (const [x, y] of xs) c.fillRect(x + lw + 1.5, y + lw + 0.5, Math.max(0, w - 2 * lw - 3), Math.max(1.2, h * 0.17));
    c.beginPath(); for (const [x, y] of xs) rbox(x, y, w, h, rad); c.lineWidth = lw; c.strokeStyle = P.ink; c.stroke();
  }
  for (const f of fresh) brkShards(c, f[0], f[1], f[2], f[3], f[4], f[5], f[6], P, lw);   // the bricks just broken, over the wall
  const r = BRK.r * k;
  for (const e of v.fx || []) {                                     // the bounces of the last moment: a ring where the ball touched, sparks off the paddle
    const u = (te - e.t) / (e.k === 'pad' ? BRKV.spark : BRKV.ring);
    if (u < 0 || u >= 1) continue;
    const ex = X(e.x), ey = Y(e.y);
    if (e.k === 'pad' && !REDUCED) {
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42, d0 = r * (1 + 2.6 * ease(u)), d1 = d0 + r * 1.3 * (1 - u); c.strokeStyle = i % 2 ? col : P.paper; c.globalAlpha = 1 - u; c.lineWidth = Math.max(1.5, r * 0.36); c.lineCap = 'round'; c.beginPath(); c.moveTo(ex + Math.cos(a) * d0, ey + r + Math.sin(a) * d0); c.lineTo(ex + Math.cos(a) * d1, ey + r + Math.sin(a) * d1); c.stroke(); }
      c.globalAlpha = 1;
    } else if (e.k !== 'pad') { c.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - u)).toFixed(2)})`; c.lineWidth = Math.max(1.2, r * 0.3); c.beginPath(); c.arc(ex, ey, r * (1.1 + 2 * ease(u)), 0, Math.PI * 2); c.stroke(); }
  }
  const ph = BRKV.padH * k, pw = sim.half * 2 * k, px = X(sim.px), py = Y(BRK.padY), squash = v.padAt != null && te - v.padAt < 0.14 ? 1 - 0.3 * (1 - (te - v.padAt) / 0.14) : 1;   // the paddle, dipping a little as it takes the ball
  c.fillStyle = 'rgba(6,8,20,.36)'; rr(c, px - pw / 2 + k * 0.08, py + k * 0.16, pw, ph, ph / 2); c.fill();
  c.save(); c.translate(px, py + ph * (1 - squash)); c.scale(1, squash);
  rr(c, -pw / 2, 0, pw, ph, ph / 2); c.fillStyle = col; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(22,18,16,.24)'; c.fillRect(-pw / 2, ph * 0.62, pw, ph * 0.38);                              // its underside
  c.fillStyle = P.paper; c.fillRect(-pw / 2 + ph * 0.75, 0, Math.max(1.5, ph * 0.3), ph); c.fillRect(pw / 2 - ph * 0.75 - Math.max(1.5, ph * 0.3), 0, Math.max(1.5, ph * 0.3), ph);   // a paper band near either end
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.45)'; rr(c, -pw / 2 + ph * 1.35, ph * 0.2, Math.max(0, pw - ph * 2.7), Math.max(1.2, ph * 0.2), 1); c.fill();
  rr(c, -pw / 2, 0, pw, ph, ph / 2); c.lineWidth = Math.max(lw, 2); c.strokeStyle = P.ink; c.stroke();
  c.restore();
  const drop = v.end === 'miss' && v.endAt ? Math.max(0, now - v.endAt) / 1000 : 0, bx = X(sim.x + sim.vx * drop), by = Y(sim.y + sim.vy * drop);   // (a lost ball falls on out of the field)
  const tr = v.trail || [];
  if (sim.flying && !v.still && !v.end && tr.length > 2) for (let i = 0; i < tr.length - 2; i += 2) { const q = (i / 2 + 1) / (tr.length / 2); c.fillStyle = `rgba(255,248,232,${(0.05 + 0.24 * q).toFixed(2)})`; c.beginPath(); c.arc(X(tr[i]), Y(tr[i + 1]), r * (0.4 + 0.55 * q), 0, Math.PI * 2); c.fill(); }   // where it has just been: a fading tail
  if (by - r < H + 4) {
    c.fillStyle = 'rgba(6,8,20,.34)'; c.beginPath(); c.ellipse(bx + k * 0.1, by + k * 0.16, r, r * 0.85, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,248,232,.16)'; c.beginPath(); c.arc(bx, by, r * 1.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); outlined(c, P.paper, P.ink, Math.max(1.4, Math.min(2.2, r * 0.34)));
    c.fillStyle = 'rgba(22,18,16,.16)'; c.beginPath(); c.arc(bx + r * 0.24, by + r * 0.26, r * 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(bx - r * 0.3, by - r * 0.32, r * 0.24, 0, Math.PI * 2); c.fill();
  }
  if (v.end === 'miss' && v.endAt) impact(c, X(Math.max(0.5, Math.min(BRK.w - 0.5, sim.x))), Y(0.2), k * 0.95, rd, now, P, '#aab6de');   // the ball gone into the pit
  if (v.end === 'clear' && v.endAt && !REDUCED) {                   // the wall cleared: stars fly out from where it stood
    const u = Math.min(1, (now - v.endAt) / BRK.end.clear), cx = X(BRK.w / 2), cy = Y(BRK.top - (sim.rows * BRK.bh) / 2);
    c.globalAlpha = 1 - u * u * u;
    for (let s = 0; s < 16; s++) { const a = (s / 16) * Math.PI * 2 + 0.2, d = k * (0.8 + (3.4 + 1.6 * (s % 3)) * ease(u)); starPath(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6 + u * u * k * 1.5, k * (0.26 + 0.12 * (s % 2)), 5, a + u * 3); outlined(c, s % 2 ? P.paper : col, P.ink, 1.6); }
    c.globalAlpha = 1;
  }
  if (v.end === 'out' && v.endAt) { c.fillStyle = 'rgba(20,26,46,.4)'; c.fillRect(ox, oy, BRK.w * k, BRK.h * k); }   // the time up: the field dims
  c.restore();
  if (v.still) return;
  if (te < BRKV.go && !v.end) banner(c, W, H, 'GO!', { at: now - te * 1000 }, now, P, 0.52, (te - (BRKV.go - 0.22)) / 0.22);   // the go begins: the word pops under the wall and is gone as the ball is served
  if (v.end === 'clear' && v.endAt) banner(c, W, H, 'CLEAR!', rd, now, P, 0.52);
  else if (v.end === 'out' && v.endAt) banner(c, W, H, 'TIME!', rd, now, P, 0.52);
  // the attempt's time limit: a bar along the top, clear of the score at the top left (ui/runner.js drawTimeBar), while the attempt runs or replays
  const x0 = Math.round(W * 0.36); c.save(); c.translate(x0, 0); drawTimeBar(c, W - x0, H, 1 - sim.t / sim.cfg.runSecs, P); c.restore();
}
function brkShards(c, cx, cy, w, h, u, sh, idx, P, lw) {            // a brick just broken: a white flash where it stood, six pieces flying apart, turning and falling, a little dust
  if (u < BRKV.flash / BRKV.shard) { const f = u / (BRKV.flash / BRKV.shard); c.fillStyle = `rgba(255,255,255,${(1 - f * f).toFixed(2)})`; rr(c, cx - (w / 2) * (1 + 0.16 * f), cy - (h / 2) * (1 + 0.3 * f), w * (1 + 0.16 * f), h * (1 + 0.3 * f), 3); c.fill(); }
  if (REDUCED) return;
  const q = ease(u);
  c.save(); c.globalAlpha = 1 - u * u;
  for (let i = 0; i < 6; i++) {
    const sx = (i % 3) - 1, sy = i < 3 ? -1 : 1, hx = hash01(idx * 9 + i), hy = hash01(idx * 5 + i + 20);
    c.save(); c.translate(cx + sx * w * 0.3 + sx * q * w * (0.35 + 0.4 * hx) + (hx - 0.5) * q * w * 0.5, cy + sy * h * 0.22 + sy * q * h * (0.7 + 0.8 * hy) + u * u * h * 3.2); c.rotate((sx || (i < 3 ? 0.6 : -0.6)) * sy * u * (1.4 + 2 * hy));
    rr(c, -w * 0.15, -h * 0.2, w * 0.3, h * 0.4, 1.5); c.fillStyle = i % 2 ? sh[0] : sh[1]; c.fill(); c.lineWidth = Math.max(1, lw * 0.7); c.strokeStyle = P.ink; c.stroke();
    c.restore();
  }
  c.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) { const a = hash01(idx * 3 + i + 40) * Math.PI * 2, d = q * w * (0.5 + 0.5 * hash01(idx + i + 60)); c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, Math.max(1, h * 0.12 * (1 - u)), 0, Math.PI * 2); c.fill(); }
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
    const at = t => Math.round((t * 1000) / rep.speed), sim = brkStart(rep.mini0, rep.p), voice = brkVoice();
    let k = 0, n = 0;
    add('go', 0);
    while (sim.n < rep.steps && !sim.end) {
      let tx = null;
      if (k < rep.log.length && rep.log[k][0] === sim.n) tx = rep.log[k++][1] / BRK.q;
      brkStep(sim, tx);
      const s = sim.last ? voice(sim) : null;
      if (!s || n > 220) continue;
      add(s[0], at(sim.t), s[1]); n++;
    }
    add(rep.end === 'clear' ? 'sparkle' : 'thud', rep.ms);
  }
  add(b.auto ? 'thud' : b.to > b.from ? 'ding' : 'thud', pre + 250);
}
// The miniature: each player's wall in their own colour (the bricks they still have to break solid, the broken ones
// faint), their paddle and ball under it, side by side, each field under its player's drawn mark.
const MINI_W = 42, MINI_H = 26;
export function miniature(mini, final) {
  const total = brkTotal(mini), t = tune(mini), fits = t.rows * t.cols === total, rows = fits ? t.rows : Math.max(1, Math.round(Math.sqrt(total * 5 / 7))), cols = fits ? t.cols : Math.ceil(total / rows);
  const label = `X: ${brkBroken(mini, 'X')} of ${total} bricks broken, O: ${brkBroken(mini, 'O')} of ${total}`;
  const half = (p, x0) => {
    const w = mini.wall[p], bw = MINI_W / cols, bh = MINI_H / rows;
    let up = '', down = '';
    for (let k = 0; k < total; k++) { const i = Math.floor(k / cols), j = k % cols, d = `M${(x0 + j * bw + 0.5).toFixed(1)} ${(4 + i * bh + 0.4).toFixed(1)}h${(bw - 1).toFixed(1)}v${(bh - 0.8).toFixed(1)}h-${(bw - 1).toFixed(1)}z`; if (w[k]) up += d; else down += d; }
    return `<g class="tbrkw ${p}">${down ? `<path class="tbrkg" d="${down}"/>` : ''}${up ? `<path class="tbrkb" d="${up}"/>` : ''}<path class="tbrkt" d="M${(x0 + MINI_W / 2 + 1.2).toFixed(1)} 46.5l2.5-6"/><rect class="tbrkp ${p}" x="${(x0 + MINI_W / 2 - 8).toFixed(1)}" y="52" width="16" height="4.5" rx="2.2"/><circle class="tbrko" cx="${(x0 + MINI_W / 2).toFixed(1)}" cy="49" r="2.6"/><g class="tbrkl ${p}" transform="translate(${(x0 + 5).toFixed(1)} 55.5)">${markSvgG(p, 3.2)}</g></g>`;   // (the player's mark drawn: a letter would be too small to read)
  };
  return `<div class="tbrk" aria-label="${label}"><svg viewBox="0 0 100 62" aria-hidden="true"><rect class="tbrkf" x="0" y="0" width="47" height="62" rx="3"/><rect class="tbrkf" x="53" y="0" width="47" height="62" rx="3"/>${half('X', 2.5)}${half('O', 55.5)}</svg></div>`;
}
export const actions = { 'brk-start': () => { ownPress(); brkGo(); } };
export const replay = { synth: () => [[0, 'brk-start']] };   // the computer's go: its Start pressed, then the go itself (the move carries its inputs)

// ---- the inputs: from pointerdown, anywhere on the mini-game screen but its header (registered as the view loads) ----
function brkUp(e) { const fd = draft; if (fd && fd.ptr && fd.ptr.id === e.pointerId) fd.ptr = null; }
if (app && typeof app.addEventListener === 'function') {
  app.addEventListener('pointerdown', e => {
    if (e.target && e.target.closest && e.target.closest('[data-act="brk-start"]')) ownPress();   // (Start is the game's own press: its 'go', never the interface's click, which sounds at the press's end)
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
