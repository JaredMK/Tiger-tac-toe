// The runner framework (Dash, Lane Rush, Flap, Chopper): the run in real time, its inputs, the canvas
// and the result bars.
import { RUN, RUNT, RUN_TYPES, runCourse, runJump, runLane, runRelease, runLimit, runReplayTo, runReplayer, runResult, runStart, runStep, runStepOf, runUnlog, setRunConfig } from '../games/shared/runner.js';
import { drawCave } from '../games/chopper/view.js';
import { drawDash } from '../games/dash/view.js';
import { FLAP } from '../games/flap/rules.js';
import { drawFlap } from '../games/flap/view.js';
import { drawLane } from '../games/lane/view.js';
import { SND, ownPress } from '../audio/sound.js';
import { haptic } from '../net/platform.js';
import { finishSvg, tokSvg } from './thumbs.js';
import { FIREBASE_CONFIG, configured } from '../net/connect.js';
import { attemptMove } from '../net/moves.js';
import { blocked } from '../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from './app.js';
import { shownSq } from './chaos.js';
import { clockLeft } from './clock.js';
import { KEY } from './config.js';
import { fxAt, fxAttr } from './fx.js';
import { lateAt } from './progress.js';
import { render } from './render.js';
import { banner, jolt, runEvents, runOverlay } from './runfx.js';

// Dash, Lane Rush, Flap and Chopper: the run is played here, in real time, on a canvas. The engine's
// runStep is the physics (the same the tests step: whole fixed steps, the inputs between them), this is
// the loop, the drawing and the inputs. A run: the Run button, a 3-2-1 count, the grace stretch, then
// the course until a crash, the finish, or the turn's time running out; the result goes in as one move
// ({ dist, ms, log, steps }: the engine's sim records every input it takes, and the move carries them as
// its log). Someone else's run (the computer's, the other phone's) is played back on the scene from
// that log, step for step at its own speed, with its sounds, the crash or the finish, and then its
// result (runPre: how long that takes; the result and the bar's growth wait for it). The difficulty
// comes from config/run in the database (the admin's dashboard), fetched at every start and kept for
// the next visit.
const RUN_KEY = KEY + '.runcfg';
export function fetchRunConfig() {
  try { const v = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); if (v && typeof v === 'object') setRunConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/run.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/run.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setRunConfig(v);
      try { localStorage.setItem(RUN_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
export const fmtM = n => Math.round(n).toLocaleString('en-US');
// The run under way on this phone: the square, the player, the engine's sim, and the phase: 'count'
// (3-2-1), 'run', 'crash' (the tumble or spin-out playing), 'finish' (the flourish). at: when the phase
// began; last: the last frame's time.
export let runDraft = null;
// The run just made on this phone: its bar filled as it went, so its result does not grow it again from
// the start (the other phone, which never saw the run, sees the bar grow); while the move is on its way
// to the server, the bar stays where the run ended.
let runLive = null;
// Someone else's run playing back on the scene: the flash it belongs to, the engine's replay (the sim,
// its log and where it is in it), when the run ended on screen (the tumble or the flourish plays from
// then), and the frame loop.
export let runShow = null;
// How the last run seen here ended (the chopper's height, the car's lane): while its result shows, the scene at rest
// keeps the wreck where it came down (the flash carries the distance alone).
let runPose = null;
// How long someone else's run takes to play back here, in ms: the run itself (its steps at the game's
// step) and the crash's tumble or the finish's flourish; 0 when there is nothing to play (this phone's
// own run, a timed-out player's, a move from before the log, reduced motion).
export function runPre(f) {
  const r = f && RUN_TYPES.includes(f.type) && f.run ? f.run : null;
  if (!r || typeof r.log !== 'string' || !Number.isInteger(r.steps) || f.timeout || REDUCED || !(state.online ? f.by !== state.online.me : cpuPlays(f.by))) return 0;
  return Math.round(r.steps * runStepOf(f.type) * 1000) + (r.done ? 500 : r.out ? 0 : 700);
}
const RUN_TEXT = {
  dash: { note: 'Tap to jump, hold to jump higher. Stay down for the flyers.', hint: 'Tap to jump · hold for higher', scene: 'The course, from the side', go: 'Run', verb: 'ran' },
  lane: { note: 'Swipe left or right to change lanes, or tap a side.', hint: 'Swipe to change lanes', scene: 'The road, from behind and above', go: 'Run', verb: 'ran' },
  flap: { note: 'Tap to flap. Fly through the gaps in the posts.', hint: 'Tap to flap', scene: 'The sky, from the side', go: 'Fly', verb: 'flew' },
  chopper: { note: 'Hold to climb, let go to drop. Keep off the walls and the blocks.', hint: 'Hold to climb · let go to drop', scene: 'The cave, from the side', go: 'Fly', verb: 'flew' },
};
const RUN_PRESS = { dash: 'jump', flap: 'flap', chopper: 'rotor' };   // the press's sound (Lane Rush: a swipe, its skid)
export function runTable(mini, a, o) {
  const r = a && a.run ? a.run : null, l = mini.last, turn = o.turn, T = mini.cfg.target, type = mini.type, pre = r && a === state.flash ? runPre(a) : 0;   // (someone else's run plays on the scene first)
  const start = pre ? fxAt('move', a) : null, playing = pre > 0 && (start == null || performance.now() - start < pre);   // (their run still playing: the bar and the counter follow it, from runShowFrame)
  const ranHere = p => runLive && runLive.sq === o.zoom && runLive.p === p && performance.now() - runLive.at < 20000 ? runLive : null;
  if (runDraft && (runDraft.sq !== o.zoom || r || o.view || o.locked)) runStop();   // another square, or the result on show: no run under way here
  const live = runDraft && runDraft.sq === o.zoom ? runDraft : null;
  const mine = !o.view && !r && !o.locked;
  const bar = p => {
    const fresh = r && a.by === p, mine = ranHere(p), at = fresh ? (playing ? r.from : r.to) : mine && !r && mine.to > mini.dist[p] ? mine.to : mini.dist[p];
    const seen = fresh && (pre > 0 || (mine && Math.abs(mine.to - r.to) < 1));   // this phone watched the bar fill during the run (its own, or the replay of someone else's)
    const w1 = 100 * Math.min(1, at / T), w0 = fresh && !seen ? 100 * Math.min(1, r.from / T) : w1;
    return `<div class="rprog ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.round(at)}" aria-valuemax="${T}"><i class="${fresh && !seen ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:${RUNT.bar}ms"></i></div><small>${fmtM(at)} / ${fmtM(T)} m</small></div>`;
  };
  const who = r ? a.by : turn;
  const TX = RUN_TEXT[type];
  const res = r ? `<p ${lateAt('arcres ' + (r.done ? 'ok' : 'no'), pre)} role="status">${r.done ? `<b class="${a.by}">${N(a.by)}</b> reached ${fmtM(T)} m!` : `<b class="${a.by}">${N(a.by)}</b> <span class="rnw">${TX.verb} ${fmtM(r.to - r.from)} m</span> <span class="rnw">— now at ${fmtM(r.to)}/${fmtM(T)}</span>`}</p>`
    : o.view ? `<p class="arcnote">${l ? `<b class="${l.by}">${N(l.by)}</b> ${l.done ? 'reached the finish' : `${TX.verb} ${fmtM(l.to - l.from)} m`}` : ''}</p>`
    : live ? '<p class="arcnote"></p>'
    : mine ? '<p class="arcnote"></p>'
    : `<p class="arcnote">${waitLine(turn)}</p>`;   // (this phone's own run on its way to the server: nothing to wait for)
  const hint = '';   // (no hint over the run: how to play is in the ? explainer)
  const count = live && live.phase === 'count' ? `<div class="rcount"${fxAttr(Math.round(live.at + (RUN.countdown - live.count) * 1000), 'rt')} aria-live="assertive"><b>${live.count > 0 ? live.count : 'GO!'}</b></div>` : '';   // (each digit pops in from its own second: a redraw mid-count never starts it over)
  const hud = `<div class="rhud" data-run="hud">${fmtM(live ? live.sim.d : r ? (playing ? r.from : r.to) : mini.dist[who])} m</div>`;
  const scene = `<div class="rscene ${type}" data-run="scene" aria-label="${TX.scene}"><canvas data-run="cv"></canvas>${hud}${count}${hint}</div>`;
  const btn = o.view ? '' : `<div class="cbtns one${mine && !live ? '' : ' hold'}"><button class="big ${turn}" data-act="run-go"${mine && !live ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>${TX.go}${mini.dist[turn] > 0 ? ` on from ${fmtM(mini.dist[turn])} m` : ''}</button></div>`;   // always there (hidden while it can't be used), so the course never moves
  return `<div class="g-arc"><div class="runner"><div class="rprogs">${bar('X')}${bar('O')}</div>${scene}${res}</div>${btn}</div>`;
}
// Run: the count starts; the run itself starts when it ends.
export function runGo() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || !RUN_TYPES.includes(sq.mini.type) || sq.owner || state.flash || state.done || blocked() || runDraft) return;
  const p = state.turn, sim = Object.assign(runStart(sq.mini, p), { p });
  runDraft = { sq: state.zoom, p, sim, phase: 'count', at: performance.now(), last: performance.now(), count: RUN.countdown, swiped: false, pointer: null, x0: 0, scene: null, hintGone: false, frames: 0, raf: 0, ev: {} };   // ev: what the run's events have sounded so far (runfx.js runEvents)
  SND.play('beep');
  render();
  runDraft.raf = requestAnimationFrame(runFrame);
}
function runStop() { if (!runDraft) return; runRotor(false); cancelAnimationFrame(runDraft.raf); runDraft = null; }
function runFrame(now) {
  const rd = runDraft;
  if (!rd) return;
  if (state.screen !== 'mini' || state.zoom !== rd.sq || state.flash || state.done || state.winner) { runStop(); return; }
  const dt = Math.min(0.1, Math.max(0, (now - rd.last) / 1000));
  rd.last = now; rd.frames++;
  if (rd.phase === 'count') {
    const left = RUN.countdown - (now - rd.at) / 1000, n = Math.ceil(left);
    if (left <= 0) { rd.phase = 'run'; rd.at = now; rd.count = 0; SND.play('go'); render(); }
    else if (n !== rd.count) { rd.count = n; SND.play('beep'); render(); }       // the next digit, with its beep
  } else if (rd.phase === 'run') {
    runStep(rd.sim, dt);
    for (const s of runEvents(rd.sim, rd.ev)) SND.play(s);                        // a landing, an obstacle cleared: each once, as it happens
    runHud(rd.sim, rd.p, Infinity);
    if (rd.sim.t >= 1.6 && !rd.hintGone) { rd.hintGone = true; const h = app.querySelector('.rhint'); if (h) h.remove(); }
    const left = clockLeft();
    if (rd.sim.crash) { rd.phase = 'crash'; rd.at = now; runRotor(false); SND.play('crash'); haptic('error'); }   // (this phone's own run: its buzz with its sound)
    else if (rd.sim.done) { rd.phase = 'finish'; rd.at = now; SND.play('sparkle'); haptic('medium'); }
    else if (left != null && left <= 0) { runEnd(true); return; }                 // the turn's time ran out mid-run: it ends here, the distance saved
  } else if (now - rd.at >= (rd.phase === 'crash' ? 700 : 500)) { runEnd(false); return; }   // the tumble, the spin-out or the flourish has played
  const cv = app.querySelector('canvas[data-run="cv"]');
  if (cv) runFrameDraw(cv, rd.sim, rd, now, true);
  rd.raf = requestAnimationFrame(runFrame);
}
// The counter and the runner's own bar follow a run as it goes (this phone's, or someone else's playing
// back), the counter never past `cap` (a replay's end).
function runHud(sim, p, cap) {
  const d = Math.min(sim.d, cap), hud = app.querySelector('[data-run="hud"]');
  if (hud) hud.textContent = fmtM(d) + ' m';
  const own = app.querySelector(`.rprog.${p}`);
  if (!own) return;
  const w = (100 * Math.min(1, d / sim.cfg.target)).toFixed(2) + '%', bi = own.querySelector('.rbar i'), sm = own.querySelector('small');
  if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); }
  if (sm) sm.textContent = `${fmtM(d)} / ${fmtM(sim.cfg.target)} m`;
}
// The run is over: its end, its time and its log go in as the move (online, the server plays the log
// through and checks the end against it).
export function runEnd(out) {
  const rd = runDraft;
  if (!rd) return;
  runRotor(false); cancelAnimationFrame(rd.raf); runDraft = null;
  const res = runResult(rd.sim, out);
  runLive = { sq: rd.sq, p: rd.p, to: res.dist, at: performance.now() };
  runPose = { sq: rd.sq, p: rd.p, to: res.dist, y: rd.sim.y, lane: rd.sim.lane };
  attemptMove(res);
}
// After every render: the canvas of a runner square shows the run under way, someone else's run playing
// back, or the runner standing at the saved distance (after a move: where it ended) with the course ahead.
export function runPaint() {
  const cv = app.querySelector('canvas[data-run="cv"]');
  if (!cv || state.screen !== 'mini') return;
  const sq = shownSq(state.zoom);
  if (!sq || !RUN_TYPES.includes(sq.mini.type)) return;
  if (runDraft && runDraft.sq === state.zoom) { runFrameDraw(cv, runDraft.sim, runDraft, performance.now(), true); return; }
  const f = state.flash, r = f && f.run ? f.run : null, p = r ? f.by : sq.owner || state.turn;
  const pre = r ? runPre(f) : 0, start = pre ? fxAt('move', f) : null;
  if (pre && start != null && performance.now() - start < pre) {   // someone else's run, played back on the scene first
    if (!runShow || runShow.f !== f) {
      const m = Object.assign({}, sq.mini, { dist: Object.assign({}, sq.mini.dist, { [p]: r.from }) }), rep = runReplayer(m, p, runUnlog(r.log, r.steps) || [], r.steps);
      rep.sim.p = p;
      runShowStop();
      runShow = { f, rep, endAt: null, raf: 0, rotor: null };
    }
    cancelAnimationFrame(runShow.raf); runShowFrame(performance.now());
    return;
  }
  runShowStop();
  const sim = Object.assign(runStart(sq.mini, p), { p, d: r ? r.to : sq.mini.dist[p] });   // at rest: the course as Start would show it (the stretch ahead clear), no crash
  if (r && !r.done) {
    sim.course = runCourse(sq.mini, p); sim.crash = { at: r.to, ob: null }; sim.grace = 0; if (sim.type === 'flap') sim.y = FLAP.box.h / 2;
  }   // the crash just made, while its result shows: down on the ground (the course as it was)
  const ps = r && runPose && runPose.sq === state.zoom && runPose.p === p && Math.abs(runPose.to - r.to) < 0.02 ? runPose : null;   // the run just seen here: its runner where it ended
  if (ps && sim.type === 'chopper') { sim.y = ps.y; sim.grace = 0; }
  if (ps && sim.type === 'flap' && r.done) sim.y = ps.y;
  if (ps && sim.type === 'lane') { sim.lane = ps.lane; sim.laneFrom = ps.lane; sim.laneT = 1; }
  if ((r && r.done) || sim.d >= sq.mini.cfg.target) sim.done = true;
  runFrameDraw(cv, sim, null, performance.now());
}
function runShowStop() { if (!runShow) return; cancelAnimationFrame(runShow.raf); showRotor(false); runShow = null; }
function showRotor(on) {
  const rs = runShow;
  if (on) { if (rs && !rs.rotor && !document.hidden) rs.rotor = SND.loop('rotor'); return; }
  if (rs && rs.rotor) { rs.rotor.stop(); rs.rotor = null; }
}
// One frame of someone else's run: the replay stepped to the time since the move's event (whole steps
// at the game's step, the logged inputs going in before theirs), drawn as a live run is (the tumble or
// the flourish from the moment it ended), the counter and their bar following; then the scene at rest.
function runShowFrame(now) {
  const rs = runShow, f = state.flash;
  if (!rs || rs.f !== f || state.screen !== 'mini' || state.zoom !== f.square) { runShowStop(); return; }
  const pre = runPre(f), start = fxAt('move', f);
  if (!pre || start == null || now - start >= pre) { const end = runReplayTo(rs.rep, rs.rep.steps); runPose = { sq: f.square, p: f.by, to: f.run.to, y: end.y, lane: end.lane }; runShowStop(); runPaint(); return; }
  const sim = rs.rep.sim;
  runReplayTo(rs.rep, Math.floor((now - start) / 1000 / runStepOf(sim.type) + 1e-6));
  const over = sim.crash || sim.done || sim.n >= rs.rep.steps;
  if (over && rs.endAt == null) rs.endAt = now;
  if (sim.type === 'chopper') showRotor(sim.held && !over);                       // their rotor, heard while they held (a loop cannot be scheduled ahead: it follows the replay's frames, and Skip cuts it with the rest)
  const cv = app.querySelector('canvas[data-run="cv"]');
  if (cv) runFrameDraw(cv, sim, over && (sim.crash || sim.done) ? { at: rs.endAt } : null, now, true);
  runHud(sim, f.by, f.run.to);
  rs.raf = requestAnimationFrame(runShowFrame);
}
// ---- the inputs: on the scene, from pointerdown (no waiting for a click) ----
// Anywhere on the mini-game screen counts (above, on or below the course), except the header's buttons.
export const runInputAt = t => !!(t && t.closest && t.closest('main.scr.mini') && !t.closest('.bar, .flash.pause'));
// The chopper's rotor: one sound looping for as long as the press is held.
function runRotor(on) {
  const rd = runDraft;
  if (on) { if (rd && !rd.rotor) rd.rotor = SND.loop('rotor'); return; }
  if (rd && rd.rotor) { rd.rotor.stop(); rd.rotor = null; }
}
function runPointerUp(e) {
  const rd = runDraft;
  if (!rd || rd.pointer !== e.pointerId) return;
  rd.pointer = null;
  if (rd.sim.type !== 'lane') { runRelease(rd.sim); runRotor(false); return; }
  if (rd.phase !== 'run' || rd.swiped || !rd.scene) return;
  const box = rd.scene.getBoundingClientRect();                 // a tap: the side of the road it is on
  if (runLane(rd.sim, e.clientX < box.left + box.width / 2 ? -1 : 1)) { SND.play('skid'); haptic('tap'); }
}

// ---- the drawing: the game's own look (bold ink outlines, flat paper colours), nothing borrowed ----
let runPal = null;
export function runColours() {
  if (runPal) return runPal;
  const cs = getComputedStyle(document.documentElement), v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  runPal = { ink: v('--ink', '#161210'), paper: v('--paper', '#fff8e8'), X: v('--x', '#e5432a'), O: v('--o', '#f6c21b'), green: v('--green', '#4e9d3a'), sky: v('--sky', '#58a8cf') };
  return runPal;
}
export function runCanvas(cv) {                                           // the canvas at its box's size, in device pixels
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = r.width, H = r.height;
  if (cv.offsetWidth > 0 && Math.abs(cv.offsetWidth - W) > 1.5) { W = cv.offsetWidth; H = cv.offsetHeight; }   // (the zoom into a square scales the screen for a moment, ui/fx.js: its layout size, never the scaled one)
  const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, W, H };
}
function runFrameDraw(cv, sim, rd, now, bar) {   // bar: a run under way or replayed here: its time limit's countdown over the scene
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  c.save();
  jolt(c, W, H, sim, rd, now);                                                   // (a crash kicks the scene; the words and the time bar over it stay still)
  (sim.type === 'dash' ? drawDash : sim.type === 'flap' ? drawFlap : sim.type === 'chopper' ? drawCave : drawLane)(c, W, H, sim, rd, now);
  c.restore();
  runOverlay(c, W, H, sim, rd, now, runColours());
  if (rd && rd.phase === 'run' && now - rd.at < 700) banner(c, W, H, 'GO!', rd, now, runColours(), 0.42, (now - rd.at - 580) / 120);   // the count's last word, as the run starts
  if (bar) drawTimeBar(c, W, H, 1 - sim.t / runLimit(sim.cfg, sim.type));
}
export const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
export const outlined = (c, fill, ink, w) => { c.fillStyle = fill; c.fill(); c.lineWidth = w || 2.5; c.strokeStyle = ink; c.stroke(); };
// The attempt's time limit (November 2026: every real-time skill game's own setting, its meta.js TUNE): a slim bar across
// the top of the play area's canvas, full as the attempt starts and empty as its time runs out (the attempt then ends as
// a crash would, its progress kept). left: the share of the time still to go, 0 to 1 (from the attempt's own clock, so a
// replay shows the time as it ran). Drawn on the canvas with the rest of the frame: never a render, never a layout change.
export function drawTimeBar(c, W, H, left, P) {
  const f = Math.max(0, Math.min(1, left)), h = Math.max(5, Math.round(Math.min(W, H) * 0.016)), m = Math.max(4, h), w = W - 2 * m;
  if (w < 20) return;
  P = P || runColours();
  c.save();
  c.fillStyle = 'rgba(22, 18, 16, .28)'; c.beginPath(); c.roundRect(m, m, w, h, h / 2); c.fill();
  if (f > 0) { c.fillStyle = f <= 0.25 ? '#e0434f' : f <= 0.5 ? '#f0a020' : '#3aa35a'; c.beginPath(); c.roundRect(m, m, Math.max(h, w * f), h, h / 2); c.fill(); }
  c.lineWidth = 1.5; c.strokeStyle = P.ink; c.beginPath(); c.roundRect(m, m, w, h, h / 2); c.stroke();
  c.restore();
}
// The miniature (November 2026's polish): a small picture of the game (its scene with its runner in it: the Dasher over a
// rock, the road and its cars from behind, the bird between the posts, the chopper in the cave; the runner in paper,
// neither player's colour), and under it a bar for each player filling towards the finish in their colour, their drawn
// mark beside it: the picture and the progress each in their own room, nothing over anything.
const miniCar = (x, y, cls) => `<g class="${cls}" transform="translate(${x} ${y}) scale(1.25)"><rect class="rmwh" x="-7.6" y="2.2" width="2.6" height="3.4" rx=".8"/><rect class="rmwh" x="5" y="2.2" width="2.6" height="3.4" rx=".8"/><rect x="-5.2" y="-5" width="10.4" height="6.5" rx="2.2"/><rect class="rmwin" x="-3.8" y="-3.2" width="7.6" height="2.7" rx=".9"/><rect x="-7" y="-.8" width="14" height="5.4" rx="1.8"/></g>`;
export const RUN_SCENES = {
  dash: '<rect class="rmsky" x="2" y="1" width="96" height="42"/><circle class="rmsun" cx="85" cy="10" r="5.5"/><path class="rmhill" d="M2 35q14-15 30-8t28-6t38 9v5h-96z"/><rect class="rmsand" x="2" y="35" width="96" height="9"/><path class="rmgnd" d="M2 35h96"/><path class="rmrock" d="M44 35q2.5-11 10.5-9q5.5 2 6.5 9z"/><rect class="rmcrate" x="84" y="26" width="9" height="9" rx="1.2"/>'
    + '<path class="rmwing" d="M65 11q3-4.5 5.5 0M74.5 11q3-4.5 5.5 0M65 19q3-4.5 5.5 0M74.5 19q3-4.5 5.5 0"/><ellipse class="rmflyer" cx="72.5" cy="12.2" rx="3.7" ry="2.1"/><ellipse class="rmflyer" cx="72.5" cy="20.2" rx="3.7" ry="2.1"/>'
    + '<ellipse class="rmshd" cx="28" cy="36.8" rx="6" ry="1.4"/><path class="rmhero" d="M25 13.5q-9-2-14 3l3.5 2.5l-3 3.5q7 1.5 12.5-2z"/><circle class="rmdash" cx="29" cy="18" r="6.5"/><circle class="rmeye" cx="31" cy="16.7" r="1"/><circle class="rmeye" cx="33.6" cy="16.7" r="1"/>',
  lane: '<rect class="rmgrass" x="2" y="1" width="96" height="42"/><rect class="rmroad" x="13" y="-1" width="74" height="46"/><path class="rmlane" d="M37.7 1v42M62.3 1v42"/>' + miniCar(25.5, 11, 'rmcar1') + miniCar(74.5, 19, 'rmcar2') + miniCar(50, 32, 'rmcar0'),
  flap: '<rect class="rmsky" x="2" y="1" width="96" height="42"/><circle class="rmsun" cx="87" cy="9" r="5.5"/><path class="rmhill" d="M2 43q15-12 30-6t30-4t36 8v3h-96z"/><rect class="rmpost" x="45.5" y="-1" width="9" height="11"/><rect class="rmcap" x="43.5" y="9" width="13" height="4" rx="1.5"/><rect class="rmpost" x="45.5" y="30" width="9" height="15"/><rect class="rmcap" x="43.5" y="27" width="13" height="4" rx="1.5"/><rect class="rmpost" x="78.5" y="-1" width="9" height="18"/><rect class="rmcap" x="76.5" y="16" width="13" height="4" rx="1.5"/><rect class="rmpost" x="78.5" y="37" width="9" height="8"/><rect class="rmcap" x="76.5" y="34" width="13" height="4" rx="1.5"/>'
    + '<path class="rmhero" d="M18 20l-6.5-4.5l1.2 5l-2 4z"/><ellipse class="rmhero" cx="24" cy="20" rx="7" ry="6"/><path class="rmbeak" d="M30 18.5l5.5 2l-5.5 2.2z"/><path class="rmhero" d="M19.5 20.5q2.5-8 7.5-3.5q-2 5-7.5 3.5z"/><circle class="rmeye" cx="27.3" cy="17.7" r="1.1"/>',
  chopper: '<rect class="rmcavebg" x="2" y="1" width="96" height="42"/><path class="rmbeam" d="M32 21l30-9v19z"/><path class="rmcave" d="M0 -1h100v10q-20 9-40 5t-30 2.5t-30-5z"/><path class="rmcave" d="M0 45v-9q24-8.5 44-3t34-5t22 5v12z"/><rect class="rmblock" x="69" y="15.5" width="8" height="12.5" rx="2"/>'
    + '<path class="rmgnd" d="M20 21l-10-1.3M16 14h17M24.5 14v2.5M20 27.3h11M22.5 25l-.6 2.3M27.5 25l.6 2.3"/><ellipse class="rmhero" cx="25" cy="21" rx="7" ry="4.8"/><ellipse class="rmwin" cx="28" cy="20.2" rx="2.8" ry="2.3"/>',
};
export function runnerMiniature(mini, final) {
  const T = mini.cfg.target, row = (p, y) => {
    const k = Math.max(0, Math.min(1, mini.dist[p] / T)), w = 75 * k;
    return `${tokSvg(p, 8, y, 6)}<rect class="rmbar" x="17" y="${y - 3.5}" width="75" height="7" rx="3.5"/>${w > 0.4 ? `<rect class="rmfill ${p}" x="17" y="${y - 3.5}" width="${Math.max(7, w).toFixed(1)}" height="7" rx="3.5"/>` : ''}<rect class="rmbar o" x="17" y="${y - 3.5}" width="75" height="7" rx="3.5"/>${finishSvg(93.5, y - 5.4, y + 5.4, 3.2)}`;
  };
  return `<div class="tscene" aria-label="X at ${Math.round(mini.dist.X)} m, O at ${Math.round(mini.dist.O)} m of ${T}"><svg viewBox="0 0 100 77" aria-hidden="true"><clipPath id="rmclip"><rect x="2" y="1" width="96" height="42" rx="5"/></clipPath><g clip-path="url(#rmclip)">${RUN_SCENES[mini.type] || ''}</g><rect class="rmframe" x="2" y="1" width="96" height="42" rx="5"/>${row('X', 55)}${row('O', 69.5)}</svg></div>`;   // both players' progress to the target
}
export function runnerMoveText(f, who) {
  return f.run ? (f.run.done ? `${who} reached ${fmtM(f.run.target)} m!` : `${who} ${RUN_TEXT[f.type].verb} ${fmtM(f.run.to - f.run.from)} m — now at ${fmtM(f.run.to)}/${fmtM(f.run.target)}`) : `${who} ${RUN_TEXT[f.type].verb}`;
}
// The sounds of a move, for moveSounds: someone else's run as it plays back (its presses from the log
// at their steps: jumps, flaps, skids; the chopper's rotor cannot loop from a schedule, so it is left
// out), its crash or its finish when the run ends, then the result's ding; a run this phone saw, just the
// crash (or the finish) as the result shows, the bar landing at its new distance.
export function runnerSounds(f, add, won, mini, last) {
  if (!f.run) return;
  const pre = runPre(f);
  if (!pre) { add(f.run.done ? 'sparkle' : 'thud', 0); add('ding', RUNT.bar); return; }
  const r = f.run, step = runStepOf(f.type), press = f.type === 'chopper' ? null : f.type === 'lane' ? 'skid' : RUN_PRESS[f.type];
  let n = 0;
  for (const [k, c] of runUnlog(r.log, r.steps) || []) { if (press && c !== 'r' && n < 300) { add(press, Math.round(k * step * 1000)); n++; } }
  if (mini && mini.cfg && mini.seed && mini.dist) {                               // the run's own events (a landing, a post cleared, traffic passed): the log played through, each at its step
    try {
      const rp = runReplayer(Object.assign({}, mini, { dist: Object.assign({}, mini.dist, { [f.by]: r.from }) }), f.by, runUnlog(r.log, r.steps) || [], r.steps), st = {};
      for (let k = 4, m = 0; m < 240; k += 4) { runReplayTo(rp, k); for (const s of runEvents(rp.sim, st)) { add(s, Math.round(rp.sim.n * step * 1000)); m++; } if (rp.sim.crash || rp.sim.done || rp.sim.n >= r.steps) break; }
    } catch (e) { /* (a course that cannot be read: the presses and the end alone) */ }
  }
  const drive = Math.round(r.steps * step * 1000);
  if (r.done) add('sparkle', drive); else if (!r.out) add('crash', drive);
  add('ding', pre + RUNT.bar);
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  app.addEventListener('pointerdown', e => {
    const rd = runDraft;
    if (!rd || rd.phase !== 'run' || !runInputAt(e.target)) return;
    const scene = app.querySelector('[data-run="scene"]');
    e.preventDefault(); ownPress();
    rd.pointer = e.pointerId; rd.x0 = e.clientX; rd.swiped = false; rd.scene = scene;
    if (rd.sim.type !== 'lane' && runJump(rd.sim)) { if (rd.sim.type === 'chopper') runRotor(true); else SND.play(RUN_PRESS[rd.sim.type]); haptic('tap'); }   // a jump, a flap; the chopper's rotor runs while held (each with a light buzz: this phone's own press)
    try { (e.target.closest('main.scr.mini') || scene).setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
  });
  // While a run is on (and its count), touches on the screen do nothing else: no selection, magnifier or callout.
  ['touchstart', 'touchmove', 'touchend'].forEach(ev => app.addEventListener(ev, e => { if (runDraft && runInputAt(e.target) && e.cancelable) e.preventDefault(); }, { passive: false }));
  app.addEventListener('pointermove', e => {
    const rd = runDraft;
    if (!rd || rd.pointer !== e.pointerId || rd.sim.type !== 'lane' || rd.swiped || rd.phase !== 'run') return;
    const dx = e.clientX - rd.x0;
    if (Math.abs(dx) >= 18) { rd.swiped = true; if (runLane(rd.sim, dx < 0 ? -1 : 1)) { SND.play('skid'); haptic('tap'); } }   // a swipe counts as soon as it is one
  });
  app.addEventListener('pointerup', runPointerUp);
  app.addEventListener('pointercancel', e => { const rd = runDraft; if (rd && rd.pointer === e.pointerId) { rd.pointer = null; if (rd.sim.type !== 'lane') { runRelease(rd.sim); runRotor(false); } } });
  document.addEventListener('keydown', e => {                      // a keyboard: space or up jumps, the arrows change lanes
    const rd = runDraft;
    if (!rd || rd.phase !== 'run' || e.repeat) return;
    if (rd.sim.type !== 'lane' && (e.key === ' ' || e.key === 'ArrowUp')) { e.preventDefault(); if (runJump(rd.sim)) { if (rd.sim.type === 'chopper') runRotor(true); else SND.play(RUN_PRESS[rd.sim.type]); } }
    if (rd.sim.type === 'lane' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); if (runLane(rd.sim, e.key === 'ArrowLeft' ? -1 : 1)) SND.play('skid'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { runRotor(false); showRotor(false); } });   // (the page put away: no rotor left droning)
  document.addEventListener('keyup', e => { const rd = runDraft; if (rd && rd.sim.type !== 'lane' && (e.key === ' ' || e.key === 'ArrowUp')) { runRelease(rd.sim); runRotor(false); } });
}
