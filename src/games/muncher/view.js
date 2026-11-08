// Muncher: the screen, the miniature, the move's words and sounds, and the inputs.
import { DIRS, MUN, MUN_VIEW, munAte, munInput, munLayout, munMove, munMs, munPos, munRawMs, munScore, munStart, munStep, munTarget, munUnlog } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, moveWait, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state } from '../../ui/app.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { outlined, rr, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { cpuTurn } from '../../ui/turns.js';

// ---------- Muncher ----------
// A square opens on the maze with the player's dots as they stand (the ones they have eaten are gone), the muncher at
// its start and the spooks at theirs, with Start below. Start begins one run: a swipe anywhere on the screen (an arrow
// key, or a tap on one side of the muncher) turns it, and it runs on until a wall. The run ends on a spook, when its
// time is up (the bar along the bottom), when the target is reached or the maze is empty; its end shows a moment,
// then it goes in as its inputs (rules.js: the server plays them through again). Someone else's run (the computer's,
// the other phone's) plays here first, from its inputs, then the result. The muncher is a round-shouldered blob in
// the player's colour with a wide mouth that chomps as it goes; the spooks are jelly drops, lavender and mint, each
// with one big eye on where it is going.
const MUN_END = 700;                                               // the end of a run (a spook, the time, the target) shows this long before it goes in
const MUN_EARLY = 700;                                             // online: a run ends this long before the turn's time is up, so it goes in before the timeout
const SWIPE = 14;                                                  // px a finger moves to turn the muncher (then again from there: no need to lift)
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
const SPOOK = ['#b9a7ff', '#8fe0c8'];
export let munDraft = null;                                        // the run under way on this phone
let munLive = null;                                                // the run just made here: its last moment stays on the maze while its result shows
let munRaf = 0, loopRaf = 0, paintRaf = 0, wired = false, lastStill = null;
const munId = (sq, p) => { const m = state.squares[sq].mini; return `${state.online ? state.online.matchId || state.online.game || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:${m.seed}:${m.tries ? m.tries[p] : 0}`; };
const fmtN = n => Math.floor(n + 1e-9).toLocaleString('en-US');
// Someone else's run plays first (the computer's, the other phone's); this phone's own shows its result alone.
export function munPre(f) { return f && f.type === 'muncher' && f.mun && !f.mun.auto && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? munMs(f.mun) : 0; }
MUN_VIEW.own = f => !munPre(f);                                    // (rules.js flashMs: the mover's own phone holds the result alone, never its own run again)
export const munPinned = () => !!(munDraft && state.screen === 'mini' && state.zoom === munDraft.sq && !state.flash);

// ---- Start: the run begins (and holds the player to the square, here: the Board button goes while it is on) ----
export function munGo() {
  const i = state.zoom, sq = state.squares && state.squares[i];
  if (!sq || sq.mini.type !== 'muncher' || sq.owner || munDraft || state.flash || state.done || state.winner || blocked()) return;
  const p = state.turn, now = performance.now();
  munDraft = { id: munId(i, p), sq: i, p, mini: sq.mini, sim: munStart(sq.mini, p), phase: 'play', at: now, last: now, acc: 0, want: -1, end: null, endAt: 0, ptr: null, geo: null };
  munLive = null;
  SND.play('go');
  render();
  munRaf = requestAnimationFrame(munFrame);
}
function munFrame(now) {
  const fd = munDraft;
  if (!fd) return;
  munRaf = 0;
  if (state.screen !== 'mini' || state.zoom !== fd.sq || state.winner || state.turn !== fd.p || state.flash) { munFinish(false); return; }   // (taken off the square somehow: the run is dropped)
  const dt = Math.min(0.1, Math.max(0, (now - fd.last) / 1000));
  fd.last = now;
  if (fd.phase === 'play') {
    const left = clockLeft();
    if (left != null && left <= (state.online ? MUN_EARLY : 0)) { munFinish(true); return; }   // the turn's time is up: the run ends here, its dots kept
    fd.acc += dt;
    const sim = fd.sim, STEP = 1 / MUN.hz;
    while (fd.acc >= STEP - 1e-9 && !sim.end) { fd.acc -= STEP; if (fd.want >= 0) munInput(sim, fd.want); munLoud(sim); }
    if (sim.end) { fd.phase = 'end'; fd.end = sim.end; fd.endAt = now; fd.ptr = null; }
    munHud(fd);
  } else if (now - fd.endAt >= MUN_END) { munFinish(true); return; }
  const cv = app.querySelector('canvas[data-mun="cv"]');
  if (cv) munDraw(cv, munDraftView(fd, now), now);
  munRaf = requestAnimationFrame(munFrame);
}
// One step of this phone's own run, with its sounds (and the buzz of being caught).
function munLoud(sim) {
  munStep(sim);
  if (sim.last === 'eat') SND.play('munChomp');
  if (sim.end === 'caught') { SND.play('crash'); haptic('error'); }
  else if (sim.end === 'win' || sim.end === 'clear') SND.play('sparkle');
}
// The run goes in (send): as it ended, or as it stands (the time ran out, the page went away); or is dropped.
export function munFinish(send) {
  const fd = munDraft;
  if (!fd) return;
  cancelAnimationFrame(munRaf); munRaf = 0; munDraft = null;
  if (!send || state.screen !== 'mini' || state.zoom !== fd.sq) { render(); return; }
  const sim = fd.sim;
  if (sim.n === 0) { if (fd.want >= 0) munInput(sim, fd.want); munStep(sim); }   // (at least one step: a run of none is no run)
  munLive = { sq: fd.sq, p: fd.p, id: fd.id, to: sim.score0 + sim.ate.length, view: munDraftView(fd, performance.now()), at: performance.now() };
  attemptMove(munMove(sim));
  render();
}
function munHud(fd) {
  const sim = fd.sim, val = sim.score0 + sim.ate.length, goal = sim.target;
  const hud = app.querySelector('[data-mun="hud"]');
  if (hud) hud.textContent = `${fmtN(val)} / ${fmtN(goal)}`;
  const row = app.querySelector(`.munprog.${fd.p}`);
  if (!row) return;
  const w = (100 * Math.min(1, val / goal)).toFixed(2) + '%', bi = row.querySelector('.rbar i');
  if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); }
  const sm = row.querySelector('small');
  if (sm) sm.textContent = munSay(val, goal);
}
const munSay = (v, goal) => `${fmtN(v)} / ${fmtN(goal)}`;
// A tap on one side of the muncher turns it that way (a desktop without arrows, a phone without a swipe).
function munTapDir(fd, x, y) {
  const cv = app.querySelector('canvas[data-mun="cv"]'), geo = fd.geo;
  if (!cv || !geo) return;
  const r = cv.getBoundingClientRect(), [px, py] = munPos(fd.sim.ch);
  const sx = r.left + geo.ox + (px / MUN.U + 0.5) * geo.k, sy = r.top + geo.oy + (py / MUN.U + 0.5) * geo.k, dx = x - sx, dy = y - sy;
  if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
  fd.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
}

// ---- what the maze shows: the run under way, a replay, the last moment, or the clean start ----
const munDraftView = (fd, now) => ({ type: 'muncher', p: fd.p, sim: fd.sim, end: fd.end, endAt: fd.endAt, want: fd.want, live: true });
const munStill = (mini, p) => ({ type: 'muncher', p, sim: munStart(mini, p), still: true });
// The square as it was before a run (its dots put back for the player who made it): the replay starts there.
function munBefore(mini, g) {
  const p = g.by, ran = new Set(g.ate || []), m = JSON.parse(JSON.stringify(mini));
  if (!m.ate) m.ate = { X: [], O: [] };
  m.ate[p] = munAte(mini, p).filter(c => !ran.has(c));
  if (!m.tries) m.tries = { X: 0, O: 0 };
  m.tries[p] = Number.isInteger(g.try) ? g.try : Math.max(0, (m.tries[p] || 1) - 1);
  return m;
}
// Someone else's run, ready to play from its inputs (stepped as the replay goes).
const munReps = new WeakMap();
function munReplayOf(f) {
  if (munReps.has(f)) return munReps.get(f);
  const sq = shownSq(f.square), g = f.mun;
  let rep = null;
  if (sq && g && !g.auto) {
    const mini0 = munBefore(sq.mini, g), raw = munRawMs(g), ms = munMs(g), speed = ms > 0 ? raw / ms : 1;
    rep = { p: g.by, mini0, log: munUnlog(g.log, g.steps) || [], steps: Number(g.steps) || 0, ms, speed, raw, sim: null, k: 0, endAt: null };
  }
  munReps.set(f, rep);
  return rep;
}
// A replay's view at T seconds into the run (the sim stepped on to there; rewound when a phone comes back to its start).
function munRepView(rep, T) {
  const want = Math.min(rep.steps, Math.floor(T * MUN.hz + 1e-6));
  if (!rep.sim || rep.sim.n > want) { rep.sim = munStart(rep.mini0, rep.p); rep.k = 0; rep.endAt = null; }
  const sim = rep.sim;
  while (sim.n < want && !sim.end) {
    while (rep.k < rep.log.length && rep.log[rep.k][0] <= sim.n) { if (rep.log[rep.k][0] === sim.n) munInput(sim, rep.log[rep.k][1]); rep.k++; }
    munStep(sim);
  }
  if (sim.end && rep.endAt == null) rep.endAt = performance.now();
  return { type: 'muncher', p: rep.p, sim, end: sim.end && sim.end !== 'out' ? sim.end : null, endAt: rep.endAt, want: sim.want, rep: true };
}
// After every render of the square: the maze drawn (its own loop while a run or a replay is on).
function schedulePaint() { if (paintRaf) cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(munPaint); }
function munPaint() {
  paintRaf = 0;
  if (loopRaf) { cancelAnimationFrame(loopRaf); loopRaf = 0; }
  munHeader();
  const cv = app.querySelector('canvas[data-mun="cv"]');
  if (!cv) return;
  if (munDraft && munDraft.sq === state.zoom && state.screen === 'mini') { munDraw(cv, munDraftView(munDraft, performance.now()), performance.now()); return; }   // (its own loop draws it)
  if (munRepFrame(performance.now())) loopRaf = requestAnimationFrame(munRepLoop);
}
function munRepLoop(now) {
  loopRaf = 0;
  if (munRepFrame(now)) loopRaf = requestAnimationFrame(munRepLoop);
}
// The header while a run is on here: the Board button goes (the player stays in the square until the run goes in).
// (The turn line says nothing of a held square in a timed run: ui/mini.js knows them, TIMED_RUN_TYPES.)
function munHeader() {
  const bar = app.querySelector('main.scr.mini .bar');
  if (!bar) return;
  const ttl = bar.querySelector('.ttl b');
  if (!ttl || ttl.textContent !== 'Muncher') return;
  const back = bar.querySelector('.back');
  if (back && munDraft && munDraft.sq === state.zoom) back.classList.add('gone');
}
// One drawing of the maze with no run under way here; true while a replay wants more frames.
function munRepFrame(now) {
  const cv = app.querySelector('canvas[data-mun="cv"]');
  if (!cv || (munDraft && munDraft.sq === state.zoom)) return false;
  const f = state.screen === 'mini' && state.flash && state.flash.square === state.zoom && state.flash.mun ? state.flash : null;
  const pre = f ? munPre(f) : 0, start = f ? fxAt('move', f) : null;
  if (pre && start != null) {                                        // someone else's run, as it played (then its last moment while the result shows)
    const rep = munReplayOf(f);
    if (rep) {
      const e = Math.max(0, now - start), T = (Math.min(e, rep.ms) * rep.speed) / 1000, v = munRepView(rep, T);
      munDraw(cv, v, now);
      const hud = app.querySelector('[data-mun="hud"]');
      if (hud) hud.textContent = munSay(v.sim.score0 + v.sim.ate.length, v.sim.target);
      return e < rep.ms + 1200;
    }
  }
  const lv = munLive && state.screen === 'mini' && munLive.sq === state.zoom && munLive.view ? munLive : null;   // this phone's run just made: its last moment, while it goes in and its result shows
  if (lv && (f ? f.by === lv.p : munId(state.zoom, lv.p) === lv.id && now - lv.at < 15000)) { munDraw(cv, lv.view, now); return now - lv.at < 1500; }
  if (lastStill) munDraw(cv, lastStill, now);
  return false;
}

// ---- the drawing ----
function munDraw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, L = sim.L, k = Math.min(W / MUN.w, H / MUN.h), ox = (W - MUN.w * k) / 2, oy = (H - MUN.h * k) / 2;
  if (munDraft && v.sim === munDraft.sim) munDraft.geo = { ox, oy, k };
  c.fillStyle = '#1b1540'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#262059'; c.fillRect(ox, oy, MUN.w * k, MUN.h * k);
  for (let y = 0; y < MUN.h; y++) for (let x = 0; x < MUN.w; x++) {   // the walls: soft blocks, lit along the top
    if (L.open[y * MUN.w + x]) continue;
    const X = ox + x * k, Y = oy + y * k;
    rr(c, X + 1.5, Y + 1.5, k - 3, k - 3, k * 0.24); outlined(c, '#5a4fb0', '#3b3480', 2);
    c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, X + k * 0.2, Y + k * 0.16, k * 0.6, k * 0.12, k * 0.06); c.fill();
  }
  c.fillStyle = '#ffe9a8';
  for (let cell = 0; cell < sim.dots.length; cell++) {               // the dots left for this player
    if (!sim.dots[cell]) continue;
    const x = cell % MUN.w, y = (cell - x) / MUN.w;
    c.beginPath(); c.arc(ox + (x + 0.5) * k, oy + (y + 0.5) * k, Math.max(2, k * 0.1), 0, Math.PI * 2); c.fill();
  }
  const at = m => { const [px, py] = munPos(m); return [ox + (px / MUN.U + 0.5) * k, oy + (py / MUN.U + 0.5) * k]; };
  sim.gh.forEach((g, i) => { const [x, y] = at(g); munSpook(c, x, y, k * 0.36, i, g.d, now, P, !v.still && sim.n < sim.graceN); });
  const [mx, my] = at(sim.ch), face = sim.ch.d >= 0 ? sim.ch.d : v.want >= 0 ? v.want : 1;
  munMuncher(c, mx, my, k * 0.38, v.p === 'O' ? P.O : P.X, face, sim, v, now, P);
  if (!v.still) {                                                    // the run's time: a bar along the bottom
    const u = Math.max(0, 1 - sim.n / sim.cap);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(ox, oy + MUN.h * k - 5, MUN.w * k, 5);
    c.fillStyle = u < 0.25 ? P.X : P.O; c.fillRect(ox, oy + MUN.h * k - 5, MUN.w * k * u, 5);
  }
  if ((v.end === 'win' || v.end === 'clear') && v.endAt) {           // the target: rays out of the muncher
    const u = Math.min(1, (now - v.endAt) / 600); c.strokeStyle = '#ffe9a8'; c.lineWidth = 3;
    for (let r = 0; r < 10; r++) { const a = r * Math.PI / 5 + u; c.beginPath(); c.moveTo(mx + Math.cos(a) * k * (0.55 + 0.6 * u), my + Math.sin(a) * k * (0.55 + 0.6 * u)); c.lineTo(mx + Math.cos(a) * k * (0.8 + 0.9 * u), my + Math.sin(a) * k * (0.8 + 0.9 * u)); c.stroke(); }
  }
}
// The muncher: a round-shouldered blob in the player's colour, two eyes on where it is going, a wide mouth that chomps
// as it moves (shut when it stands); caught: it goes pale, its eyes cross, and it shrinks away.
function munMuncher(c, x, y, R, col, face, sim, v, now, P) {
  const caught = v.end === 'caught', u = caught && v.endAt ? Math.min(1, (now - v.endAt) / 600) : 0;
  const moving = sim.ch.d >= 0 && !sim.end, phase = moving ? Math.abs(Math.sin((sim.ch.f / MUN.U) * Math.PI * 2)) : 0;
  const [fx, fy] = DIRS[face];
  c.save(); c.translate(x, y);
  if (caught) { c.rotate(u * 4); c.scale(1 - u * 0.9, 1 - u * 0.9); }
  rr(c, -R, -R * 0.92, 2 * R, 1.84 * R, R * 0.55); outlined(c, caught ? '#d9c9d9' : col, P.ink, 2.6);
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-R * 0.35, -R * 0.5, R * 0.28, R * 0.16, -0.4, 0, Math.PI * 2); c.fill();
  const mw = R * 0.62, mh = R * (0.14 + 0.42 * phase), mx = fx * R * 0.3, my = R * 0.28 + fy * R * 0.18;   // the mouth, toward the way it faces
  c.beginPath(); c.ellipse(mx, my, mw, Math.max(R * 0.08, mh), 0, 0, Math.PI * 2); outlined(c, '#2a1230', P.ink, 2);
  if (mh > R * 0.2) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx - mw * 0.55, my - mh * 0.95); c.lineTo(mx - mw * 0.3, my - mh * 0.95); c.lineTo(mx - mw * 0.42, my - mh * 0.35); c.closePath(); c.fill(); c.beginPath(); c.moveTo(mx + mw * 0.3, my - mh * 0.95); c.lineTo(mx + mw * 0.55, my - mh * 0.95); c.lineTo(mx + mw * 0.42, my - mh * 0.35); c.closePath(); c.fill(); }
  const ex = fx * R * 0.14, ey = -R * 0.3 + fy * R * 0.12;
  for (const s of [-1, 1]) {
    const cx = s * R * 0.36 + ex;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, ey, R * 0.2, R * 0.24, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.ink; c.stroke();
    if (caught) { c.lineWidth = 2; c.beginPath(); c.moveTo(cx - R * 0.1, ey - R * 0.1); c.lineTo(cx + R * 0.1, ey + R * 0.1); c.moveTo(cx + R * 0.1, ey - R * 0.1); c.lineTo(cx - R * 0.1, ey + R * 0.1); c.stroke(); }
    else { c.fillStyle = P.ink; c.beginPath(); c.arc(cx + fx * R * 0.07, ey + fy * R * 0.08, R * 0.1, 0, Math.PI * 2); c.fill(); }
  }
  c.strokeStyle = P.ink; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -R * 0.9); c.quadraticCurveTo(R * 0.15, -R * 1.25, R * 0.42, -R * 1.2); c.stroke();   // a curl on top
  c.restore();
}
// A spook: a jelly drop (lavender, mint), round on top, three toes along the bottom, one big eye on where it is going;
// it bobs as it floats, and waits a little see-through at the start.
function munSpook(c, x, y, R, i, d, now, P, waiting) {
  const col = SPOOK[i % SPOOK.length], bob = Math.sin(now / 170 + i * 2) * R * 0.08, [fx, fy] = d >= 0 ? DIRS[d] : [0, 0];
  c.save(); c.translate(x, y + bob);
  if (waiting) c.globalAlpha = 0.55;
  c.beginPath(); c.moveTo(-R, R * 0.9);
  c.lineTo(-R, -R * 0.1); c.arc(0, -R * 0.1, R, Math.PI, 0); c.lineTo(R, R * 0.9);
  for (let t = 0; t < 3; t++) c.arc(R - R * (2 * t + 1) / 3, R * 0.9, R / 3, 0, Math.PI);   // the toes
  c.closePath(); outlined(c, col, P.ink, 2.4);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-R * 0.4, -R * 0.5, R * 0.22, R * 0.14, -0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(fx * R * 0.12, -R * 0.15 + fy * R * 0.1, R * 0.42, R * 0.46, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.8; c.strokeStyle = P.ink; c.stroke();
  c.fillStyle = P.ink; c.beginPath(); c.arc(fx * R * 0.3, -R * 0.15 + fy * R * 0.26, R * 0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(fx * R * 0.3 - R * 0.07, -R * 0.15 + fy * R * 0.26 - R * 0.08, R * 0.06, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---- the square: both players' dots, the maze, a line of words, Start ----
function munTable(mini, a, o) {
  const g = a && a.mun ? a.mun : null, turn = o.turn, pre = g ? munPre(a) : 0, goal = munTarget(mini), l = mini.last;
  const live = munDraft && munDraft.sq === o.zoom ? munDraft : null;
  const mine = !o.view && !g && !o.done && !cpuTurn() && !remoteTurn();   // this phone's run to make
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const row = p => {
    const fresh = g && a.by === p, own = live && live.p === p;
    const here = munLive && munLive.sq === o.zoom && munLive.p === p && !fresh && performance.now() - munLive.at < 20000 ? munLive : null;
    const at = own ? live.sim.score0 + live.sim.ate.length : fresh ? g.to : here && here.to > munScore(mini, p) ? here.to : munScore(mini, p);
    const grow = fresh && pre > 0, w1 = 100 * Math.min(1, at / goal), w0 = grow ? 100 * Math.min(1, g.from / goal) : w1;
    const say = grow ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${munSay(g.from, goal)}</span><span class="tf" style="--f:${pre}ms">${munSay(at, goal)}</span></span>` : munSay(at, goal);
    return `<div class="rprog munprog ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${goal}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:900ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${say}</small></div>`;
  };
  const shown = g || ((o.done || o.view) && l && !l.auto ? l : null), who = g ? a.by : shown ? shown.by : turn;
  const said = shown ? munResultText(shown, goal, W(who)) : { text: '', ok: false };
  const words = g ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is on a run…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : live ? '<span></span>'
    : mine && moveWait ? '<span>Sending your run…</span>'
    : o.view ? (shown ? `<span>${said.text}</span>` : '')
    : mine ? '<span></span>'   // (how to play is in the ? explainer)
    : `<span>${state.lock === o.zoom && !state.online ? `${W(turn)} is on a run…` : `Waiting for ${W(turn)}…`}</span>`;
  const hudV = live ? live.sim.score0 + live.sim.ate.length : munScore(mini, g ? a.by : o.view && l ? l.by : turn);
  const hud = `<div class="rhud munhud" data-mun="hud">${munSay(hudV, goal)}</div>`;
  const scene = `<div class="munscene" data-mun="scene" aria-label="The maze, with the muncher at its start and the spooks in the middle"><canvas data-mun="cv"></canvas>${hud}</div>`;
  const go = mine && !live && !o.locked;
  const btn = o.view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="mun-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the maze never moves
  const stillP = o.view && l ? l.by : g ? a.by : turn;
  lastStill = munLive && munLive.sq === o.zoom && !g ? lastStill : munStill(mini, stillP);
  return `<div class="g-arc"><div class="mun">${`<div class="rprogs">${row('X')}${row('O')}</div>`}${scene}<p class="atwords munwords">${words}</p></div>${btn}</div>`;
}
// What a run came to, in words (text) and whether it gained anything (ok).
function munResultText(s, goal, who) {
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const gain = s.to - s.from, dots = n => `${n} dot${n === 1 ? '' : 's'}`;
  if (s.to >= goal) return { text: `${who} ate ${goal}!`, ok: true };
  if (gain > 0) return { text: `${who} ate ${dots(gain)}${s.end === 'caught' ? ', then a spook' : s.end === 'out' ? ' (out of time)' : ''} · ${s.to} of ${goal}`, ok: true };
  return { text: `${who} ${s.end === 'caught' ? 'was caught' : 'ate nothing'} · ${s.to} of ${goal}`, ok: false };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  wire();
  g = munTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
export function moveText(f, who) {
  const g = f.mun; if (!g || g.auto) return `${who} ran out of time`; const n = g.to - g.from; return n > 0 ? `${who} ate ${n} dot${n === 1 ? '' : 's'} · ${g.to} of ${g.target}` : `${who} ${g.end === 'caught' ? 'was caught' : 'ate nothing'} · ${g.to} of ${g.target}`;
}
const munEndSound = end => (end === 'caught' ? 'crash' : end === 'win' || end === 'clear' ? 'sparkle' : null);
// The sounds of a run, for moveSounds: someone else's as it replays (from its inputs, at the replay's speed), then the
// result for everyone: a ding for a gain, a thud for none.
export function sounds(f, add, won, mini, last) {
  const g = f.mun;
  if (!g) return;
  const pre = munPre(f), rep = pre ? munReplayOf(f) : null;
  if (rep) {
    const at = t => Math.round((t * 1000) / rep.speed), sim = munStart(rep.mini0, rep.p);
    let k = 0, n = 0;
    add('go', 0);
    while (sim.n < rep.steps && !sim.end) {
      while (k < rep.log.length && rep.log[k][0] <= sim.n) { if (rep.log[k][0] === sim.n) munInput(sim, rep.log[k][1]); k++; }
      munStep(sim);
      if (sim.last === 'eat' && n < 120) { add('munChomp', at(sim.n / MUN.hz)); n++; }
    }
    const e = munEndSound(sim.end);
    if (e) add(e, at(sim.n / MUN.hz));
  }
  add(g.auto ? 'thud' : g.to > g.from ? 'ding' : 'thud', pre + 250);
}
// The miniature: the maze (its walls, the dots, the muncher at its start, a spook) and each player's dots eaten as a
// bar with its count.
export function miniature(mini, final) {
  const L = munLayout(mini.lay), goal = munTarget(mini), s = 11;
  let walls = '', dots = '';
  for (let y = 0; y < MUN.h; y++) for (let x = 0; x < MUN.w; x++) { const c = y * MUN.w + x; if (!L.open[c]) walls += `M${x * s + 1} ${y * s + 1}h${s - 2}v${s - 2}h${2 - s}z`; else if (c !== L.start[1] * MUN.w + L.start[0] && !L.ghosts.some(([gx, gy]) => gx === x && gy === y)) dots += `M${x * s + s / 2} ${y * s + s / 2}h0.01`; }
  const bar = p => { const n = munScore(mini, p); return `<div class="mr ${p}"><b class="${p}">${p}</b><i><s style="--w:${(100 * Math.min(1, n / goal)).toFixed(1)}%"></s></i><span>${n}</span></div>`; };
  const g0 = L.ghosts[0];
  return `<div class="tmun" aria-label="Muncher: X has eaten ${munScore(mini, 'X')}, O ${munScore(mini, 'O')} of ${goal}"><div class="mpic" aria-hidden="true"><svg viewBox="0 0 ${MUN.w * s} ${MUN.h * s}"><rect class="bg" x="0" y="0" width="${MUN.w * s}" height="${MUN.h * s}" rx="4"/><path class="w" d="${walls}"/><path class="dots" d="${dots}"/><circle class="sp" cx="${g0[0] * s + s / 2}" cy="${g0[1] * s + s / 2}" r="4"/><rect class="mu" x="${L.start[0] * s + 1.5}" y="${L.start[1] * s + 1.5}" width="${s - 3}" height="${s - 3}" rx="3.5"/></svg></div><div class="mrows">${bar('X')}${bar('O')}</div></div>`;
}
export const actions = { 'mun-start': () => { munGo(); } };

// Its listeners, wired once the square first shows: the inputs from anywhere on the mini-game screen but its header.
function wire() {
  if (wired || typeof app.addEventListener !== 'function') return;
  wired = true;
  app.addEventListener('pointerdown', e => {
    const fd = munDraft;
    if (e.target && e.target.closest && e.target.closest('[data-act="mun-start"]')) { ownPress(); return; }   // (Start: its own sound, never the tap's)
    if (!fd || fd.phase !== 'play' || !runInputAt(e.target)) return;
    e.preventDefault(); ownPress();
    try { (e.target.closest('main.scr.mini') || app).setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    fd.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  });
  app.addEventListener('pointermove', e => {
    const fd = munDraft;
    if (!fd || !fd.ptr || fd.ptr.id !== e.pointerId || fd.phase !== 'play') return;
    const dx = e.clientX - fd.ptr.x, dy = e.clientY - fd.ptr.y;
    if (Math.hypot(dx, dy) < SWIPE) return;
    fd.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);   // the swipe's way; then again from here, without lifting
    fd.ptr.x = e.clientX; fd.ptr.y = e.clientY; fd.ptr.moved = true;
  });
  app.addEventListener('pointerup', e => {
    const fd = munDraft;
    if (!fd || !fd.ptr || fd.ptr.id !== e.pointerId) return;
    const pt = fd.ptr; fd.ptr = null;
    if (!pt.moved && fd.phase === 'play') munTapDir(fd, e.clientX, e.clientY);   // a tap: the side of the muncher it is on
  });
  app.addEventListener('pointercancel', e => { const fd = munDraft; if (fd && fd.ptr && fd.ptr.id === e.pointerId) fd.ptr = null; });
  // While a run is on, touches on the screen do nothing else: no scrolling, selection, magnifier or callout.
  ['touchstart', 'touchmove', 'touchend'].forEach(ev => app.addEventListener(ev, e => { if (munDraft && runInputAt(e.target) && e.cancelable) e.preventDefault(); }, { passive: false }));
  document.addEventListener('keydown', e => {                      // a keyboard: the arrows (or WASD) turn the muncher
    const fd = munDraft;
    if (!fd || fd.phase !== 'play' || KEYS[e.key] == null || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault(); fd.want = KEYS[e.key];
  });
  // The page hidden mid-run (another app, the lock button): the run ends there, its dots kept.
  document.addEventListener('visibilitychange', () => { if (document.hidden && munDraft && munDraft.phase === 'play') munFinish(true); });
}
