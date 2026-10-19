// The finger-game framework (Sky Hop, Scoop Stack, Pinball): Start, the inputs from anywhere on the
// screen, the attempt, replays and the shared table.
import { attStart } from '../games/shared/attention.js';
import { FING, FINGER_TYPES, HOP, fingAt, fingGoal, fingLog, fingMs, fingRaw, fingRecorder, fingUnlog } from '../games/shared/finger.js';
import { PHYSICS, physicsReady } from '../games/shared/physics.js';
import { RUNT } from '../games/shared/runner.js';
import { drawPin } from '../games/pinball/view.js';
import { SCOOP, scoopResult, scoopSize, scoopStart, scoopStep, scoopTop } from '../games/scoop/rules.js';
import { drawScoop, scoopBall } from '../games/scoop/view.js';
import { hopClampX, hopResult, hopStart, hopStep } from '../games/skyhop/rules.js';
import { drawHop } from '../games/skyhop/view.js';
import { SND, ownPress } from '../audio/sound.js';
import { attemptMove, dbStart } from '../net/moves.js';
import { blocked, moveWait, remoteTurn } from '../net/room.js';
import { N, REDUCED, app, cpuPlays, esc, save, state } from './app.js';
import { hash01 } from './art.js';
import { clockLeft } from './clock.js';
import { fxAt } from './fx.js';
import { lateAt } from './progress.js';
import { render } from './render.js';
import { outlined, runCanvas, runInputAt } from './runner.js';
import { cpuTurn } from './turns.js';

// ---------- Sky Hop, Scoop Stack and Pinball: the finger games ----------
// A square opens on its scene at the player's saved progress (Sky Hop: the hopper on its start ledge at
// the height they reached; Scoop Stack: the cone holding their stack; Pinball: the table with the targets
// they have lit), with Start below it. Start begins one attempt and holds the player to the square (here
// and on the server) until it ends: a fall, a hazard, three misses, a drain, the goal, or the turn's time
// running out (the attempt ends where it stands; what it gained is kept). The finger works anywhere on the
// mini-game screen (on, above or below the scene): a drag steers the hopper or moves the cone, one to one
// with the scene; in Pinball a press on the left half holds the left flipper and on the right half the
// right one, and while the ball waits in the lane a tap launches it (or a pull down and let go: the
// further, the harder). Sky Hop and Scoop Stack step the engine's own simulation (fixed steps, the
// finger's place recorded as it changes), so the attempt goes in as its inputs and the server plays them
// through again; Pinball runs physics.js's table and goes in as its hits and recording. Someone else's
// attempt (the computer's, the other phone's) plays here first, from its inputs or its recording, then
// the result. While an attempt is on, the page keeps a copy of it (FING_KEY): after a reload or a send
// that never arrived, it goes in from where it stood.
const FING_KEY = 'ttt-fing-run';
const FING_EARLY = 700;                                          // online: an attempt ends this long before the turn's time is up, so it goes in before the timeout
const FING_END = { skyhop: 750, scoop: 700, pinball: 650 };      // the end of an attempt (a fall, a splat, a drain) plays this long before it goes in
const FING_TEXT = {
  skyhop: { note: 'Tap Start, then drag left or right to steer. The sides are walls.', hint: 'Drag to steer', scene: 'The sky, with the hopper on its ledge', unit: 'm' },
  scoop: { note: 'Tap Start, then drag left or right to move the cone. Catch scoops, dodge the rest.', hint: 'Drag to move the cone', scene: 'The cone and the falling scoops', unit: 'scoops' },
  pinball: { note: 'Tap Start, then tap (or pull down) to launch. Hold left or right to flip.', hint: 'Hold left or right to flip', scene: 'The pinball table', unit: 'lit' },
};
const fmtN = n => Math.floor(n + 1e-9).toLocaleString('en-US');
export let fingDraft = null;                                            // the attempt under way on this phone (fingGo)
let fingLive = null;                                             // the attempt just made here: { sq, p, id, to, view, at } (its last moment stays on the scene while its result shows)
export let fingRep = null;                                              // someone else's attempt playing on the scene: { f, ... } (fingReplayOf)
let fingRaf = 0;                                                 // the replay's frame loop
const fingSent = new Set();                                      // the kept attempts sent again since this page loaded (once each)
const fingTries = (m, p) => (m.type === 'pinball' ? m.balls[p] : m.tries[p]);
const fingId = (sq, p) => { const m = state.squares[sq].mini; return `${state.online ? state.online.matchId || state.online.game || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:${m.type}:${fingTries(m, p)}:${m.seed ? m.seed[p] : m.lit[p].join('')}`; };
export const fingPinned = () => !!(fingDraft && state.screen === 'mini' && state.zoom === fingDraft.sq && !state.flash);
export function fingPre(f) { return f && FINGER_TYPES.includes(f.type) && f.fing && !f.fing.auto && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? fingMs(f.fing) : 0; }   // someone else's attempt plays first
// The mini as it was before an attempt (its result undone for the player who made it): the replay starts there.
function fingBefore(mini, fg) {
  const p = fg.by, m = Object.assign({}, mini);
  if (mini.type === 'skyhop') m.height = Object.assign({}, mini.height, { [p]: fg.from });
  else if (mini.type === 'scoop') { m.stack = Object.assign({}, mini.stack, { [p]: mini.stack[p].slice(0, fg.from) }); m.tries = Object.assign({}, mini.tries, { [p]: fg.try }); }
  else { const lit = mini.lit[p].slice(); for (const [id] of fg.hits || []) lit[id] = 0; m.lit = Object.assign({}, mini.lit, { [p]: lit }); }
  return m;
}
// The attempt as a move, as it stands (an attempt still under way: as if it ended now, 'out').
function fingMove(fd) {
  if (fd.type === 'pinball') { const r = PHYSICS.lib.pinResult(fd.w); return { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }; }
  const log = fingLog(fd.rec.pairs);
  if (fd.type === 'skyhop') { const r = hopResult(fd.sim); return { log, steps: r.steps, h: r.h, end: r.end }; }
  const r = scoopResult(fd.sim); return { log, steps: r.steps, n: r.n, end: r.end };
}
// Progress so far in the attempt under way (for the bar and the count).
const fingNow = fd => (fd.type === 'skyhop' ? Math.min(fd.sim.cfg.target, fd.sim.top) : fd.type === 'scoop' ? scoopSize(fd.sim) : fd.w.lit.filter(Boolean).length);
function fingKeep(fd, final) {
  try { localStorage.setItem(FING_KEY, JSON.stringify({ id: fd.id, m: fingMove(fd), final: !!final })); } catch (e) { /* no storage: a reload loses the attempt */ }
  fd.keptAt = performance.now();
}
const fingKept = () => { try { return JSON.parse(localStorage.getItem(FING_KEY) || 'null'); } catch (e) { return null; } };
const fingForget = () => { try { localStorage.removeItem(FING_KEY); } catch (e) { /* no storage */ } };
// Start: the attempt begins at once (the hold goes to the server alongside).
export function fingGo() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || !FINGER_TYPES.includes(sq.mini.type) || sq.owner || fingDraft || state.flash || state.done || blocked()) return;
  const type = sq.mini.type, p = state.turn;
  if (type === 'pinball' && !physicsReady()) return;
  if (!attStart(state, state.zoom, p).ok) return;               // held to the square: here, and on the server
  if (state.online && !state.sc) dbStart(state.zoom); else save();   // (Super Chaos: held on this phone)
  const now = performance.now(), mini = sq.mini;
  fingDraft = { id: fingId(state.zoom, p), sq: state.zoom, p, type, mini, phase: 'play', at: now, last: now, acc: 0, raf: 0, ptr: null, keys: { L: 0, R: 0, dir: 0 }, flipOn: { L: false, R: false }, presses: new Map(), pull: null, kpx: 30, out: {}, brk: {}, keptAt: now, saved: 0, end: null, endAt: 0, hintGone: false };
  const fd = fingDraft;
  if (type === 'pinball') fd.w = PHYSICS.lib.pinNew(PHYSICS.lib.pinTable(mini), mini.cfg, mini.lit[p]);
  else { fd.sim = type === 'skyhop' ? hopStart(mini, p) : scoopStart(mini, p); fd.rec = fingRecorder(); fd.tx = fd.sim.x; }
  fingLive = null;
  fingKeep(fd, false);
  SND.play('go');
  render();
  fd.raf = requestAnimationFrame(fingFrame);
}
export function fingFrame(now) {
  const fd = fingDraft;
  if (!fd) return;
  fd.raf = 0;
  if (!['mini'].includes(state.screen) || state.zoom !== fd.sq || state.winner) { fingFinish(); return; }   // (taken off the square somehow: it ends where it stands)
  const dt = Math.min(0.1, Math.max(0, (now - fd.last) / 1000));
  fd.last = now;
  if (fd.phase === 'play') {
    const left = clockLeft();
    if (left != null && left <= (state.online ? FING_EARLY : 0)) { fingFinish(); return; }   // the turn's time is up: the attempt ends here, its gains kept
    if (fd.keys.dir && fd.type !== 'pinball') fingAim(fd, fd.tx + fd.keys.dir * 9 * dt);   // (a keyboard's arrows)
    if (fd.type === 'pinball') fingPinStep(fd, dt);
    else {
      fd.acc += dt;
      while (fd.acc >= FING.step - 1e-9 && !fd.sim.end) { fd.acc -= FING.step; fingStep(fd, fd.sim, fd.rec.at(fd.sim.n, fd.tx), true); }
      if (fd.sim.end) fingEnd(fd, fd.sim.end, now);
    }
    if (now - fd.keptAt > 500) fingKeep(fd, false);
    if (!fd.hintGone && now - fd.at > 1800) { fd.hintGone = true; const h = app.querySelector('.fhint'); if (h) h.remove(); }
    fingHud(fd);
  } else if (now - fd.endAt >= FING_END[fd.type]) { fingFinish(); return; }
  const cv = app.querySelector('canvas[data-fing="cv"]');
  if (cv) fingDraw(cv, fingDraftView(fd, now), now);
  fd.raf = requestAnimationFrame(fingFrame);
}
// One step of Sky Hop or Scoop Stack (the phone's own, or a replay's), noting what it did for the drawing and the sounds.
function fingStep(v, sim, tx, loud) {
  if (sim.type === 'skyhop') {
    hopStep(sim, tx);
    if (sim.last === 'break') { v.brk[sim.on] = sim.t; if (loud) { SND.play('spring'); SND.play('crumble'); } }
    else if (sim.last && loud) SND.play('spring');
    return;
  }
  const i0 = sim.i, m0 = sim.miss;
  scoopStep(sim, tx);
  for (let j = i0; j < sim.i; j++) {                               // what came of each item that reached the top in this step
    const it = sim.items[j], top = scoopTop(sim), off = Math.abs(it.x - top);
    const o = it.k === 'scoop' ? (off <= SCOOP.slide ? 'catch' : off <= SCOOP.touch ? 'slide' : 'miss') : off <= SCOOP.hit ? 'hit' : 'dodge';
    v.out[j] = { o, t: sim.t, top };
    if (loud && o !== 'dodge' && o !== 'miss') SND.play(o === 'catch' ? 'scoop' : o === 'slide' ? 'whoosh' : 'crash');
  }
  if (loud && sim.miss > m0) SND.play('cushion');                  // a missed scoop gone off the bottom of the screen: the miss counts now
}
function fingPinStep(fd, dt) {
  const L = PHYSICS.lib, w = fd.w;
  const flip = { L: fd.keys.L > 0 || [...fd.presses.values()].includes('L'), R: fd.keys.R > 0 || [...fd.presses.values()].includes('R') };
  for (const s of ['L', 'R']) { if (flip[s] && !fd.flipOn[s] && w.inPlay) SND.play('flipper'); fd.flipOn[s] = flip[s]; }
  const ev = L.pinRun(w, dt * 1000, flip);
  for (const e of ev) {
    if (e.k === 'bump') SND.play('bumper');
    else if (e.k === 'sling') SND.play('cushion');
    else if (e.k === 'hit') { SND.play('ding'); fd.flash = { id: e.id, at: performance.now() }; }
    else if (e.k === 'save') { SND.play('beep'); fd.saved = performance.now(); }
  }
  if (w.over) fingEnd(fd, w.lit.every(Boolean) ? 'all' : ev.some(e => e.k === 'time') ? 'time' : 'drain', performance.now());
}
// The attempt has ended (a fall, a hazard, three misses, the goal, a drain): its end plays, then it goes in.
function fingEnd(fd, end, now) {
  if (fd.phase !== 'play') return;
  fd.phase = 'end'; fd.end = end; fd.endAt = now;
  fd.presses.clear(); fd.pull = null;
  const snd = fingEndSound(fd.type, end);
  if (snd) SND.play(snd);
}
// The end's own sound (Scoop Stack's splat has already sounded as the hazard landed).
const fingEndSound = (type, end) => (end === 'top' || end === 'all' ? 'sparkle' : end === 'hazard' ? (type === 'scoop' ? null : 'crash') : end === 'fall' || end === 'drain' ? 'whoosh' : end === 'miss' ? 'thud' : null);
// The attempt goes in: as it ended, or as it stands (the time ran out, the screen went away).
export function fingFinish() {
  const fd = fingDraft;
  if (!fd) return;
  cancelAnimationFrame(fd.raf); fingDraft = null;
  if (fd.type !== 'pinball' && fd.sim.n === 0) fingStep(fd, fd.sim, fd.rec.at(0, fd.tx), false);   // (at least one step: an attempt of none is no attempt)
  const m = fingMove(fd);
  fingKeep(fd, true);
  fingLive = { sq: fd.sq, p: fd.p, id: fd.id, to: Math.max(fingAt(fd.mini, fd.p), fingNow(fd)), view: fingDraftView(fd, performance.now()), at: performance.now() };
  fingSent.add(fd.id);
  attemptMove(m);
  render();
}
// Where the finger puts the hopper's or the cone's goal: within the walls (Sky Hop) or the screen (Scoop Stack).
function fingAim(fd, tx) {
  if (fd.type === 'skyhop') fd.tx = hopClampX(tx);
  else fd.tx = Math.max(SCOOP.edge, Math.min(SCOOP.w - SCOOP.edge, tx));
}
function fingHud(fd) {
  const hud = app.querySelector('[data-fing="hud"]');
  const val = fingNow(fd), goal = fd.type === 'pinball' ? fd.w.lit.length : fd.sim.cfg.target;
  if (hud) hud.textContent = fd.type === 'skyhop' ? `${fmtN(val)} m` : `${fmtN(val)} / ${fmtN(goal)}`;
  const row = app.querySelector(`.fprog.${fd.p}`);                 // the player's own progress fills as they go
  if (!row) return;
  if (fd.type === 'pinball') { const dots = row.querySelectorAll('.pips i'); fd.w.lit.forEach((on, k) => { if (dots[k]) dots[k].classList.toggle('on', !!on); }); }
  else { const w = (100 * Math.min(1, val / goal)).toFixed(2) + '%', bi = row.querySelector('.rbar i'); if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); } }
  const sm = row.querySelector('small');
  if (sm) sm.textContent = fingSay(fd.type, val, goal);
}
const fingSay = (type, v, goal) => (type === 'skyhop' ? `${fmtN(v)} / ${fmtN(goal)} m` : type === 'scoop' ? `${fmtN(v)} / ${fmtN(goal)}` : `${v} / ${goal} lit`);

// ---- what the scene shows: the attempt under way, a replay, the last moment, or the clean start ----
function fingDraftView(fd, now) {
  if (fd.type === 'pinball') {
    const w = fd.w, b = w.ball.position;
    return { type: 'pinball', p: fd.p, cfg: fd.mini.cfg, table: w.table, lit: w.lit.slice(), ball: [b.x, b.y], flips: [w.flip.L.a, w.flip.R.a], t: w.t, pull: fd.pull ? fd.pull.p : 0, flash: fd.flash, saved: fd.saved, end: fd.end, endAt: fd.endAt, waiting: !w.inPlay && !w.over, gate: w.gateOn };
  }
  return { type: fd.type, p: fd.p, sim: fd.sim, out: fd.out, brk: fd.brk, stack: fd.type === 'scoop' ? fd.mini.stack[fd.p].concat(fd.sim.got) : null, end: fd.end, endAt: fd.endAt, tx: fd.tx };
}
// The clean start at a player's saved progress (never the last crash).
function fingStill(mini, p) {
  if (mini.type === 'skyhop') return { type: 'skyhop', p, sim: hopStart(mini, p), out: {}, brk: {}, still: true };
  if (mini.type === 'scoop') return { type: 'scoop', p, sim: scoopStart(mini, p), out: {}, brk: {}, stack: mini.stack[p].slice(), still: true };
  const T = PHYSICS.lib.PIN;
  return { type: 'pinball', p, cfg: mini.cfg, table: PHYSICS.lib.pinTable(mini), lit: mini.lit[p].slice(), ball: T.lane.serve.slice(), flips: [T.flip.rest, T.flip.rest], t: 0, pull: 0, waiting: true, still: true, gate: false };
}
// Someone else's attempt, ready to play: from its inputs (stepped as the replay goes) or its recording.
const fingReps = new WeakMap();
function fingReplayOf(f) {
  if (fingReps.has(f)) return fingReps.get(f);
  const sq = state.squares && state.squares[f.square], fg = f.fing;
  let rep = null;
  if (sq && fg && !fg.auto && (fg.type !== 'pinball' || physicsReady())) {
    const mini0 = fingBefore(sq.mini, fg), raw = fingRaw(fg), ms = fingMs(fg), speed = ms > 0 ? raw / ms : 1;
    if (fg.type === 'pinball') {
      const L = PHYSICS.lib, frames = L.pinUnpack(fg.rec) || [];
      rep = { type: 'pinball', p: fg.by, mini0, table: L.pinTable(mini0), frames, ang: L.pinFlipAngles(frames), hits: fg.hits || [], ms, speed, raw };
    } else {
      const log = fingUnlog(fg.log, fg.steps, Math.ceil((fg.type === 'skyhop' ? HOP.w : SCOOP.w) * FING.q)) || [];
      rep = { type: fg.type, p: fg.by, mini0, log, steps: fg.steps, ms, speed, raw };
    }
  }
  fingReps.set(f, rep);
  return rep;
}
// A replay's view at T seconds into the attempt (Sky Hop, Scoop Stack: the sim stepped on to there).
function fingRepView(rep, T) {
  if (rep.type === 'pinball') {
    const L = PHYSICS.lib, fps = L.PIN.fps, fr = rep.frames, n = fr.length;
    if (!n) return fingStill(rep.mini0, rep.p);
    const x = Math.min(n - 1, Math.max(0, T * fps)), i = Math.floor(x), j = Math.min(n - 1, i + 1), u = x - i, a = fr[i], b = fr[j];
    const jump = Math.hypot(b[0] - a[0], b[1] - a[1]) > 15;
    const lit = rep.mini0.lit[rep.p].slice(); let flash = null;
    for (const [id, t] of rep.hits) if (t <= T) { lit[id] = 1; if (T - t < 0.6) flash = { id, at: performance.now() - (T - t) * 1000 }; }
    const T0 = L.PIN.lane.serve, waiting = Math.hypot(a[0] - T0[0], a[1] - T0[1]) < 0.5;
    const gate = !waiting && (a[0] < L.PIN.lane.x0 - 1 || a[1] < L.PIN.lane.top - 1);   // (the gate shuts once the ball is out on the playfield)
    return { type: 'pinball', p: rep.p, cfg: rep.mini0.cfg, table: rep.table, gate, lit, ball: jump ? a.slice(0, 2) : [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], flips: [rep.ang[i][0] + (rep.ang[j][0] - rep.ang[i][0]) * u, rep.ang[i][1] + (rep.ang[j][1] - rep.ang[i][1]) * u], t: T, pull: 0, flash, waiting };
  }
  if (!rep.sim || rep.sim.n > T / FING.step + 1) { rep.sim = rep.type === 'skyhop' ? hopStart(rep.mini0, rep.p) : scoopStart(rep.mini0, rep.p); rep.k = 0; rep.out = {}; rep.brk = {}; rep.tx = rep.sim.x; }
  const sim = rep.sim, want = Math.min(rep.steps, Math.floor(T / FING.step + 1e-6));
  while (sim.n < want && !sim.end) {
    let tx = null;
    if (rep.k < rep.log.length && rep.log[rep.k][0] === sim.n) { tx = rep.log[rep.k++][1] / FING.q; rep.tx = tx; }
    fingStep(rep, sim, tx, false);
  }
  if (sim.end && rep.endAt == null) rep.endAt = performance.now();
  return { type: rep.type, p: rep.p, sim, out: rep.out, brk: rep.brk, stack: rep.type === 'scoop' ? rep.mini0.stack[rep.p].concat(sim.got) : null, end: sim.end && sim.end !== 'out' ? sim.end : null, endAt: rep.endAt, tx: rep.tx };
}
// After every render: the scene of a finger-game square.
export function fingPaint() {
  if (fingRaf) { cancelAnimationFrame(fingRaf); fingRaf = 0; }
  const cv = app.querySelector('canvas[data-fing="cv"]');
  if (!cv || !['mini', 'review-mini'].includes(state.screen)) { fingRep = null; return; }
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || !FINGER_TYPES.includes(sq.mini.type)) return;
  if (fingDraft && fingDraft.sq === state.zoom) { fingDraw(cv, fingDraftView(fingDraft, performance.now()), performance.now()); return; }   // (its own loop draws it)
  if (fingRepFrame(performance.now())) fingRaf = requestAnimationFrame(fingRepLoop);
}
function fingRepLoop(now) {
  fingRaf = 0;
  if (fingRepFrame(now)) fingRaf = requestAnimationFrame(fingRepLoop);
}
// One drawing of the scene with no attempt under way here; true while a replay wants more frames.
function fingRepFrame(now) {
  const cv = app.querySelector('canvas[data-fing="cv"]'), sq = state.squares && state.squares[state.zoom];
  if (!cv || !sq || !FINGER_TYPES.includes(sq.mini.type) || (fingDraft && fingDraft.sq === state.zoom)) return false;
  if (sq.mini.type === 'pinball' && !physicsReady()) return false;
  const f = state.flash && state.flash.square === state.zoom && state.flash.fing ? state.flash : null;
  const pre = f ? fingPre(f) : 0, start = f ? fxAt('move', f) : null;
  if (pre && start != null) {                                        // someone else's attempt, as it played (then its last moment while the result shows)
    const rep = fingReplayOf(f);
    if (rep) {
      if (!fingRep || fingRep.f !== f) fingRep = { f, rep };
      const e = Math.max(0, now - start), T = (Math.min(e, rep.ms) * rep.speed) / 1000;
      fingDraw(cv, fingRepView(rep, T), now);
      const hud = app.querySelector('[data-fing="hud"]'), v = rep.type === 'pinball' ? null : rep.sim;
      if (hud) hud.textContent = rep.type === 'skyhop' ? `${fmtN(Math.min(v.cfg.target, v.top))} m` : rep.type === 'scoop' ? `${fmtN(scoopSize(v))} / ${fmtN(v.cfg.target)}` : `${fingRepView(rep, T).lit.filter(Boolean).length} / ${rep.mini0.lit[rep.p].length}`;
      return e < rep.ms + 1200;
    }
  }
  fingRep = null;
  const lv = fingLive && fingLive.sq === state.zoom && fingLive.view ? fingLive : null;   // this phone's attempt just made: its last moment, while it goes in and its result shows
  if (lv && (f ? f.by === lv.p : fingId(state.zoom, lv.p) === lv.id && now - lv.at < 15000)) { fingDraw(cv, lv.view, now); return now - lv.at < 1500; }
  const p = sq.owner || (f ? f.by : state.turn);
  fingDraw(cv, fingStill(sq.mini, p), now);
  return false;
}
export function fingDraw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  if (v.type === 'skyhop') drawHop(c, W, H, v, now);
  else if (v.type === 'scoop') drawScoop(c, W, H, v, now);
  else drawPin(c, W, H, v, now);
  if (fingDraft && v.sim === (fingDraft.sim || null) && v.type !== 'pinball') fingDraft.kpx = v.type === 'skyhop' ? Math.min(W / HOP.w, H / 11) : Math.min(W / SCOOP.w, H / 15.5);
}

// ---- the square: both players' progress, the scene, a line of words, Start ----
export function fingTable(mini, a, o) {
  const type = mini.type, fg = a && a.fing ? a.fing : null, turn = o.turn, pre = fg ? fingPre(a) : 0, TX = FING_TEXT[type], goal = fingGoal(mini), l = mini.last;
  const live = fingDraft && fingDraft.sq === o.zoom ? fingDraft : null;
  const mine = !o.view && !fg && !o.done && !cpuTurn() && !remoteTurn();   // this phone's attempt to make (held through a dropped connection or a send on its way)
  const kept = mine && !live ? fingResume(o.zoom, turn) : null;
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const row = p => {
    const fresh = fg && a.by === p, own = live && live.p === p;
    if (type === 'pinball') {
      const lit = own ? live.w.lit : mini.lit[p], newly = fresh && pre ? new Set((fg.hits || []).map(h => h[0])) : new Set();
      const n = lit.filter(Boolean).length, before = n - newly.size;
      const say = fresh && pre ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${before} / ${goal} lit</span><span class="tf" style="--f:${pre}ms">${n} / ${goal} lit</span></span>` : `${n} / ${goal} lit`;
      return `<div class="ctal fprog ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><span class="pips" aria-label="${n} of ${goal} targets lit">${lit.map((on, k) => `<i ${lateAt(on ? 'on' : '', newly.has(k) ? pre : null, 'fillin')} title="${esc(PHYSICS.lib ? PHYSICS.lib.PIN.targets[k].name : '')}"></i>`).join('')}</span><small>${say}</small></div>`;
    }
    const here = fingLive && fingLive.sq === o.zoom && fingLive.p === p && !fresh && performance.now() - fingLive.at < 20000 ? fingLive : null;
    const at = own ? fingNow(live) : fresh ? fg.to : here && here.to > fingAt(mini, p) ? here.to : fingAt(mini, p);
    const grow = fresh && pre > 0, w1 = 100 * Math.min(1, at / goal), w0 = grow ? 100 * Math.min(1, fg.from / goal) : w1;
    const say = grow ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${fingSay(type, fg.from, goal)}</span><span class="tf" style="--f:${pre}ms">${fingSay(type, at, goal)}</span></span>` : fingSay(type, at, goal);
    return `<div class="rprog fprog ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${goal}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:${RUNT.bar}ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${say}</small></div>`;
  };
  const shown = fg || ((o.done || o.view) && l && !l.auto ? l : null), who = fg ? a.by : shown ? shown.by : turn;
  const said = shown ? fingResultText(type, shown, mini, W(who)) : '';
  const words = fg ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is having a go…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : live ? '<span></span>'
    : kept || (mine && moveWait) ? '<span>Sending your attempt…</span>'
    : o.view ? (shown ? `<span>${said.text}</span>` : '')
    : mine ? '<span></span>'   // (how to play is in the ? explainer)
    : `<span>${state.lock === o.zoom ? `${W(turn)} is having a go…` : `Waiting for ${W(turn)}…`}</span>`;
  const hint = '';
  const hudV = live ? fingNow(live) : fingAt(mini, fg ? a.by : o.view && mini.last ? mini.last.by : turn);
  const hud = `<div class="rhud fhud" data-fing="hud">${type === 'skyhop' ? `${fmtN(hudV)} m` : type === 'scoop' ? `${fmtN(hudV)} / ${fmtN(goal)}` : `${hudV} / ${goal}`}</div>`;
  const scene = `<div class="fscene ${type}" data-fing="scene" aria-label="${TX.scene}"><canvas data-fing="cv"></canvas>${hud}${hint}</div>`;
  const go = mine && !live && !kept && !o.locked && (type !== 'pinball' || physicsReady());
  const btn = o.view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="fing-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the scene never moves
  const rows = type === 'pinball' ? `<div class="ctals col">${row('X')}${row('O')}</div>` : `<div class="rprogs">${row('X')}${row('O')}</div>`;
  return `<div class="g-arc"><div class="fing">${rows}${scene}<p class="atwords fwords">${words}</p></div>${btn}</div>`;
}
// What an attempt came to, in words (text) and whether it gained anything (ok).
function fingResultText(type, s, mini, who) {
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const goal = fingGoal(mini), gain = s.to - s.from, out = s.end === 'out' ? ' (out of time)' : '';
  if (s.to >= goal) return { text: type === 'skyhop' ? `${who} reached the top!` : type === 'scoop' ? `${who} stacked ${goal} scoops!` : `${who} lit every target!`, ok: true };
  if (type === 'skyhop') return { text: gain > 0 ? `${who} climbed to ${fmtN(s.to)} m (+${fmtN(gain)})${out}` : `${who} ${s.end === 'hazard' ? 'hit a burr' : s.end === 'out' ? 'ran out of time' : 'fell'} · still at ${fmtN(s.to)} m`, ok: gain > 0 };
  if (type === 'scoop') return { text: `${who} ${s.end === 'hazard' ? 'caught something nasty' : s.end === 'miss' ? 'missed 3' : 'ran out of time'} · ${gain > 0 ? `+${gain}, now ` : ''}${s.to} scoop${s.to === 1 ? '' : 's'}`, ok: gain > 0 };
  return { text: gain > 0 ? `${who} lit ${gain} target${gain === 1 ? '' : 's'}${out} · ${s.to} of ${goal}` : `${who} lit nothing this ball${out} · ${s.to} of ${goal}`, ok: gain > 0 };
}
// An attempt kept from before a reload (or a send that never got there): it goes in from where it stood, once.
function fingResume(sq, p) {
  const k = fingKept();
  if (!k) return null;
  const id = fingId(sq, p);
  if (k.id !== id) { fingForget(); return null; }                 // an attempt that already counted (or another match's)
  if (fingSent.has(id) || !k.m) return null;
  setTimeout(() => {
    if (fingDraft || state.flash || state.done || blocked() || state.zoom !== sq || state.screen !== 'mini' || fingSent.has(id) || fingId(sq, p) !== id) return;
    fingSent.add(id);
    attemptMove(k.m);
    render();
  }, 0);
  return k;
}
function fingUp(e) {
  const fd = fingDraft;
  if (!fd) return;
  if (fd.type === 'pinball') {
    if (fd.pull && fd.pull.id === e.pointerId) { const p = fd.pull.p; fd.pull = null; if (fd.phase === 'play' && PHYSICS.lib.pinLaunch(fd.w, p < 0.06 ? null : p)) SND.play('plunger'); return; }   // a tap: the usual launch; a pull: as hard as it went
    fd.presses.delete(e.pointerId);
    return;
  }
  if (fd.ptr && fd.ptr.id === e.pointerId) fd.ptr = null;
}
const FING_KEYS = { ArrowLeft: 'L', z: 'L', Z: 'L', ArrowRight: 'R', m: 'R', M: 'R', '/': 'R' };
export function fingThing(c, x, y, R, it, P, now, landed) {             // a falling scoop, pebble or burnt scoop
  if (it.k === 'scoop') { scoopBall(c, x, y, R, it.f, P); return; }
  if (it.k === 'pebble') {
    c.beginPath(); const pts = 9; for (let s = 0; s < pts; s++) { const a = (s / pts) * Math.PI * 2, r = R * (0.78 + 0.22 * hash01(s + it.T * 13)); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82); } c.closePath(); outlined(c, '#9a9aa6', P.ink, 2.2);
    c.fillStyle = '#c4c4cf'; c.beginPath(); c.ellipse(x - R * 0.25, y - R * 0.25, R * 0.25, R * 0.14, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6e6e7a'; c.beginPath(); c.arc(x + R * 0.3, y + R * 0.2, R * 0.1, 0, Math.PI * 2); c.fill();
  } else {                                                          // burnt: charred, glowing cracks, smoke above
    c.fillStyle = 'rgba(80,70,70,.35)'; for (let s = 0; s < 3; s++) { const u = ((now / 900 + s / 3) % 1); c.beginPath(); c.arc(x + Math.sin(u * 6 + s) * R * 0.4, y - R - u * R * 1.6, R * (0.2 + 0.25 * u), 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); outlined(c, '#3a2a24', P.ink, 2.4);
    c.strokeStyle = '#ff8a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - R * 0.5, y - R * 0.1); c.lineTo(x - R * 0.15, y + R * 0.15); c.lineTo(x + R * 0.1, y - R * 0.2); c.lineTo(x + R * 0.5, y + R * 0.05); c.stroke();
    c.fillStyle = '#ffb347'; c.beginPath(); c.arc(x + R * 0.25, y + R * 0.45, R * 0.09, 0, Math.PI * 2); c.fill();
  }
  if (landed) { c.strokeStyle = P.X; c.lineWidth = 3; for (let r = 0; r < 8; r++) { const a = r * Math.PI / 4; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 1.2, y + Math.sin(a) * R * 1.2); c.lineTo(x + Math.cos(a) * R * 1.7, y + Math.sin(a) * R * 1.7); c.stroke(); } }
}

// The sounds of an attempt, for moveSounds: someone else's as it replays (from its inputs or recording, at
// the replay's speed), then the result for everyone: a ding for a gain, a thud for none.
export function fingSounds(f, add) {
  const fg = f.fing;
  if (!fg) return;
  const pre = fingPre(f), rep = pre ? fingReplayOf(f) : null;
  if (rep) {
    const at = t => Math.round((t * 1000) / rep.speed);
    let n = 0;
    add('go', 0);
    if (rep.type === 'pinball') {
      const T = PHYSICS.lib.PIN, fr = rep.frames, sv = T.lane.serve, bumps = rep.table.bumpers, near = bumps.map(() => false);
      let bits = 0, lane = true;
      for (let i = 0; i < fr.length && n < 160; i++) {
        const [x, y, b] = fr[i], t = i / T.fps, inLane = Math.hypot(x - sv[0], y - sv[1]) < 0.5;
        if (lane && !inLane) { add('plunger', at(t)); n++; }
        lane = inLane;
        if ((b & 1) && !(bits & 1)) { add('flipper', at(t)); n++; }
        if ((b & 2) && !(bits & 2)) { add('flipper', at(t)); n++; }
        bits = b;
        bumps.forEach(([bx, by, br], j) => { const on = Math.hypot(x - bx, y - by) < br + T.ballR + 1.5; if (on && !near[j]) { add('bumper', at(t)); n++; } near[j] = on; });
      }
      for (const [, t] of rep.hits) add('ding', at(t));
      const e = fingEndSound('pinball', fg.end);
      if (e) add(e, rep.ms);
    } else {
      const sim = rep.type === 'skyhop' ? hopStart(rep.mini0, rep.p) : scoopStart(rep.mini0, rep.p), v = { out: {}, brk: {} };
      let k = 0;
      while (sim.n < rep.steps && !sim.end) {
        let tx = null;
        if (k < rep.log.length && rep.log[k][0] === sim.n) tx = rep.log[k++][1] / FING.q;
        const i0 = sim.i, m0 = sim.miss;
        fingStep(v, sim, tx, false);
        if (n > 200) continue;
        if (rep.type === 'skyhop') { if (sim.last) { add('spring', at(sim.t)); n++; } if (sim.last === 'break') add('crumble', at(sim.t)); }
        else {
          for (let j = i0; j < sim.i; j++) { const o = v.out[j].o; if (o !== 'dodge' && o !== 'miss') { add(o === 'catch' ? 'scoop' : o === 'slide' ? 'whoosh' : 'crash', at(sim.t)); n++; } }
          if (sim.miss > m0) { add('cushion', at(sim.t)); n++; }                                // (a miss: as it leaves the screen)
        }
      }
      const e = sim.end && fingEndSound(rep.type, sim.end);
      if (e) add(e, at(sim.t));
    }
  }
  add(fg.auto ? 'thud' : fg.to > fg.from ? 'ding' : 'thud', pre + 250);
}
export function fingerMiniature(mini, final) {
  return `<div class="trun" aria-label="X at ${fingAt(mini, 'X')}, O at ${fingAt(mini, 'O')} of ${mini.cfg.target}">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, fingAt(mini, p) / mini.cfg.target)).toFixed(1)}%"></i></div>`).join('')}</div>`;   // both players' progress: the height climbed, the scoops stacked
}
export function fingerMoveText(f, who) {
  const fg = f.fing; if (!fg || fg.auto) return `${who} ran out of time`; const g = fg.to - fg.from; return f.type === 'skyhop' ? (g > 0 ? `${who} climbed to ${fmtN(fg.to)} m` : `${who} fell · still at ${fmtN(fg.to)} m`) : f.type === 'scoop' ? (g > 0 ? `${who} stacked ${g} more · ${fg.to} scoops` : `${who} stacked none`) : g > 0 ? `${who} lit ${g} · ${fg.to} of ${fg.goal}` : `${who} lit nothing`;
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {

  // ---- the inputs: from pointerdown, anywhere on the mini-game screen but its header ----
  app.addEventListener('pointerdown', e => {
    const fd = fingDraft;
    if (!fd || fd.phase !== 'play' || !runInputAt(e.target)) return;
    e.preventDefault(); ownPress();
    const scene = app.querySelector('[data-fing="scene"]');
    try { (e.target.closest('main.scr.mini') || scene).setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    if (fd.type === 'pinball') {
      if (!fd.w.inPlay && !fd.w.over) { if (!fd.pull) fd.pull = { id: e.pointerId, y0: e.clientY, p: 0, h: scene ? scene.getBoundingClientRect().height : 400 }; return; }   // the ball in the lane: a tap or a pull launches it
      const box = (scene || e.target).getBoundingClientRect();
      fd.presses.set(e.pointerId, e.clientX < box.left + box.width / 2 ? 'L' : 'R');   // the left half, the left flipper; the right half, the right
      return;
    }
    fd.ptr = { id: e.pointerId, x: e.clientX };
  });
  app.addEventListener('pointermove', e => {
    const fd = fingDraft;
    if (!fd || fd.phase !== 'play') return;
    if (fd.type === 'pinball') { if (fd.pull && fd.pull.id === e.pointerId) fd.pull.p = Math.max(0, Math.min(1, (e.clientY - fd.pull.y0) / (fd.pull.h * 0.22))); return; }
    if (!fd.ptr || fd.ptr.id !== e.pointerId) return;
    const dx = e.clientX - fd.ptr.x;
    fd.ptr.x = e.clientX;
    fingAim(fd, fd.tx + dx / Math.max(1, fd.kpx));                  // one to one with the scene
  });
  app.addEventListener('pointerup', fingUp);
  app.addEventListener('pointercancel', e => { const fd = fingDraft; if (fd && fd.pull && fd.pull.id === e.pointerId) fd.pull = null; fingUp(e); });
  // While an attempt is on, touches on the screen do nothing else: no scrolling, selection, magnifier or callout.
  ['touchstart', 'touchmove', 'touchend'].forEach(ev => app.addEventListener(ev, e => { if (fingDraft && runInputAt(e.target) && e.cancelable) e.preventDefault(); }, { passive: false }));
  app.addEventListener('contextmenu', e => { if (e.target && e.target.closest && e.target.closest('.fscene, main.scr.mini:has(.fing)')) e.preventDefault(); });
  document.addEventListener('keydown', e => {                      // a keyboard: the arrows steer (Pinball: flip; space or down launches)
    const fd = fingDraft;
    if (!fd || fd.phase !== 'play') return;
    if (fd.type === 'pinball') {
      if ((e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') && !fd.w.inPlay) { e.preventDefault(); if (PHYSICS.lib.pinLaunch(fd.w, null)) SND.play('plunger'); return; }
      if (FING_KEYS[e.key] && !e.repeat) { e.preventDefault(); fd.keys[FING_KEYS[e.key]] = 1; }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); fd.keys.dir = e.key === 'ArrowLeft' ? -1 : 1; }
  });
  document.addEventListener('keyup', e => {
    const fd = fingDraft;
    if (!fd) return;
    if (fd.type === 'pinball') { if (FING_KEYS[e.key]) fd.keys[FING_KEYS[e.key]] = 0; return; }
    if ((e.key === 'ArrowLeft' && fd.keys.dir < 0) || (e.key === 'ArrowRight' && fd.keys.dir > 0)) fd.keys.dir = 0;
  });
  // The page hidden mid-attempt (another app, the lock button): the attempt ends there, its gains kept.
  document.addEventListener('visibilitychange', () => { if (document.hidden && fingDraft && fingDraft.phase === 'play') fingFinish(); });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setFingDraw(v) { fingDraw = v; }
export function setFingFrame(v) { fingFrame = v; }
