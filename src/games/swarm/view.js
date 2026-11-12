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
import { banner, impact, jolt, puff, starPath } from '../../ui/runfx.js';
import { cpuTurn, flashAnimating, skipFlash } from '../../ui/turns.js';

const SW_KEY = 'ttt-swarm-run';
const SW_EARLY = 700;                                            // online: a run ends this long before the turn's time is up, so it goes in before the timeout
const SW_PEW_GAP = 0.13;                                         // a shot fired this soon after a burst makes no sound of its own (seconds of the run)
const SW_END = 700;                                              // the end of a run (the ship blown up, the target reached) plays this long before it goes in
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
  swDraft = { id: swId(i, p), sq: i, p, mini: sq.mini, sim: swarmStart(sq.mini, p), rec: fingRecorder(), tx: SW.w / 2, phase: 'play', at: now, last: now, acc: 0, raf: 0, ptr: null, dir: 0, kpx: 30, end: null, endAt: 0, keptAt: now, voice: swVoice() };
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
    while (fd.acc >= SW.step - 1e-9 && !fd.sim.end) { fd.acc -= SW.step; swStep(fd.sim, fd.rec.at(fd.sim.n, fd.tx), fd.voice); }
    if (fd.sim.end) swEnd(fd, fd.sim.end, now);
    if (now - fd.keptAt > 500) swKeep(fd, false);
    swHud(fd);
  } else if (now - fd.endAt >= SW_END) { swFinish(); return; }
  const cv = app.querySelector('canvas[data-sw="cv"]');
  if (cv) swDraw(cv, swDraftView(fd, now), now);
  fd.raf = requestAnimationFrame(swFrame);
}
// What a run sounds like, a step at a time (this phone's own as it flies, someone else's from its inputs: sounds):
// a fresh voice for a run; given the sim after a step, [sound, rate] or null. A burst sounds by what burst (a dart
// higher, a saucer lower); the ship fires three times a second for the whole run, so its shots are the quietest voice
// (audio/sound.js swPew), two notes in turn rather than one over and over, and a shot right after a burst is not
// heard at all: the bursts carry the rhythm, never a machine gun.
export function swVoice() {
  let shots = 0, lastAt = -1;
  return sim => {
    const l = sim.last;
    if (l === 'kill') { const e = sim.ev[sim.ev.length - 1]; lastAt = sim.t; return ['swPop', e && e.k === 'swoop' ? 1.2 : e && e.k === 'shooter' ? 0.78 : undefined]; }
    if (l === 'zap') return ['fire', undefined];
    if (l !== 'pew') return null;
    shots++;
    return sim.t - lastAt < SW_PEW_GAP ? null : ['swPew', shots % 2 ? 1 : 0.84];
  };
}
// One step (this phone's own, or a replay's), with its sounds and its buzz when it is this phone's.
function swStep(sim, tx, voice) {
  swarmStep(sim, tx);
  const s = voice && sim.last ? voice(sim) : null;
  if (s) SND.play(s[0], { rate: s[1] });
  if (voice && sim.last === 'kill') haptic('tap');                 // (thinned by the platform: bursts a moment apart are one buzz)
}
// The run has ended (the ship hit, the target reached, the time cap): its end plays, then it goes in.
function swEnd(fd, end, now) {
  if (fd.phase !== 'play') return;
  fd.phase = 'end'; fd.end = end; fd.endAt = now; fd.ptr = null; fd.dir = 0;
  if (end === 'hit') { SND.play('swBlast'); haptic('error'); }
  else if (end === 'top') { SND.play('sparkle'); haptic('success'); }   // (the square's chime comes with the result, from the move: audio/sound.js moveSounds)
  else if (end === 'out') { SND.play('buzz'); haptic('medium'); }   // (the attempt's time limit: a buzzer, its points kept)
}
// The run goes in: as it ended, or as it stands (the time ran out, the screen went away).
export function swFinish() {
  const fd = swDraft;
  if (!fd) return;
  cancelAnimationFrame(fd.raf); swDraft = null;
  if (fd.sim.n === 0) swStep(fd.sim, fd.rec.at(0, fd.tx), null);   // (at least one step: a run of none is no run)
  const m = swMove(fd);
  swKeep(fd, true);
  swLive = { sq: fd.sq, p: fd.p, id: fd.id, to: swNow(fd.sim), view: swDraftView(fd, performance.now()), at: performance.now() };
  swSent.add(fd.id);
  if (fd.sim.kills > 0) { SND.play('ding'); haptic('medium'); } else if (fd.end !== 'hit') SND.play('thud');   // the result's own sound here (the phone that flew the run takes its flash straight to the result)
  attemptMove(m);
  render();
}
const swAim = (fd, tx) => { fd.tx = swClampX(tx); };
// The count over the sky: set as the run goes (here, or a replay's), with a small pop each time it rises (from the
// burst that raised it: the text is only ever changed by a step of the run).
function swCount(val, goal) {
  const hud = app.querySelector('[data-sw="hud"]'), txt = `${fmtN(val)} / ${fmtN(goal)}`;
  if (!hud || hud.textContent === txt) return;
  hud.textContent = txt;
  if (!REDUCED && typeof hud.animate === 'function') hud.animate([{ transform: 'scale(1.24)' }, { transform: 'scale(1)' }], { duration: 190, easing: 'cubic-bezier(.4,0,.2,1)' });
}
function swHud(fd) {
  const val = swNow(fd.sim), goal = fd.sim.cfg.target;
  swCount(val, goal);
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
    swStep(sim, tx, null);
  }
  if (sim.end && rep.endAt == null) rep.endAt = performance.now();
  return { p: rep.p, sim, end: sim.end || null, endAt: rep.endAt, tx: rep.tx };
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
      swCount(swNow(v.sim), v.sim.cfg.target);
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

// ---- the drawing: deep space over the home planet, the swarm, the shots and the ship ----
// Everything on the sky is a plain function of the run as it stands and of its own clock (te: the run's seconds, running
// on through its end), so a replay draws the very frames the flier saw. The still parts (the sky's colours, the far
// stars, the ringed planet, the home planet's horizon) are painted once into a layer (swBackdrop); the near stars, the
// swarm, the shots, the bursts and the ship go over it every frame.
export const SWV = { burst: 0.5, flash: 0.1, go: 0.8, muzzle: 0.08 };   // seconds of the run's clock: an enemy's burst, its white flash, the GO! over the first moments, the flash at the ship's nose (the ship's wreck plays SW_END)
const FOE_COL = { drift: '#9be36a', swoop: '#e35fd0', shooter: '#45cfc0' };   // (never red or yellow: those are the players' ships)
const FOE_DARK = { drift: '#5aa93b', swoop: '#a8399b', shooter: '#23998e' };
const BOLT_COL = '#c76bff';
const cl01 = u => Math.max(0, Math.min(1, u)), ease = u => 1 - (1 - cl01(u)) ** 3;
let swBack = null;                                               // the still layer: { key, cv }
function swBackdrop(W, H, dpr, k, ox, oy) {
  const key = `${W}|${H}|${dpr}`;
  if (swBack && swBack.key === key) return swBack.cv;
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  const c = cv.getContext('2d'), X = x => ox + x * k, Y = y => oy + (SW.h - y) * k;
  c.scale(dpr, dpr);
  const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b1030'); sky.addColorStop(0.55, '#161d47'); sky.addColorStop(1, '#261b4f');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  for (const [x, y, r, rgb, a] of [[0.72, 0.74, 0.55, '132,88,214', 0.3], [0.2, 0.42, 0.42, '40,150,170', 0.2], [0.55, 0.2, 0.3, '214,96,150', 0.12]]) {   // three faint clouds of colour
    const g = c.createRadialGradient(X(SW.w * x), Y(SW.h * y), 0, X(SW.w * x), Y(SW.h * y), SW.h * r * k);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  for (let j = 0; j < 80; j++) {                                   // the far stars: small and still
    const a = 0.22 + hash01(j + 500) * 0.4, r = 0.45 + hash01(j + 570) * 0.6;
    c.fillStyle = j % 7 === 0 ? `rgba(255,226,190,${a.toFixed(2)})` : j % 5 === 0 ? `rgba(180,210,255,${a.toFixed(2)})` : `rgba(255,255,255,${a.toFixed(2)})`;
    c.beginPath(); c.arc(hash01(j + 300) * W, hash01(j + 400) * H, r, 0, Math.PI * 2); c.fill();
  }
  const px = X(8.7), py = Y(9.5), pr = 0.9 * k;                     // a ringed planet, far off
  c.save(); c.translate(px, py); c.rotate(-0.38);
  c.strokeStyle = 'rgba(214,200,255,.5)'; c.lineWidth = Math.max(1.5, k * 0.09); c.beginPath(); c.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, Math.PI, Math.PI * 2); c.stroke();   // the ring's far half
  c.restore();
  c.save(); c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fillStyle = '#7462c4'; c.fill(); c.clip();
  c.fillStyle = '#4a3c8f'; c.beginPath(); c.arc(px + pr * 0.45, py + pr * 0.35, pr * 1.05, 0, Math.PI * 2); c.fill();   // its night side
  c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(px - pr * 0.3, py - pr * 0.45, pr * 0.5, pr * 0.16, -0.38, 0, Math.PI * 2); c.fill();
  c.restore();
  c.save(); c.translate(px, py); c.rotate(-0.38);
  c.strokeStyle = 'rgba(232,222,255,.8)'; c.lineWidth = Math.max(1.5, k * 0.09); c.beginPath(); c.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, 0, Math.PI); c.stroke();   // and its near half, across the planet
  c.restore();
  const hx = X(SW.w / 2), hy = Y(-3.15), hrx = Math.max(W, SW.w * k) * 0.8, hry = 3.8 * k;   // home: the planet's horizon under the ship
  const air = c.createLinearGradient(0, hy - hry - k * 1.1, 0, hy - hry + k * 0.2); air.addColorStop(0, 'rgba(96,190,255,0)'); air.addColorStop(1, 'rgba(96,190,255,.28)');
  c.fillStyle = air; c.fillRect(0, hy - hry - k * 1.1, W, k * 1.5);
  const land = c.createLinearGradient(0, hy - hry, 0, hy - hry + k * 1.6); land.addColorStop(0, '#2b86a8'); land.addColorStop(1, '#14405f');
  c.beginPath(); c.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2); c.fillStyle = land; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(255,255,255,.1)';
  for (const [dx, dy, rw] of [[-0.28, 0.42, 0.16], [0.22, 0.3, 0.2], [0.02, 0.78, 0.12]]) { c.beginPath(); c.ellipse(hx + dx * SW.w * k, hy - hry + dy * k, rw * SW.w * k, k * 0.09, 0, 0, Math.PI * 2); c.fill(); }   // a few streaks of cloud
  c.restore();
  c.strokeStyle = 'rgba(190,236,255,.7)'; c.lineWidth = 2; c.beginPath(); c.ellipse(hx, hy, hrx, hry, 0, Math.PI, Math.PI * 2); c.stroke();
  swBack = { key, cv };
  return cv;
}
export function drawSwarm(c, W, H, v, now) {
  const P = runColours(), sim = v.sim, k = Math.min(W / SW.w, H / SW.h), ox = (W - SW.w * k) / 2, oy = (H - SW.h * k) / 2;
  const X = x => ox + x * k, Y = y => oy + (SW.h - y) * k, col = v.p === 'O' ? P.O : P.X;
  const te = sim.t + (v.endAt ? Math.max(0, now - v.endAt) / 1000 : 0), rd = v.endAt ? { at: v.endAt } : null;
  c.save();
  if (v.end === 'hit') jolt(c, W, H, { crash: true }, rd, now);     // the hit kicks the sky (ui/runfx.js); the time bar over it stays still
  c.fillStyle = '#0f1436'; c.fillRect(-6, -6, W + 12, H + 12);       // (under the layer: the kick never shows a bare rim)
  c.drawImage(swBackdrop(W, H, c.canvas.width / W, k, ox, oy), 0, 0, W, H);
  for (let j = 0; j < 40; j++) {                                    // the near stars slide by as the ship flies: two layers, the nearer the faster
    const near = j < 13, sp = near ? 2.7 : 1.1, sx = hash01(j) * W, sy = (hash01(j + 70) * H + sim.t * sp * k * (0.8 + 0.4 * hash01(j + 140))) % H, r = near ? 1 + hash01(j + 210) * 0.9 : 0.7 + hash01(j + 210) * 0.6;
    if (near && !v.still && !REDUCED) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(sx - r * 0.5, sy - k * 0.16, r, k * 0.16); }   // (a short faint streak behind it)
    c.fillStyle = `rgba(255,255,255,${(near ? 0.8 : 0.5).toFixed(2)})`; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
  }
  for (const b of sim.bolts) swBolt(c, X(b.x), Y(b.y), SW.boltR * k, P);
  for (const s of sim.shots) swShot(c, X(s.x), Y(s.y), k, col);
  for (const f of sim.foes) swFoe(c, X(f.x), Y(f.y), SW.foeR * k, f, sim, P);
  for (let i = sim.ev.length - 1; i >= 0 && i >= sim.ev.length - 10; i--) { const e = sim.ev[i], u = (te - e.t) / SWV.burst; if (u > 1) break; swBurst(c, X(e.x), Y(e.y), k, u, e, P); }   // the bursts of the last moment
  const sx = X(sim.x), sy = Y(SW.shipY), lean = Math.max(-1, Math.min(1, ((v.tx != null ? v.tx : sim.x) - sim.x) / 1.5));
  const shotAge = sim.n > 0 && !v.still ? sim.t - (sim.fireAt - 1 / sim.cfg.shotRate) : 9;   // since the ship's last shot (its nose flashes, the ship kicks back)
  if (v.end === 'hit' && v.endAt) {
    const u = Math.min(1, (now - v.endAt) / SW_END);
    swWreck(c, sx, sy, k, u, col, P);
    impact(c, sx, sy, SW.shipR * k * 3.2, rd, now, P, '#ffb347');
  } else swShip(c, sx, sy, k, lean, col, P, te, !!v.still, shotAge);
  if (v.end === 'top' && v.endAt) {                                 // the target reached: stars fly out from the ship
    const u = Math.min(1, (now - v.endAt) / 600), R = SW.shipR * k * 1.5;
    c.globalAlpha = 1 - u * u * u;
    for (let r = 0; r < 10; r++) { const a = (r * Math.PI) / 5 + 0.3, d = R * (1.4 + 4.6 * ease(u)); starPath(c, sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, R * (0.5 + 0.25 * ease(u)), 5, a + u * 2); outlined(c, r % 2 ? P.paper : col, P.ink, 1.8); }
    c.globalAlpha = 1;
  }
  c.fillStyle = 'rgba(4,6,20,.5)';                                 // beyond the sky's edges: the same space, dimmed, a faint line where the sky ends
  if (ox > 0.5) { c.fillRect(-3, -3, ox + 3, H + 6); c.fillRect(ox + SW.w * k, -3, W - ox - SW.w * k + 3, H + 6); c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(ox - 1, 0, 1, H); c.fillRect(ox + SW.w * k, 0, 1, H); }
  if (oy > 0.5) { c.fillStyle = 'rgba(4,6,20,.5)'; c.fillRect(-3, -3, W + 6, oy + 3); c.fillRect(-3, oy + SW.h * k, W + 6, H - oy - SW.h * k + 3); }
  c.restore();
  if (!v.still) {
    if (te < SWV.go && !v.end) banner(c, W, H, 'GO!', { at: now - te * 1000 }, now, P, 0.42, (te - (SWV.go - 0.25)) / 0.25);   // the run begins: the word pops over the empty sky and is gone before the swarm is down
    if (v.end === 'out' && v.endAt) banner(c, W, H, 'TIME!', rd, now, P, 0.42);
    else if (v.end === 'top' && v.endAt) banner(c, W, H, `${fmtN(sim.cfg.target)}!`, rd, now, P, 0.42);
    // the attempt's time limit: a bar along the top, clear of the score at the top left (ui/runner.js drawTimeBar), while the attempt runs or replays
    const x0 = Math.round(W * 0.36); c.save(); c.translate(x0, 0); drawTimeBar(c, W - x0, H, 1 - sim.t / sim.cfg.maxSecs, P); c.restore();
  }
}
function swShip(c, x, y, k, lean, col, P, t, still, shotAge) {      // a stubby rocket in the player's colour: a dome, two fins, a flame
  const R = SW.shipR * k * 1.25, kick = shotAge < SWV.muzzle ? R * 0.14 * (1 - shotAge / SWV.muzzle) : 0;
  c.save(); c.translate(x, y + kick); c.rotate(lean * 0.22);
  if (!still) {
    const fl = 0.7 + 0.3 * hash01(Math.floor(t * 30));
    c.fillStyle = 'rgba(255,150,60,.16)'; c.beginPath(); c.arc(0, R * 1.25, R * (0.6 + 0.2 * fl), 0, Math.PI * 2); c.fill();   // the engine's glow
    c.beginPath(); c.moveTo(-R * 0.34, R * 0.75); c.quadraticCurveTo(-R * 0.2, R * (0.9 + 0.6 * fl), 0, R * (0.75 + 1.15 * fl)); c.quadraticCurveTo(R * 0.2, R * (0.9 + 0.6 * fl), R * 0.34, R * 0.75); c.closePath(); c.fillStyle = '#ff9d3c'; c.fill();
    c.beginPath(); c.moveTo(-R * 0.17, R * 0.75); c.lineTo(0, R * (0.75 + 0.62 * fl)); c.lineTo(R * 0.17, R * 0.75); c.closePath(); c.fillStyle = '#fff2b0'; c.fill();
  }
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * R * 0.55, R * 0.05); c.lineTo(s * R * 1.15, R * 0.85); c.lineTo(s * R * 0.45, R * 0.75); c.closePath(); outlined(c, s < 0 ? '#73839f' : '#55647f', P.ink, 2); }
  const body = () => { c.beginPath(); c.moveTo(0, -R * 1.25); c.quadraticCurveTo(R * 0.78, -R * 0.3, R * 0.6, R * 0.75); c.lineTo(-R * 0.6, R * 0.75); c.quadraticCurveTo(-R * 0.78, -R * 0.3, 0, -R * 1.25); c.closePath(); };
  body(); c.fillStyle = col; c.fill();
  c.save(); body(); c.clip();
  c.fillStyle = 'rgba(22,18,16,.2)'; c.fillRect(R * 0.2, -R * 1.3, R, R * 2.2);                                  // its shaded side (the light from the left)
  c.fillStyle = P.paper; c.fillRect(-R, R * 0.42, R * 2, R * 0.16);                                              // a paper band round its foot
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-R * 0.36, -R * 0.35, R * 0.1, R * 0.45, 0.25, 0, Math.PI * 2); c.fill();
  c.restore();
  body(); c.lineWidth = 2.4; c.strokeStyle = P.ink; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.ellipse(0, -R * 0.2, R * 0.3, R * 0.38, 0, 0, Math.PI * 2); outlined(c, '#bfe7fb', P.ink, 1.8);
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-R * 0.1, -R * 0.34, R * 0.1, R * 0.15, -0.3, 0, Math.PI * 2); c.fill();
  if (shotAge < SWV.muzzle) { const u = shotAge / SWV.muzzle; starPath(c, 0, -R * 1.5, R * (0.6 - 0.25 * u), 4, 0.78, 0.4); c.fillStyle = `rgba(255,248,220,${(1 - u * 0.6).toFixed(2)})`; c.fill(); }   // the shot leaves: a flash at the nose
  c.restore();
}
function swWreck(c, x, y, k, u, col, P) {                           // the ship blown up: a flash, a ring, pieces flying out, smoke
  const R = SW.shipR * k * 1.25;
  c.save(); c.translate(x, y);
  if (u < 0.25) { c.fillStyle = `rgba(255,240,200,${(1 - u / 0.25).toFixed(2)})`; c.beginPath(); c.arc(0, 0, R * (1.2 + u * 6), 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = `rgba(255,170,80,${(1 - u).toFixed(2)})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R * (0.6 + ease(u) * 3.2), 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 5; i++) { const a = hash01(i + 40) * Math.PI * 2, d = R * ease(u) * (0.6 + hash01(i + 50)); puff(c, Math.cos(a) * d, Math.sin(a) * d - u * R * 1.4, R * (0.35 + 0.55 * u), 0.3 * (1 - u), '190,196,214'); }
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7 + 0.4, d = R * (0.4 + ease(u) * 3) * (0.8 + hash01(i) * 0.5), px = Math.cos(a) * d, py = Math.sin(a) * d + u * u * R * 2;
    c.save(); c.translate(px, py); c.rotate(u * (3 + i)); c.globalAlpha = 1 - u * 0.6;
    rr(c, -R * 0.22, -R * 0.14, R * 0.44, R * 0.28, 2); outlined(c, i % 3 === 0 ? P.paper : i % 2 ? col : '#5b6b8a', P.ink, 1.6);
    c.restore();
  }
  c.restore();
}
function swFoe(c, x, y, r, f, sim, P) {
  const t = sim.t, ink = P.ink;
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  if (f.k === 'drift') {                                           // a jelly: a round body, three bumps swinging below, eyes on the ship
    const w = Math.sin(t * 6 + f.id), look = Math.max(-1, Math.min(1, (sim.x - f.x) / 3));
    const body = () => { c.beginPath(); c.arc(0, 0, r, Math.PI, 0); c.lineTo(r, r * 0.3); for (let i = 2; i >= 0; i--) { const bx = -r + (i + 0.5) * r * 0.67; c.quadraticCurveTo(bx + r * 0.33, r * (0.9 + 0.2 * w * (i % 2 ? 1 : -1)), bx, r * 0.5); } c.lineTo(-r, r * 0.3); c.closePath(); };
    body(); c.fillStyle = FOE_COL.drift; c.fill();
    c.save(); body(); c.clip(); c.fillStyle = FOE_DARK.drift; c.fillRect(-r, r * 0.32, r * 2, r); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.4, -r * 0.55, r * 0.34, r * 0.16, -0.5, 0, Math.PI * 2); c.fill(); c.restore();
    body(); c.lineWidth = 2; c.strokeStyle = ink; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.32, -r * 0.02, r * 0.25, 0, Math.PI * 2); c.arc(r * 0.32, -r * 0.02, r * 0.25, 0, Math.PI * 2); c.fill();
    c.fillStyle = ink; c.beginPath(); c.arc(-r * 0.32 + look * r * 0.1, r * 0.08, r * 0.12, 0, Math.PI * 2); c.arc(r * 0.32 + look * r * 0.1, r * 0.08, r * 0.12, 0, Math.PI * 2); c.fill();
  } else if (f.k === 'swoop') {                                    // a dart: an arrowhead along its dive, its light side and its dark, a slit of an eye, a streak behind
    c.rotate(Math.atan2(-f.vy, f.vx) + Math.PI / 2);
    c.fillStyle = 'rgba(227,95,208,.28)'; c.beginPath(); c.moveTo(-r * 0.45, -r * 0.6); c.lineTo(0, -r * 2.5); c.lineTo(r * 0.45, -r * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, r * 1.25); c.lineTo(r * 0.95, -r * 0.8); c.lineTo(0, -r * 0.35); c.lineTo(-r * 0.95, -r * 0.8); c.closePath(); c.fillStyle = FOE_COL.swoop; c.fill();
    c.beginPath(); c.moveTo(0, r * 1.25); c.lineTo(r * 0.95, -r * 0.8); c.lineTo(0, -r * 0.35); c.closePath(); c.fillStyle = FOE_DARK.swoop; c.fill();
    c.beginPath(); c.moveTo(0, r * 1.25); c.lineTo(r * 0.95, -r * 0.8); c.lineTo(0, -r * 0.35); c.lineTo(-r * 0.95, -r * 0.8); c.closePath(); c.lineWidth = 2; c.strokeStyle = ink; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, r * 0.25, r * 0.19, r * 0.36, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = ink; c.beginPath(); c.arc(0, r * 0.42, r * 0.11, 0, Math.PI * 2); c.fill();
  } else {                                                         // a saucer: a wide hull, a glass dome, one big eye on the ship, lights round the rim; its belly glows before a bolt drops
    const look = Math.max(-1, Math.min(1, (sim.x - f.x) / 2)), charge = f.phase === 'hover' ? cl01(1 - (f.fireAt - t) / 0.4) : 0;
    if (charge > 0) { c.fillStyle = `rgba(199,107,255,${(0.55 * charge).toFixed(2)})`; c.beginPath(); c.arc(0, r * 0.62, r * (0.25 + 0.4 * charge), 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(0, -r * 0.1, r * 0.72, Math.PI, 0); c.closePath(); outlined(c, '#d9f4ff', ink, 1.8);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -r * 0.42, r * 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = ink; c.beginPath(); c.arc(look * r * 0.12, -r * 0.37, r * 0.16, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, r * 0.15, r * 1.35, r * 0.5, 0, 0, Math.PI * 2); c.fillStyle = FOE_COL.shooter; c.fill();
    c.save(); c.clip(); c.fillStyle = FOE_DARK.shooter; c.fillRect(-r * 1.4, r * 0.28, r * 2.8, r * 0.5); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.45, -r * 0.12, r * 0.5, r * 0.1, -0.1, 0, Math.PI * 2); c.fill(); c.restore();
    c.beginPath(); c.ellipse(0, r * 0.15, r * 1.35, r * 0.5, 0, 0, Math.PI * 2); c.lineWidth = 2; c.strokeStyle = ink; c.stroke();
    for (let i = 0; i < 3; i++) { c.fillStyle = Math.floor(t * 4 + i) % 3 === 0 ? '#fff' : '#13655e'; c.beginPath(); c.arc((i - 1) * r * 0.8, r * 0.2, r * 0.12, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
function swShot(c, x, y, k, col) {                                  // the ship's shot: a short bolt in the player's colour with a bright core and a fading tail
  const w = 0.11 * k, h = 0.5 * k;
  c.globalAlpha = 0.3; c.fillStyle = col; rr(c, x - w * 0.7, y - h * 0.2, w * 1.4, h * 1.5, w * 0.7); c.fill(); c.globalAlpha = 1;
  c.fillStyle = col; rr(c, x - w, y - h / 2, 2 * w, h, w); c.fill();
  c.fillStyle = '#fff'; rr(c, x - w * 0.42, y - h * 0.4, w * 0.84, h * 0.7, w * 0.4); c.fill();
}
function swBolt(c, x, y, r, P) {                                    // a saucer's bolt: a violet drop with a glow and a tail
  c.fillStyle = 'rgba(199,107,255,.3)'; c.beginPath(); c.arc(x, y, r * 2, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(199,107,255,.35)'; c.beginPath(); c.moveTo(x - r * 0.5, y - r); c.lineTo(x, y - r * 3.4); c.lineTo(x + r * 0.5, y - r); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x, y - r * 1.5); c.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r); c.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.5); c.closePath(); outlined(c, BOLT_COL, P.ink, 1.5);
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x - r * 0.15, y + r * 0.1, r * 0.3, 0, Math.PI * 2); c.fill();
}
function swBurst(c, x, y, k, u, e, P) {                              // an enemy bursts: a flash, a ring, its pieces flying out, and what it was worth
  const col = FOE_COL[e.k] || '#fff', R = SW.foeR * k, n = e.k === 'shooter' ? 10 : 7, q = ease(u);
  c.save();
  if (u < SWV.flash / SWV.burst) { const f = u / (SWV.flash / SWV.burst); starPath(c, x, y, R * (1.1 + 0.9 * f), 8, e.t * 5, 0.6); c.fillStyle = `rgba(255,255,255,${(1 - f * f).toFixed(2)})`; c.fill(); }
  c.globalAlpha = 1 - u;
  c.strokeStyle = col; c.lineWidth = 1 + 3 * (1 - u); c.beginPath(); c.arc(x, y, R * (0.5 + q * 2), 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n + hash01(e.t * 13 + i) * 0.9, d = R * (0.4 + q * (1.6 + 1.3 * hash01(e.t * 7 + i * 3))), s = R * 0.36 * (1 - u * 0.7);
    c.fillStyle = i % 3 === 0 ? '#fff' : i % 3 === 1 ? col : FOE_DARK[e.k] || col;
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d + u * u * R * 0.8, s, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.save(); c.globalAlpha = Math.min(1, 2.2 - 2.2 * u);                // what it was worth, rising off it
  const px = Math.max(11, Math.round(k * (e.w > 2 ? 0.74 : e.w > 1 ? 0.64 : 0.52))), ty = y - R * 0.7 - q * k * 0.9, sc = 0.6 + 0.4 * Math.min(1, u / 0.12);
  c.translate(x, ty); c.scale(sc, sc);
  c.font = `400 ${px}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = 3.5; c.strokeStyle = P.ink; c.fillStyle = e.w > 1 ? '#fff' : 'rgba(255,255,255,.85)';
  c.strokeText(`+${e.w}`, 0, 0); c.fillText(`+${e.w}`, 0, 0);
  c.restore();
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
    const voice = swVoice();
    let k = 0, n = 0;
    add('go', 0);
    while (sim.n < rep.steps && !sim.end) {
      let tx = null;
      if (k < rep.log.length && rep.log[k][0] === sim.n) tx = rep.log[k++][1] / SW.q;
      swarmStep(sim, tx);
      const snd = sim.last ? voice(sim) : null;
      if (snd && n++ < 220) add(snd[0], at(sim.t), snd[1]);
    }
    if (sim.end === 'hit') add('swBlast', at(sim.t)); else if (sim.end === 'top') add('sparkle', at(sim.t)); else if (sim.end === 'out') add('buzz', at(sim.t));
  }
  if (pre || fg.auto) add(fg.auto ? 'thud' : fg.to > fg.from ? 'ding' : 'thud', pre + 250);
}
// The miniature: deep space with a few of the swarm at the top (a jelly or two, darts, a saucer), each player's ship
// below them firing up, their total as a bar under it, and under the sky each total as a number (in the page, as large
// as the board's other text).
export function miniature(mini, final) {
  const goal = swarmGoal(mini), label = `X at ${mini.score.X}, O at ${mini.score.O} of ${goal}`;
  const bar = (p, x) => { const w = 36 * Math.min(1, mini.score[p] / goal); return `<rect class="tswbar" x="${x}" y="36" width="36" height="7" rx="2.5"/>${w > 2 ? `<rect class="tswfill ${p}" x="${x + 1}" y="37" width="${(w - 2).toFixed(1)}" height="5" rx="1.5"/>` : ''}`; };
  const ship = (p, x) => `<g class="tswship ${p}"><rect class="tswshot" x="${x - 0.8}" y="12.5" width="1.6" height="3.6" rx=".8"/><path class="tswfl" d="M${x - 1.9} 31l1.9 3.4 1.9-3.4z"/><path class="tswfin" d="M${x - 3} 26l-3.4 5h4.4zM${x + 3} 26l3.4 5h-4.4z"/><path class="tswhull" d="M${x} 18.5q4.6 5 3.4 12.5h-6.8q-1.2-7.5 3.4-12.5z"/><circle class="tswwin" cx="${x}" cy="25.3" r="1.6"/></g>`;
  const jelly = (x, y) => `<path class="tswfoe" d="M${x - 4.5} ${y + 1}a4.5 4.5 0 0 1 9 0v1.6q-.75 2.3-1.5 0q-.75 2.3-1.5 0q-.75 2.3-1.5 0q-.75 2.3-1.5 0q-.75 2.3-1.5 0q-.75 2.3-1.5 0z"/><circle class="tsweye" cx="${x - 1.7}" cy="${y + 0.3}" r="1.25"/><circle class="tsweye" cx="${x + 1.7}" cy="${y + 0.3}" r="1.25"/>`;
  const dart = (x, y) => `<path class="tswfoe b" d="M${x} ${y + 5}l-4.2-8.5 4.2 2 4.2-2z"/>`;
  const saucer = (x, y) => `<path class="tswdome" d="M${x - 3.2} ${y}a3.2 3.2 0 0 1 6.4 0z"/><ellipse class="tswfoe c" cx="${x}" cy="${y + 1.4}" rx="7" ry="2.6"/>`;
  const stars = [[8, 22], [14, 31], [41, 24], [50, 30], [59, 21], [70, 14], [91, 20], [95, 31], [30, 4], [66, 4]].map(([x, y], i) => `<circle class="tswstar" cx="${x}" cy="${y}" r="${i % 3 ? 0.7 : 1}"/>`).join('');
  return `<div class="tswarm" aria-label="${label}"><svg viewBox="0 0 100 47" aria-hidden="true"><rect class="tswbg" x="0" y="0" width="100" height="47" rx="4"/><ellipse class="tswneb" cx="70" cy="14" rx="26" ry="13"/>${stars}${jelly(14, 7.5)}${jelly(49, 6)}${saucer(85, 7)}${dart(37, 13.5)}${dart(62, 14.5)}${ship('X', 25)}${ship('O', 75)}${bar('X', 7)}${bar('O', 57)}</svg>`
    + `<div class="tswn" aria-hidden="true"><span class="X">${mini.score.X}</span><span class="O">${mini.score.O}</span></div></div>`;
}
export function moveText(f, who) {
  const fg = f.swarm;
  if (!fg || fg.auto) return `${who} ran out of time`;
  const g = fg.to - fg.from;
  return g > 0 ? `${who} scored ${fmtN(g)} · ${fmtN(fg.to)} / ${fmtN(fg.goal)}` : `${who} was hit · still at ${fmtN(fg.to)}`;
}
