// Star Swarm: the screen, the miniature, the move's words and sounds, and the inputs.
// The square opens on the sky with the ship at the bottom and Start below it. Start begins one run on this
// phone (the finger works anywhere on the mini-game screen: a drag flies the ship, one to one with the sky);
// the run steps the engine's own simulation (rules.js, fixed steps, the finger's place recorded as it
// changes), so it goes in as its inputs and the server plays them through again. Someone else's run (the
// computer's, the other phone's) plays here first, from its inputs, as part of the move's flash (its length
// is in flashMs, so the server reckons the playback), then the result; the phone that flew a run has seen
// it already, so it takes its own move's flash straight to the result (skipFlash). While a run is on, the
// page keeps a copy of it (SW_KEY): after a reload or a send that never arrived, it goes in from where it stood.
import { SW, swClampX, swarmGoal, swarmMs, swarmRaw, swarmResult, swarmStart, swarmStep } from './rules.js';
import { fingLog, fingRecorder, fingUnlog } from '../shared/finger.js';
import { RUNT } from '../shared/runner.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { drawTimeBar, outlined, rr, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { cpuTurn, flashAnimating, skipFlash } from '../../ui/turns.js';

const SW_KEY = 'ttt-swarm-run';
const SW_EARLY = 700;                                            // online: a run ends this long before the turn's time is up, so it goes in before the timeout
const SW_END = 700;                                              // the end of a run (the ship blown up, the target reached) plays this long before it goes in
const FOE_COL = { drift: '#9be36a', swoop: '#e35fd0', shooter: '#f4a53c' };
const BOLT_COL = '#c76bff';
const fmtN = n => Math.floor(n + 1e-9).toLocaleString('en-US');
let swDraft = null;                                              // the run under way on this phone (swGo)
let swLive = null;                                               // the run just flown here: { sq, p, id, to, view, at } (its last moment stays on the sky while its result shows)
let swRep = null;                                                // someone else's run playing on the sky: { f, rep }
let swRaf = 0, swPaintDue = false, swReady = false, swSkipped = null;
const swSent = new Set();                                        // the kept runs sent again since this page loaded (once each)
const swId = (sq, p) => { const m = state.squares[sq].mini; return `${state.online ? state.online.matchId || state.online.game || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:swarm:${m.tries[p]}:${m.seed[p]}`; };
const swNow = sim => Math.min(sim.cfg.target, sim.n0 + sim.kills);
// Someone else's run plays first (the computer's, the other phone's): its length on screen, in ms; 0 for a run flown here.
export const swPre = f => (f && f.type === 'swarm' && f.swarm && !f.swarm.auto && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? swarmMs(f.swarm) : 0);
const swMove = fd => { const r = swarmResult(fd.sim); return { log: fingLog(fd.rec.pairs), steps: r.steps, n: r.n, end: r.end }; };
function swKeep(fd, final) {
  try { localStorage.setItem(SW_KEY, JSON.stringify({ id: fd.id, m: swMove(fd), final: !!final })); } catch (e) { /* no storage: a reload loses the run */ }
  fd.keptAt = performance.now();
}
const swKept = () => { try { return JSON.parse(localStorage.getItem(SW_KEY) || 'null'); } catch (e) { return null; } };
const swForget = () => { try { localStorage.removeItem(SW_KEY); } catch (e) { /* no storage */ } };

// ---- the run on this phone ----
export function swGo() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || sq.mini.type !== 'swarm' || sq.owner || swDraft || state.flash || state.done || state.winner || blocked()) return;
  const p = state.turn, i = state.zoom, now = performance.now();
  swDraft = { id: swId(i, p), sq: i, p, mini: sq.mini, sim: swarmStart(sq.mini, p), rec: fingRecorder(), tx: SW.w / 2, phase: 'play', at: now, last: now, acc: 0, raf: 0, ptr: null, dir: 0, kpx: 30, end: null, endAt: 0, keptAt: now };
  swLive = null;
  swKeep(swDraft, false);
  SND.play('go');
  render();
  swDraft.raf = requestAnimationFrame(swFrame);
}
function swFrame(now) {
  const fd = swDraft;
  if (!fd) return;
  fd.raf = 0;
  if (state.screen !== 'mini' || state.zoom !== fd.sq || state.winner) { swFinish(); return; }   // (taken off the square somehow: it ends where it stands)
  const dt = Math.min(0.1, Math.max(0, (now - fd.last) / 1000));
  fd.last = now;
  if (fd.phase === 'play') {
    const left = clockLeft();
    if (left != null && left <= (state.online ? SW_EARLY : 0)) { swFinish(); return; }   // the turn's time is up: the run ends here, its score kept
    if (fd.dir) swAim(fd, fd.tx + fd.dir * 9 * dt);                // (a keyboard's arrows)
    fd.acc += dt;
    while (fd.acc >= SW.step - 1e-9 && !fd.sim.end) { fd.acc -= SW.step; swStep(fd.sim, fd.rec.at(fd.sim.n, fd.tx), true); }
    if (fd.sim.end) swEnd(fd, fd.sim.end, now);
    if (now - fd.keptAt > 500) swKeep(fd, false);
    swHud(fd);
  } else if (now - fd.endAt >= SW_END) { swFinish(); return; }
  const cv = app.querySelector('canvas[data-sw="cv"]');
  if (cv) swDraw(cv, swDraftView(fd, now), now);
  fd.raf = requestAnimationFrame(swFrame);
}
// One step (this phone's own, or a replay's), with its sounds when it is this phone's.
function swStep(sim, tx, loud) {
  swarmStep(sim, tx);
  if (!loud || !sim.last) return;
  if (sim.last === 'kill') { SND.play('swPop'); haptic('tap'); } else if (sim.last === 'pew') SND.play('swPew'); else if (sim.last === 'zap') SND.play('fire');
}
// The run has ended (the ship hit, the target reached, the time cap): its end plays, then it goes in.
function swEnd(fd, end, now) {
  if (fd.phase !== 'play') return;
  fd.phase = 'end'; fd.end = end; fd.endAt = now; fd.ptr = null; fd.dir = 0;
  if (end === 'hit') { SND.play('swBlast'); haptic('error'); }
  else if (end === 'top') { SND.play('sparkle'); SND.play('won', { at: 0.3 }); haptic('success'); }
  else if (end === 'out') { SND.play('buzz'); haptic('medium'); }   // (the attempt's time limit: a buzzer, its points kept)
}
// The run goes in: as it ended, or as it stands (the time ran out, the screen went away).
export function swFinish() {
  const fd = swDraft;
  if (!fd) return;
  cancelAnimationFrame(fd.raf); swDraft = null;
  if (fd.sim.n === 0) swStep(fd.sim, fd.rec.at(0, fd.tx), false);   // (at least one step: a run of none is no run)
  const m = swMove(fd);
  swKeep(fd, true);
  swLive = { sq: fd.sq, p: fd.p, id: fd.id, to: swNow(fd.sim), view: swDraftView(fd, performance.now()), at: performance.now() };
  swSent.add(fd.id);
  if (fd.sim.kills > 0) { SND.play('ding'); haptic('medium'); } else if (fd.end !== 'hit') SND.play('thud');   // the result's own sound here (the phone that flew the run takes its flash straight to the result)
  attemptMove(m);
  render();
}
const swAim = (fd, tx) => { fd.tx = swClampX(tx); };
function swHud(fd) {
  const hud = app.querySelector('[data-sw="hud"]'), val = swNow(fd.sim), goal = fd.sim.cfg.target;
  if (hud) hud.textContent = `${fmtN(val)} / ${fmtN(goal)}`;
  const row = app.querySelector(`.swprog.${fd.p}`);
  if (!row) return;
  const w = (100 * Math.min(1, val / goal)).toFixed(2) + '%', bi = row.querySelector('.rbar i');
  if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); }
  const sm = row.querySelector('small');
  if (sm) sm.textContent = `${fmtN(val)} / ${fmtN(goal)}`;
}

// ---- what the sky shows: the run under way, a replay, the last moment, or the clean start ----
const swDraftView = (fd, now) => ({ p: fd.p, sim: fd.sim, end: fd.end, endAt: fd.endAt, tx: fd.tx });
const swStill = (mini, p) => ({ p, sim: swarmStart(mini, p), still: true });
const swReps = new WeakMap();
// Someone else's run, ready to play from its inputs (the square as it was before the run: the score and the run's number).
function swReplayOf(f) {
  if (swReps.has(f)) return swReps.get(f);
  const sq = shownSq(f.square), fg = f.swarm;
  let rep = null;
  if (sq && fg && !fg.auto) {
    const mini0 = Object.assign({}, sq.mini, { score: Object.assign({}, sq.mini.score, { [fg.by]: fg.from }), tries: Object.assign({}, sq.mini.tries, { [fg.by]: fg.try }) });
    const raw = swarmRaw(fg), ms = swarmMs(fg);
    rep = { p: fg.by, mini0, log: fingUnlog(fg.log, fg.steps, Math.ceil(SW.w * SW.q)) || [], steps: fg.steps, ms, speed: ms > 0 ? raw / ms : 1, raw };
  }
  swReps.set(f, rep);
  return rep;
}
// A replay's view at T seconds into the run (the sim stepped on to there).
function swRepView(rep, T) {
  if (!rep.sim || rep.sim.n > T / SW.step + 1) { rep.sim = swarmStart(rep.mini0, rep.p); rep.k = 0; rep.tx = rep.sim.x; rep.endAt = null; }
  const sim = rep.sim, want = Math.min(rep.steps, Math.floor(T / SW.step + 1e-6));
  while (sim.n < want && !sim.end) {
    let tx = null;
    if (rep.k < rep.log.length && rep.log[rep.k][0] === sim.n) { tx = rep.log[rep.k++][1] / SW.q; rep.tx = tx; }
    swStep(sim, tx, false);
  }
  if (sim.end && rep.endAt == null) rep.endAt = performance.now();
  return { p: rep.p, sim, end: sim.end && sim.end !== 'out' ? sim.end : null, endAt: rep.endAt, tx: rep.tx };
}
// After a render: the sky of a Star Swarm square (scheduled from screen, drawn once the new screen is in place).
function swSchedule() {
  if (swPaintDue) return;
  swPaintDue = true;
  requestAnimationFrame(() => { swPaintDue = false; swPaint(); });
}
function swPaint() {
  if (swRaf) { cancelAnimationFrame(swRaf); swRaf = 0; }
  const cv = app.querySelector('canvas[data-sw="cv"]');
  if (!cv || !['mini', 'review-mini'].includes(state.screen)) { swRep = null; return; }
  const sq = shownSq(state.zoom);
  if (!sq || sq.mini.type !== 'swarm') return;
  if (swDraft && swDraft.sq === state.zoom) { swDraw(cv, swDraftView(swDraft, performance.now()), performance.now()); return; }   // (its own loop draws it)
  if (swRepFrame(performance.now())) swRaf = requestAnimationFrame(swRepLoop);
}
function swRepLoop(now) {
  swRaf = 0;
  if (swRepFrame(now)) swRaf = requestAnimationFrame(swRepLoop);
}
// One drawing of the sky with no run under way here; true while a replay wants more frames.
function swRepFrame(now) {
  const cv = app.querySelector('canvas[data-sw="cv"]'), sq = shownSq(state.zoom);
  if (!cv || !sq || sq.mini.type !== 'swarm' || (swDraft && swDraft.sq === state.zoom)) return false;
  const f = state.flash && state.flash.square === state.zoom && state.flash.swarm ? state.flash : null;
  const pre = f ? swPre(f) : 0, start = f ? fxAt('move', f) : null;
  if (pre && start != null) {                                       // someone else's run, as it was flown (then its last moment while the result shows)
    const rep = swReplayOf(f);
    if (rep) {
      if (!swRep || swRep.f !== f) swRep = { f, rep };
      const e = Math.max(0, now - start), T = (Math.min(e, rep.ms) * rep.speed) / 1000, v = swRepView(rep, T);
      swDraw(cv, v, now);
      const hud = app.querySelector('[data-sw="hud"]');
      if (hud) hud.textContent = `${fmtN(swNow(v.sim))} / ${fmtN(v.sim.cfg.target)}`;
      return e < rep.ms + 1200;
    }
  }
  swRep = null;
  const lv = swLive && swLive.sq === state.zoom && swLive.view ? swLive : null;   // this phone's run just flown: its last moment, while it goes in and its result shows
  if (lv && (f ? f.by === lv.p : swId(state.zoom, lv.p) === lv.id && now - lv.at < 15000)) { swDraw(cv, lv.view, now); return now - lv.at < 1500; }
  swDraw(cv, swStill(sq.mini, sq.owner || (f ? f.by : state.turn)), now);
  return false;
}
function swDraw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  drawSwarm(c, W, H, v, now);
  if (swDraft && v.sim === swDraft.sim) swDraft.kpx = Math.min(W / SW.w, H / SW.h);
}

// ---- the drawing: deep space, the swarm, the shots and the ship ----
export function drawSwarm(c, W, H, v, now) {
  const P = runColours(), sim = v.sim, k = Math.min(W / SW.w, H / SW.h), ox = (W - SW.w * k) / 2, oy = (H - SW.h * k) / 2;
  const X = x => ox + x * k, Y = y => oy + (SW.h - y) * k, col = v.p === 'O' ? P.O : P.X;
  c.fillStyle = '#131a33'; c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(X(SW.w * 0.7), Y(SW.h * 0.75), 0, X(SW.w * 0.7), Y(SW.h * 0.75), SW.h * 0.5 * k);   // a faint nebula
  glow.addColorStop(0, 'rgba(120,80,200,.22)'); glow.addColorStop(1, 'rgba(120,80,200,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  const drift = (sim.t * 1.4) % SW.h;                             // the stars slide by slowly as the run goes
  for (let j = 0; j < 46; j++) {
    const sx = ox + hash01(j) * SW.w * k, sy = oy + ((hash01(j + 70) * SW.h + drift * (0.4 + hash01(j + 140))) % SW.h) * k, r = 0.6 + hash01(j + 210) * 1.3;
    c.fillStyle = `rgba(255,255,255,${(0.3 + hash01(j + 280) * 0.55).toFixed(2)})`; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(ox, Y(0.35)); c.lineTo(ox + SW.w * k, Y(0.35)); c.stroke();   // the ship's lane
  for (const b of sim.bolts) swBolt(c, X(b.x), Y(b.y), SW.boltR * k, P);
  for (const s of sim.shots) swShot(c, X(s.x), Y(s.y), k, col);
  for (const f of sim.foes) swFoe(c, X(f.x), Y(f.y), SW.foeR * k, f, sim.t, P);
  for (let i = sim.ev.length - 1; i >= 0 && i >= sim.ev.length - 8; i--) { const e = sim.ev[i], u = (sim.t - e.t) / 0.45; if (u > 1) break; swBurst(c, X(e.x), Y(e.y), k, u, e, P); }   // the bursts of the last moment
  const sx = X(sim.x), sy = Y(SW.shipY), lean = Math.max(-1, Math.min(1, ((v.tx != null ? v.tx : sim.x) - sim.x) / 1.5));
  if (v.end === 'hit' && v.endAt) swWreck(c, sx, sy, k, Math.min(1, (now - v.endAt) / SW_END), col, P);
  else swShip(c, sx, sy, k, lean, col, P, sim.t, !!v.still);
  if (v.end === 'top' && v.endAt) {                                 // the target reached: rays from the ship
    const u = Math.min(1, (now - v.endAt) / 600), R = SW.shipR * k * 1.5;
    c.strokeStyle = P.O; c.lineWidth = 3;
    for (let r = 0; r < 10; r++) { const a = (r * Math.PI) / 5; c.beginPath(); c.moveTo(sx + Math.cos(a) * R * (1.2 + u), sy + Math.sin(a) * R * (1.2 + u)); c.lineTo(sx + Math.cos(a) * R * (1.6 + 2 * u), sy + Math.sin(a) * R * (1.6 + 2 * u)); c.stroke(); }
  }
  c.fillStyle = 'rgba(0,0,0,.38)';                                 // beyond the sky's edges
  if (ox > 0.5) { c.fillRect(0, 0, ox, H); c.fillRect(ox + SW.w * k, 0, W - ox - SW.w * k, H); }
  if (oy > 0.5) { c.fillRect(0, 0, W, oy); c.fillRect(0, oy + SW.h * k, W, H - oy - SW.h * k); }
  // the attempt's time limit: a bar along the top, clear of the score at the top left (ui/runner.js drawTimeBar), while the attempt runs or replays
  if (!v.still) { const x0 = Math.round(W * 0.36); c.save(); c.translate(x0, 0); drawTimeBar(c, W - x0, H, 1 - sim.t / sim.cfg.maxSecs, P); c.restore(); }
}
function swShip(c, x, y, k, lean, col, P, t, still) {              // a stubby rocket in the player's colour: a dome, two fins, a flame
  const R = SW.shipR * k * 1.25;
  c.save(); c.translate(x, y); c.rotate(lean * 0.22);
  if (!still) {
    const fl = 0.7 + 0.3 * hash01(Math.floor(t * 30));
    c.beginPath(); c.moveTo(-R * 0.32, R * 0.75); c.lineTo(0, R * (0.75 + 1.1 * fl)); c.lineTo(R * 0.32, R * 0.75); c.closePath(); c.fillStyle = '#ffb347'; c.fill();
    c.beginPath(); c.moveTo(-R * 0.15, R * 0.75); c.lineTo(0, R * (0.75 + 0.6 * fl)); c.lineTo(R * 0.15, R * 0.75); c.closePath(); c.fillStyle = '#fff2b0'; c.fill();
  }
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * R * 0.55, R * 0.05); c.lineTo(s * R * 1.15, R * 0.85); c.lineTo(s * R * 0.45, R * 0.75); c.closePath(); outlined(c, '#5b6b8a', P.ink, 2); }
  c.beginPath(); c.moveTo(0, -R * 1.25); c.quadraticCurveTo(R * 0.78, -R * 0.3, R * 0.6, R * 0.75); c.lineTo(-R * 0.6, R * 0.75); c.quadraticCurveTo(-R * 0.78, -R * 0.3, 0, -R * 1.25); c.closePath(); outlined(c, col, P.ink, 2.4);
  c.beginPath(); c.ellipse(0, -R * 0.2, R * 0.3, R * 0.38, 0, 0, Math.PI * 2); outlined(c, '#bfe7fb', P.ink, 1.8);
  c.fillStyle = 'rgba(255,255,255,.65)'; c.beginPath(); c.ellipse(-R * 0.1, -R * 0.34, R * 0.1, R * 0.15, -0.3, 0, Math.PI * 2); c.fill();
  c.restore();
}
function swWreck(c, x, y, k, u, col, P) {                           // the ship blown up: a flash, a ring, pieces flying out
  const R = SW.shipR * k * 1.25;
  c.save(); c.translate(x, y);
  if (u < 0.25) { c.fillStyle = `rgba(255,240,200,${(1 - u / 0.25).toFixed(2)})`; c.beginPath(); c.arc(0, 0, R * (1.2 + u * 6), 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = `rgba(255,170,80,${(1 - u).toFixed(2)})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R * (0.6 + u * 3.2), 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.4, d = R * (0.4 + u * 3) * (0.8 + hash01(i) * 0.5), px = Math.cos(a) * d, py = Math.sin(a) * d + u * u * R * 2;
    c.save(); c.translate(px, py); c.rotate(u * (3 + i)); c.globalAlpha = 1 - u * 0.6;
    rr(c, -R * 0.22, -R * 0.14, R * 0.44, R * 0.28, 2); outlined(c, i % 2 ? col : '#5b6b8a', P.ink, 1.6);
    c.restore();
  }
  c.restore();
}
function swFoe(c, x, y, r, f, t, P) {
  c.save(); c.translate(x, y);
  if (f.k === 'drift') {                                           // a jelly: a round body, three bumps swinging below, eyes looking down
    const w = Math.sin(t * 6 + f.id);
    c.beginPath(); c.arc(0, 0, r, Math.PI, 0); c.lineTo(r, r * 0.3);
    for (let i = 2; i >= 0; i--) { const bx = -r + (i + 0.5) * r * 0.67; c.quadraticCurveTo(bx + r * 0.33, r * (0.9 + 0.2 * w * (i % 2 ? 1 : -1)), bx, r * 0.5); }
    c.lineTo(-r, r * 0.3); c.closePath(); outlined(c, FOE_COL.drift, P.ink, 2);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.3, -r * 0.05, r * 0.24, 0, Math.PI * 2); c.arc(r * 0.3, -r * 0.05, r * 0.24, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.ink; c.beginPath(); c.arc(-r * 0.3, r * 0.05, r * 0.11, 0, Math.PI * 2); c.arc(r * 0.3, r * 0.05, r * 0.11, 0, Math.PI * 2); c.fill();
  } else if (f.k === 'swoop') {                                    // a dart: an arrowhead along its dive, a slit of an eye
    c.rotate(Math.atan2(-f.vy, f.vx) + Math.PI / 2);
    c.beginPath(); c.moveTo(0, r * 1.25); c.lineTo(r * 0.95, -r * 0.8); c.lineTo(0, -r * 0.35); c.lineTo(-r * 0.95, -r * 0.8); c.closePath(); outlined(c, FOE_COL.swoop, P.ink, 2);
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, r * 0.25, r * 0.18, r * 0.36, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.ink; c.beginPath(); c.arc(0, r * 0.4, r * 0.1, 0, Math.PI * 2); c.fill();
  } else {                                                         // a saucer: a wide hull, a dome, one big eye, lights blinking round the rim
    c.beginPath(); c.ellipse(0, r * 0.15, r * 1.35, r * 0.5, 0, 0, Math.PI * 2); outlined(c, FOE_COL.shooter, P.ink, 2);
    c.beginPath(); c.arc(0, -r * 0.1, r * 0.62, Math.PI, 0); c.closePath(); outlined(c, '#ffd27a', P.ink, 1.8);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -r * 0.25, r * 0.28, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.ink; c.beginPath(); c.arc(0, -r * 0.18, r * 0.13, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 3; i++) { c.fillStyle = Math.floor(t * 4 + i) % 3 === 0 ? '#fff' : '#b85c1e'; c.beginPath(); c.arc((i - 1) * r * 0.8, r * 0.2, r * 0.12, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
function swShot(c, x, y, k, col) {                                  // the ship's shot: a short bolt in the player's colour with a bright core
  const w = 0.1 * k, h = 0.46 * k;
  c.fillStyle = col; rr(c, x - w, y - h / 2, 2 * w, h, w); c.fill();
  c.fillStyle = '#fff'; rr(c, x - w * 0.4, y - h * 0.4, w * 0.8, h * 0.8, w * 0.4); c.fill();
}
function swBolt(c, x, y, r, P) {                                    // a saucer's bolt: a violet drop with a glow
  c.fillStyle = 'rgba(199,107,255,.35)'; c.beginPath(); c.arc(x, y, r * 1.8, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(x, y - r * 1.5); c.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r); c.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.5); c.closePath(); outlined(c, BOLT_COL, P.ink, 1.5);
}
function swBurst(c, x, y, k, u, e, P) {                              // an enemy bursts: a ring, sparks, and what it was worth
  const col = FOE_COL[e.k] || '#fff', R = SW.foeR * k;
  c.save(); c.globalAlpha = 1 - u;
  c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(x, y, R * (0.5 + u * 2.2), 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 + e.t, d = R * (0.6 + u * 2.6); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, 0, Math.PI * 2); c.fill(); }
  c.restore();
  if (e.w > 1) {
    c.save(); c.globalAlpha = Math.min(1, 2 - 2 * u);
    c.font = `400 ${Math.max(12, Math.round(k * 0.6))}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3; c.strokeStyle = P.ink; c.fillStyle = '#fff';
    c.strokeText(`+${e.w}`, x, y - R * 0.6 - u * k * 0.8); c.fillText(`+${e.w}`, x, y - R * 0.6 - u * k * 0.8);
    c.restore();
  }
}

// ---- the square: both players' totals, the sky, a line of words, Start ----
function swTable(mini, a, o) {
  const fg = a && a.swarm ? a.swarm : null, turn = o.turn, pre = fg ? swPre(a) : 0, goal = swarmGoal(mini), l = mini.last;
  const live = swDraft && swDraft.sq === o.zoom ? swDraft : null;
  const mine = !o.view && !fg && !o.done && !cpuTurn() && !remoteTurn();   // this phone's run to fly (held through a dropped connection or a send on its way)
  const kept = mine && !live ? swResume(o.zoom, turn) : null;
  const W = p => `<b class="${p}">${N(p)}</b>`, say = v => `${fmtN(v)} / ${fmtN(goal)}`;
  const row = p => {
    const fresh = fg && a.by === p, own = live && live.p === p;
    const here = swLive && swLive.sq === o.zoom && swLive.p === p && !fresh && performance.now() - swLive.at < 20000 ? swLive : null;
    const at = own ? swNow(live.sim) : fresh ? fg.to : here && here.to > mini.score[p] ? here.to : mini.score[p];
    const grow = fresh && pre > 0, w1 = 100 * Math.min(1, at / goal), w0 = grow ? 100 * Math.min(1, fg.from / goal) : w1;
    const txt = grow ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${say(fg.from)}</span><span class="tf" style="--f:${pre}ms">${say(at)}</span></span>` : say(at);
    return `<div class="rprog swprog ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${goal}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:${RUNT.bar}ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${txt}</small></div>`;
  };
  const shown = fg || ((o.done || o.view) && l && !l.auto ? l : null), who = fg ? a.by : shown ? shown.by : turn;
  const said = shown ? swResultText(shown, goal, W(who)) : null;
  const words = fg ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is flying…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : live ? '<span></span>'
    : o.view ? (said ? `<span>${said.text}</span>` : '')
    : mine ? '<span></span>'   // (how to play is in the ? explainer; its run on its way to the server, kept for a resend: played here already, nothing to wait for)
    : `<span>${waitLine(turn)}</span>`;
  const hudV = live ? swNow(live.sim) : mini.score[fg ? a.by : o.view && l ? l.by : turn];
  const scene = `<div class="swscene" data-sw="scene" aria-label="The sky: the ship at the bottom, the swarm above"><canvas data-sw="cv"></canvas><div class="rhud" data-sw="hud">${say(hudV)}</div></div>`;
  const go = mine && !live && !kept && !o.locked;
  const btn = o.view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="swarm-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the sky never moves
  return `<div class="g-arc"><div class="swarm"><div class="rprogs">${row('X')}${row('O')}</div>${scene}<p class="atwords swwords">${words}</p></div>${btn}</div>`;
}
// What a run came to, in words (text) and whether it scored (ok).
function swResultText(s, goal, who) {
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const gain = s.to - s.from, how = s.end === 'hit' ? 'was hit' : 'ran out of time';
  if (s.to >= goal) return { text: `${who} reached ${fmtN(goal)}!`, ok: true };
  return { text: gain > 0 ? `${who} ${how} · +${fmtN(gain)} · ${fmtN(s.to)} / ${fmtN(goal)}` : `${who} ${how} · nothing scored · ${fmtN(s.to)} / ${fmtN(goal)}`, ok: gain > 0 };
}
// A run kept from before a reload (or a send that never got there): it goes in from where it stood, once.
function swResume(sq, p) {
  const k = swKept();
  if (!k) return null;
  const id = swId(sq, p);
  if (k.id !== id) { swForget(); return null; }                     // a run that already counted (or another match's)
  if (swSent.has(id) || !k.m) return null;
  setTimeout(() => {
    if (swDraft || state.flash || state.done || blocked() || state.zoom !== sq || state.screen !== 'mini' || swSent.has(id) || swId(sq, p) !== id) return;
    swSent.add(id);
    attemptMove(k.m);
    render();
  }, 0);
  return k;
}
// Its listeners, put on once, the first time the square is drawn (a view has no place in main.js's list).
function swInit() {
  if (swReady) return;
  swReady = true;
  app.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('[data-act="swarm-start"]')) ownPress();   // (Start is the game's own press: its 'go', never the click)
    const fd = swDraft;
    if (!fd || fd.phase !== 'play' || !runInputAt(e.target)) return;
    e.preventDefault(); ownPress();
    try { (e.target.closest('main.scr.mini') || e.target).setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    fd.ptr = { id: e.pointerId, x: e.clientX };
  });
  app.addEventListener('pointermove', e => {
    const fd = swDraft;
    if (!fd || fd.phase !== 'play' || !fd.ptr || fd.ptr.id !== e.pointerId) return;
    const dx = e.clientX - fd.ptr.x;
    fd.ptr.x = e.clientX;
    swAim(fd, fd.tx + dx / Math.max(1, fd.kpx));                    // one to one with the sky
  });
  const up = e => { const fd = swDraft; if (fd && fd.ptr && fd.ptr.id === e.pointerId) fd.ptr = null; };
  app.addEventListener('pointerup', up); app.addEventListener('pointercancel', up);
  ['touchstart', 'touchmove', 'touchend'].forEach(ev => app.addEventListener(ev, e => { if (swDraft && runInputAt(e.target) && e.cancelable) e.preventDefault(); }, { passive: false }));   // no scrolling, selection, magnifier or callout mid-run
  app.addEventListener('contextmenu', e => { if (swDraft && e.target && e.target.closest && e.target.closest('main.scr.mini')) e.preventDefault(); });
  document.addEventListener('keydown', e => { const fd = swDraft; if (!fd || fd.phase !== 'play') return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); fd.dir = e.key === 'ArrowLeft' ? -1 : 1; } });
  document.addEventListener('keyup', e => { const fd = swDraft; if (!fd) return; if ((e.key === 'ArrowLeft' && fd.dir < 0) || (e.key === 'ArrowRight' && fd.dir > 0)) fd.dir = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && swDraft && swDraft.phase === 'play') swFinish(); });   // the page hidden mid-run: it ends there, its score kept
}

// ---- the view's hooks ----
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  swInit();
  // A run flown on this phone has been watched already: its move's flash (whose length allows for the replay on the other
  // phone, rules.js flashMs) goes straight to its result here, once, the moment it is up.
  if (a && a.swarm && !a.swarm.auto && !a.timeout && !swPre(a) && swSkipped !== a && flashAnimating()) { swSkipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }
  swSchedule();
  return swTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
}
export const actions = { 'swarm-start': () => swGo() };
export const replay = { synth: () => [] };                        // the run is in the move itself (its inputs): nothing to press before it
// The sounds of a move, for moveSounds: someone else's run as it replays (its shots, the bursts, the saucers' bolts, its
// end), then the result for everyone: a ding for a score, a thud for none. A run flown here had its sounds live.
export function sounds(f, add, won, mini, last) {
  const fg = f.swarm;
  if (!fg) return;
  const pre = swPre(f), rep = pre ? swReplayOf(f) : null;
  if (rep) {
    const at = t => Math.round((t * 1000) / rep.speed), sim = swarmStart(rep.mini0, rep.p);
    let k = 0, n = 0;
    add('go', 0);
    while (sim.n < rep.steps && !sim.end) {
      let tx = null;
      if (k < rep.log.length && rep.log[k][0] === sim.n) tx = rep.log[k++][1] / SW.q;
      swarmStep(sim, tx);
      if (n > 220 || !sim.last) continue;
      if (sim.last === 'kill') { add('swPop', at(sim.t)); n++; } else if (sim.last === 'pew') { add('swPew', at(sim.t)); n++; } else if (sim.last === 'zap') { add('fire', at(sim.t)); n++; }
    }
    if (sim.end === 'hit') add('swBlast', at(sim.t)); else if (sim.end === 'top') add('sparkle', at(sim.t)); else if (sim.end === 'out') add('buzz', at(sim.t));
  }
  if (pre || fg.auto) add(fg.auto ? 'thud' : fg.to > fg.from ? 'ding' : 'thud', pre + 250);
}
// The miniature: deep space with a few of the swarm at the top, each player's ship below with their total as a bar, and
// under the sky each total as a number (in the page, as large as the board's other text).
export function miniature(mini, final) {
  const goal = swarmGoal(mini), label = `X at ${mini.score.X}, O at ${mini.score.O} of ${goal}`;
  const bar = (p, x) => { const w = 36 * Math.min(1, mini.score[p] / goal); return `<rect class="tswbar" x="${x}" y="36" width="36" height="7" rx="2.5"/>${w > 2 ? `<rect class="tswfill ${p}" x="${x + 1}" y="37" width="${(w - 2).toFixed(1)}" height="5" rx="1.5"/>` : ''}`; };
  const ship = (p, x) => `<path class="tswship ${p}" d="M${x} 22l-6 10h12z"/>`;
  const stars = [[8, 24], [16, 40], [40, 18], [58, 30], [72, 6], [90, 22], [94, 40], [30, 5]].map(([x, y]) => `<circle class="tswstar" cx="${x}" cy="${y}" r="0.9"/>`).join('');
  return `<div class="tswarm" aria-label="${label}"><svg viewBox="0 0 100 47" aria-hidden="true"><rect class="tswbg" x="0" y="0" width="100" height="47" rx="4"/>${stars}<circle class="tswfoe" cx="20" cy="9" r="5"/><circle class="tswfoe" cx="50" cy="7" r="5"/><circle class="tswfoe" cx="80" cy="10" r="5"/><path class="tswfoe b" d="M36 19l-5-9h10z"/><path class="tswfoe b" d="M64 20l-5-9h10z"/>${ship('X', 25)}${ship('O', 75)}${bar('X', 7)}${bar('O', 57)}</svg>`
    + `<div class="tswn" aria-hidden="true"><span class="X">${mini.score.X}</span><span class="O">${mini.score.O}</span></div></div>`;
}
export function moveText(f, who) {
  const fg = f.swarm;
  if (!fg || fg.auto) return `${who} ran out of time`;
  const g = fg.to - fg.from;
  return g > 0 ? `${who} scored ${fmtN(g)} · ${fmtN(fg.to)} / ${fmtN(fg.goal)}` : `${who} was hit · still at ${fmtN(fg.to)}`;
}
