// Snake: the screen, the miniature, the move's words and sounds, and the inputs (swipes, taps and the arrow keys).
import { fingUnlog } from '../shared/finger.js';
import { RUNT } from '../shared/runner.js';
import { DIRS, SNAKE, SNAKE_REP, snakeChunkParse, snakeChunkVals, snakeFeed, snakeGoal, snakeHeading, snakeQueue, snakeReplay, snakeResult, snakeShown, snakeStart, snakeSynthList, snakeTick, snakeTickMs } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { moveWait, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';
import { render } from '../../ui/render.js';
import { rep, repNote } from '../../ui/replay.js';
import { drawTimeBar, outlined, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { FONT, backOut, banner, clamp01, dizzy, easeOut, hash, impact, jolt, puff, shadow, starPath } from '../../ui/runfx.js';
import { cpuTurn } from '../../ui/turns.js';

// ---------- Snake: one run a turn ----------
// The square opens on the garden (11 by 11 cells under a fence rail that holds the count and the attempt's time
// bar) with the snake at rest in the middle and Start below. Start begins
// a run: after a short moment the snake sets off to the right, snapping a cell a tick (no gliding between
// cells); a swipe anywhere on the screen (or a tap: above or below it while it runs across, left or right
// of it while it runs up or down; or the arrow keys) queues a turn for the next tick (two may wait: the
// rules' queue, rules.js snakeQueue). Food eaten grows it: its own colour a point for the mover, the other
// colour a point for the other player; the wall, a bomb or its own tail ends the run, as
// does the run's time cap or the turn's clock (the run ends as it stands); the end shows a moment, then
// the run goes in as its log (rules.js: the turns at their ticks), which the server plays through again.
// While it runs, the phone notes the run in chunks for the other side's replay (ui/replay.js, the move's
// log: rules.js SNAKE_REP), so the other phone plays the run through before the move, at the same pace, a
// little behind; the computer's run is noted the same way (replay.synth). A run that comes with no whole
// log (a bot's online) plays in the move's flash instead, timed from the move (rules.js flashMs).
const READY_MS = 600;                                            // Start, then the snake sets off after this
const EARLY_MS = 700;                                            // online: a run ends this long before the turn's time is up, so it goes in before the timeout
const SWIPE_PX = 14;                                             // a drag this far is a swipe
const MAX_FX_MS = 900;
let draft = null;        // the run under way here: { sq, p, id, mini, sim, phase: 'ready' | 'play' | 'end', at, last, acc, ptr, fx, chunkAt, noted, geom, endAt, goAt } (the turns waiting are the sim's own queue, sim.q)
let live = null;         // the run just made here: { sq, p, id, view, at } (its last moment stays on the scene while its result shows)
let repRun = null;       // someone else's run playing from the replay's chunks: { r, sq, sim, t0, speed, lag, turns, horizon, endK, fx, done }
const fallbacks = new WeakMap();   // a flash whose run plays in it (no whole replay log): its sim and log
let raf = 0;
const idOf = (sq, p) => { const m = state.squares[sq].mini; return `${state.online ? state.online.matchId || state.online.game || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:snake:${m.tries[p]}`; };
const mySide = () => (state.online ? state.online.me : typeof state.cpu === 'string' && state.cpu.length === 1 ? (state.cpu === 'X' ? 'O' : 'X') : null);
const mine = f => !!f && !f.timeout && (state.online ? f.by === state.online.me : !cpuPlays(f.by));   // a move made on this phone (its run was seen as it was played)
const fmtN = n => Math.floor(n + 1e-9).toLocaleString('en-US');
export const snakePinned = () => !!(draft && state.screen === 'mini' && state.zoom === draft.sq);

// ---- Start, the run, its end ----
function snakeGo() {
  const i = state.zoom, sq = state.squares && state.squares[i];
  if (!sq || sq.mini.type !== 'snake' || sq.owner || draft || state.flash || state.done || state.winner || cpuTurn() || remoteTurn() || moveWait || (rep && rep.sq === i)) return;
  const p = state.turn, now = performance.now();
  draft = { sq: i, p, id: idOf(i, p), mini: sq.mini, sim: snakeStart(sq.mini, p), phase: 'ready', at: now, last: now, acc: 0, ptr: null, fx: [], chunkAt: now, noted: 0, geom: null, endAt: 0, goAt: 0 };
  live = null;
  SND.play('go');
  render();
  ensureLoop();
}
function queueTurn(fd, dir) {                                     // (the rules' queue: taken at the next tick; straight on, straight back or a third waiting: nothing)
  if (!fd || (fd.phase !== 'play' && fd.phase !== 'ready') || dir == null) return;
  if (snakeQueue(fd.sim, dir)) haptic('tap');                     // (queued: a light tap under the finger; its tick sounds as the snake turns)
}
// A tick of a run as it plays here (this phone's own, or someone else's from the replay's chunks): its effects, its
// sounds (loud) and, for this phone's own run alone (own), its buzzes: the other side's run never buzzes this phone.
function tickEvents(fd, sim, now, loud, own) {
  if (sim.turned && loud) SND.play('snkTurn');
  if (sim.last === 'eat' || sim.last === 'gift') {                // its own colour: a point for the mover; the other colour: a point for the other player
    const [x, y] = sim.body[0], c = sim.ate.c;
    const [dx, dy] = DIRS[sim.dir], full = new Set(sim.body.map(([bx, by]) => by * sim.n + bx));
    const to = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([ux, uy]) => !(ux === dx && uy === dy) && x + ux >= 0 && y + uy >= 0 && x + ux < sim.n && y + uy < sim.n && !full.has((y + uy) * sim.n + x + ux)) || [0, -1];
    fd.fx.push({ kind: 'eat', x, y, at: now, c, own: c === sim.p, k: sim.k, to });   // (k: the tick it was eaten in: the lump goes down the body a cell a tick from there; to: a cell beside it clear of the body and of its way: the point shows there)
    if (loud) SND.play(c === sim.p ? 'snkCrunch' : 'snkGulp');
    if (own) haptic(c === sim.p ? 'medium' : 'error');
  }
}
function endEvents(fd, sim, now, loud, own) {
  const [x, y] = sim.body[0];
  if (sim.end === 'wall' || sim.end === 'self') { fd.fx.push({ kind: 'bonk', x, y, at: now, dir: sim.dir, wall: sim.end === 'wall' }); if (loud) SND.play('snkBonk'); if (own) haptic('error'); }
  else if (sim.end === 'bomb') { const [dx, dy] = DIRS[sim.dir]; fd.fx.push({ kind: 'boom', x: x + dx, y: y + dy, at: now }); if (loud) SND.play('boom'); if (own) haptic('error'); }   // (the bomb's cell, ahead of the head)
  else if (sim.end === 'top') { fd.fx.push({ kind: 'win', x, y, at: now, c: sim.p }); if (loud) SND.play('sparkle'); if (own) haptic('success'); }
  else if (sim.end === 'gift') fd.fx.push({ kind: 'win', x, y, at: now, c: sim.p === 'X' ? 'O' : 'X' });   // (the other player's target, from food eaten here: its gulp has sounded)
  else if (sim.end === 'out') { if (loud) SND.play('buzz'); if (own) haptic('medium'); }   // (the attempt's time limit: a buzzer, its points kept; the scene says TIME!)
}
function stepDraft(fd, now) {
  if (fd.phase === 'ready') {
    if (now - fd.at < READY_MS) return;
    fd.phase = 'play'; fd.last = now; fd.acc = snakeTickMs(fd.sim);   // (the first tick at once)
  }
  if (fd.phase === 'play') {
    const left = clockLeft();
    if (left != null && left <= (state.online ? EARLY_MS : 0)) { stopRun(fd, now); return; }   // the turn's time is up: the run ends here, its apples kept
    const dt = Math.min(250, Math.max(0, now - fd.last));
    fd.last = now; fd.acc += dt;
    for (let n = 0; n < 4 && !fd.sim.end && fd.acc >= snakeTickMs(fd.sim); n++) {
      const ms = snakeTickMs(fd.sim), k0 = fd.sim.k;
      snakeTick(fd.sim, null);                                     // (the first turn waiting, if any, is taken in it)
      if (fd.sim.k === k0) break;                                 // (the run's cap: no tick taken)
      fd.acc -= ms;
      if (fd.sim.k === 1) { fd.goAt = now; repNote(SNAKE_REP.act, 'go'); }
      tickEvents(fd, fd.sim, now, true, true);
    }
    if (fd.sim.k > 0 && now - fd.chunkAt >= SNAKE_REP.chunkMs) noteChunk(fd, false, now);
    if (fd.sim.end) { fd.phase = 'end'; fd.endAt = now; fd.acc = 0; endEvents(fd, fd.sim, now, true, true); }
    return;
  }
  if (fd.phase === 'end') {
    if (now - fd.chunkAt >= SNAKE_REP.chunkMs) noteChunk(fd, false, now);   // (on through the pause too: no gap the log would cut)
    if (now - fd.endAt >= (fd.sim.end === 'top' || fd.sim.end === 'gift' ? SNAKE.winPause : fd.sim.end === 'stop' ? 300 : SNAKE.endPause)) finish(fd);
  }
}
function stopRun(fd, now) {
  if (fd.sim.k === 0) snakeTick(fd.sim, null);                  // (at least one tick: a run of none is no run)
  if (!fd.sim.end) fd.sim.end = 'stop';
  fd.phase = 'end'; fd.endAt = now; fd.acc = 0;
  if (fd.sim.k === 1 && !fd.goAt) { fd.goAt = now; repNote(SNAKE_REP.act, 'go'); }
}
// The run so far, noted for the other side's replay: the turns since the last chunk, and how many ticks are in.
function noteChunk(fd, final, now) {
  const sim = fd.sim, turns = sim.rec.slice(fd.noted).filter(([key]) => !final || key >> 1 < sim.k);   // (each turn by its log key; the last chunk: none queued after the last tick)
  fd.noted = sim.rec.length; fd.chunkAt = now;
  for (const v of snakeChunkVals(`${final ? 'end' : 'k'}=${sim.k.toString(36)}`, turns)) repNote(SNAKE_REP.act, v);
}
// The run goes in: as it ended, or as it stands (the time ran out, the screen went away).
function finish(fd) {
  if (draft !== fd) return;
  draft = null;
  const now = performance.now();
  if (fd.sim.k === 0) { snakeTick(fd.sim, null); if (fd.sim.k === 1) repNote(SNAKE_REP.act, 'go'); }
  if (!fd.sim.end) fd.sim.end = 'stop';
  noteChunk(fd, true, now);
  live = { sq: fd.sq, p: fd.p, id: fd.id, view: { sim: fd.sim, u: 0, fx: fd.fx, endAt: fd.endAt || now, p: fd.p }, at: now };
  attemptMove(snakeResult(fd.sim));
  render();
}

// ---- someone else's run, from the replay's chunks (ui/replay.js: replay.input), and the computer's (replay.synth) ----
function repInput(act, val, r) {
  if (act !== SNAKE_REP.act) return false;                        // ('snk-start': the press shows on the button, ui/replay.js repMark)
  const c = snakeChunkParse(val);
  if (!c) return true;
  const now = performance.now();
  if (c.go) {
    const sq = shownSq(r.sq);
    if (!sq || sq.mini.type !== 'snake') return true;
    const speed = r.speed || 1;
    repRun = { r, sq: r.sq, sim: snakeStart(sq.mini, r.by), t0: now, speed, lag: SNAKE_REP.lagMs / speed, turns: new Map(), horizon: 0, endK: null, fx: [], done: false, endAt: 0 };
    SND.play('go');
    ensureLoop();
    return true;
  }
  if (!repRun || repRun.r !== r) return true;
  for (const [t, d] of c.turns) repRun.turns.set(t, d);          // (by log key: two in one tick are two keys)
  repRun.horizon = Math.max(repRun.horizon, c.k);
  if (c.end) repRun.endK = c.k;
  return true;
}
function repSynth(move, mini, o) {
  if (!move || typeof move !== 'object' || typeof move.log !== 'string') return null;
  const m = JSON.parse(JSON.stringify(mini)), log = fingUnlog(move.log, 2 * Number(move.ticks) - 1, 3);
  if (!log) return null;
  const sim = snakeReplay(m, o.by, log, Number(move.ticks));
  if (sim.bad) return null;
  if (!sim.end && move.end === 'out') snakeTick(sim, null);
  move.ai = true;                                                  // (its run shown here before the move: the flash holds the result alone, rules.js flashMs)
  return snakeSynthList(sim);
}
export const replay = { input: repInput, synth: repSynth };
// A replayed run stepped on to its time T (ms of run time), never past what its chunks cover; the sounds as it goes.
function stepRep(rr, T, now, loud) {
  const sim = rr.sim;
  for (let n = 0; n < 6 && !sim.end && !rr.done && sim.k < rr.horizon && sim.at[sim.k] + snakeTickMs(sim) <= T; n++) {
    const k0 = sim.k;
    snakeFeed(sim, rr.turns);                                      // (the turns that came in before this tick, into the queue as they were)
    snakeTick(sim, null);
    if (sim.k === k0) break;
    tickEvents(rr, sim, now, loud, false);
    if (rr.endK != null && sim.k >= rr.endK) rr.done = true;
  }
  if (rr.endK != null && sim.k >= rr.endK && !rr.done) rr.done = true;
  if ((sim.end || rr.done) && !rr.endAt) { rr.endAt = now; if (!sim.end && rr.endK != null && rr.end) sim.end = rr.end; endEvents(rr, sim, now, loud, false); }
}
// The run of a flash that came with no whole replay log (a bot's): played from the move's own log, timed from the move.
function fallbackOf(f) {
  if (fallbacks.has(f)) return fallbacks.get(f);
  const sq = shownSq(f.square), s = f.snake;
  let fb = null;
  if (sq && s && !s.auto && typeof s.log === 'string') {
    const m = JSON.parse(JSON.stringify(sq.mini));
    m.score[s.by] = s.from; m.tries[s.by] = s.try; if (s.ofrom != null) m.score[s.by === 'X' ? 'O' : 'X'] = s.ofrom;   // the square as the mover found it
    const log = fingUnlog(s.log, 2 * Number(s.ticks) - 1, 3) || [];
    fb = { sim: snakeStart(m, s.by), turns: new Map(log), horizon: Number(s.ticks), endK: Number(s.ticks), end: s.end, fx: [], done: false, endAt: 0, speed: 1 };
  }
  fallbacks.set(f, fb);
  return fb;
}

// ---- the scene: the run under way, a replay, the last moment, or the clean start ----
export function ensureLoop() { if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop); }
function loop(now) {
  raf = 0;
  const cv = app.querySelector('canvas[data-snk="cv"]');
  if (!cv || !['mini', 'review-mini'].includes(state.screen)) { if (draft && state.screen !== 'mini') { draft = null; } return; }   // (taken off the square: the run is dropped, nothing played)
  const sq = shownSq(state.zoom);
  if (!sq || sq.mini.type !== 'snake') return;
  let more = false, v = null;
  const fd = draft && draft.sq === state.zoom ? draft : null;
  if (draft && !fd) { draft = null; }                              // (another square somehow: dropped)
  if (fd) {
    stepDraft(fd, now);
    if (draft === fd) { v = { sim: fd.sim, fx: fd.fx, endAt: fd.endAt, p: fd.p, ready: fd.phase === 'ready' }; more = true; }
  }
  const f = state.flash && state.flash.square === state.zoom && state.flash.snake ? state.flash : null;
  if (!v && f && !snakeShown(f) && !f.snake.auto && !f.timeout && !mine(f)) {   // a run playing in its flash (no whole replay log), timed from the move
    const fb = fallbackOf(f), start = fxAt('move', f);
    if (fb && start != null) {
      const T = Math.max(0, now - start);
      stepRep(fb, T, now, false);
      const sim = fb.sim, next = !sim.end && !fb.done && sim.k < fb.horizon;
      v = { sim, fx: fb.fx, endAt: fb.endAt, p: sim.p };
      more = next || now - (fb.endAt || now) < MAX_FX_MS;
    }
  }
  const rr = !v && repRun && repRun.sq === state.zoom && rep && rep.sq === state.zoom ? repRun : null;
  if (rr) {
    const T = Math.max(0, (now - rr.t0 - rr.lag) * rr.speed);
    stepRep(rr, T, now, true);
    const sim = rr.sim;
    v = { sim, fx: rr.fx, endAt: rr.endAt, p: sim.p, rr };
    more = true;
  } else if (repRun && !(rep && rep.sq === repRun.sq)) repRun = null;
  if (!v) {
    const lv = live && live.sq === state.zoom ? live : null;
    if (lv && (f ? f.by === lv.p : state.turn === lv.p && now - lv.at < 15000) && (!state.done || state.done.by === lv.p)) { v = lv.view; more = now - lv.at < MAX_FX_MS; }
    else { const p = sq.owner || (f ? f.by : state.turn); v = { sim: snakeStart(sq.mini, p), fx: [], endAt: 0, p, still: true }; }
  }
  draw(cv, v, now);
  const hud = app.querySelector('[data-snk="hud"]');
  if (hud) {
    const txt = `${fmtN(v.sim.from + v.sim.got)} / ${fmtN(v.sim.goal)}`;
    if (hud.textContent !== txt) { hud.textContent = txt; if (!v.still && v.sim.k > 0 && !REDUCED && typeof hud.animate === 'function') hud.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'cubic-bezier(.4, 0, .2, 1)' }); }   // (the count pops as a point lands, from the tick that scored it)
  }
  const live2 = fd ? fd.sim : v.rr ? v.rr.sim : null;              // a run playing here (this phone's or a replay's): both totals as it goes (food of the other colour is the other player's)
  if (live2) for (const p of ['X', 'O']) {
    const row = app.querySelector(`.snk-prog.${p} .rbar i`), at = p === live2.p ? live2.from + live2.got : live2.ofrom + live2.gave;
    if (!row) continue;
    const w = (100 * Math.min(1, at / live2.goal)).toFixed(2) + '%'; row.classList.remove('grow'); row.style.setProperty('--w0', w); row.style.setProperty('--w1', w);
    const sm = app.querySelector(`.snk-prog.${p} small`); if (sm) sm.textContent = `${fmtN(at)} / ${fmtN(live2.goal)}`;
  }
  if (v.fx && v.fx.some(x => now - x.at < MAX_FX_MS)) more = true;
  if (v.sim.food.length && !v.still && !REDUCED) more = true;     // (the food's bob, while anything is going on)
  if (more) ensureLoop();
}
// ---- the drawing ----
// The garden from straight above, lit from the top left: a mown lawn of 11 by 11 cells (painted once into a layer:
// the checks, tufts of grass, the wall's shade along the top and left) under a fence rail that holds the count and
// the attempt's time bar, so neither ever lies over a food or a bomb. On it the food (a berry in its player's colour
// with their mark; one put back pops in), the bombs, and the snake: an ink-outlined body in the player's colour,
// banded, with a tapered tail and a head whose eyes follow the nearest food of its own colour. It stands exactly on
// its cells as the last tick left it (no gliding between cells, as on the old phones): what moves between ticks is
// only feel, never where anything is (the head's small pop at each tick, a lump going down the body a cell a tick
// after a food, the food's bob). The effects of the moment: a food's burst and whose point it was, the star and the
// scene's jolt at the wall, a bomb's blast, the stars at a target, TIME! at the attempt's limit.
export const SNKV = { band: 0.95, pop: 120, born: 260, lump: 0.62 };   // band: the rail's height in cells; pop: the head's pop after a tick (ms); born: a food's pop as it is put back (ms); lump: a swallowed food's half width, in body widths
const LAWN = { a: '#e1f1ca', b: '#d2e8b4', tuft: '#a8cf84', speck: '#f8fbe9', edge: '#8fbf6c', wood: '#ecd3a1', grain: '#d2b47c' };
const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); if (!m) return null; const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const mix = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return A && B ? `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(', ')})` : a; };
// The view's own notes on a run (never read by the rules): when its last tick showed, and when each food came to its cell.
const NOTES = new WeakMap();
function notesOf(sim, now) {
  const keyOf = f => (f ? f[0] + ',' + f[1] : '');
  let nt = NOTES.get(sim);
  if (!nt) { nt = { k: sim.k, tickAt: 0, food: sim.food.map(keyOf), born: new Map() }; NOTES.set(sim, nt); return nt; }
  if (sim.k !== nt.k) { nt.k = sim.k; nt.tickAt = now; }
  sim.food.forEach((f, i) => { const key = keyOf(f); if (key !== nt.food[i]) { nt.food[i] = key; if (f) nt.born.set(i, now); } });
  return nt;
}
const lawn = { key: '', cv: null };
function lawnLayer(n, k, dpr) {
  const key = `${n}:${k.toFixed(2)}:${dpr}`;
  if (lawn.key === key && lawn.cv) return lawn.cv;
  const S = n * k, cv = document.createElement('canvas');
  cv.width = cv.height = Math.max(1, Math.round(S * dpr));
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = LAWN.a; c.fillRect(0, 0, S, S);
  c.fillStyle = LAWN.b;
  for (let y = 0; y < n; y++) for (let x = (y % 2); x < n; x += 2) c.fillRect(x * k, y * k, k, k);
  c.lineCap = 'round'; c.strokeStyle = LAWN.tuft; c.lineWidth = Math.max(1, k * 0.05);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {       // a tuft of grass here and there, a pale speck of a flower (the same garden every time)
    const h = hash(x * 17 + y * 131 + 3);
    if (h < 0.24) {
      const px = (x + 0.25 + 0.5 * hash(x * 7 + y * 3 + 1)) * k, py = (y + 0.45 + 0.4 * hash(x * 5 + y * 11 + 2)) * k, s = k * 0.13;
      c.beginPath(); c.moveTo(px - s * 0.7, py); c.lineTo(px - s, py - s * 0.9); c.moveTo(px, py); c.lineTo(px, py - s * 1.25); c.moveTo(px + s * 0.7, py); c.lineTo(px + s, py - s * 0.9); c.stroke();
    } else if (h > 0.93) {
      const px = (x + 0.2 + 0.6 * hash(x * 13 + y * 7 + 5)) * k, py = (y + 0.2 + 0.6 * hash(x * 3 + y * 19 + 7)) * k;
      c.fillStyle = LAWN.speck; c.beginPath(); c.arc(px, py, Math.max(1, k * 0.055), 0, Math.PI * 2); c.fill();
    }
  }
  const shade = (x0, y0, x1, y1, a) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(40, 70, 24, ${a})`); g.addColorStop(1, 'rgba(40, 70, 24, 0)'); c.fillStyle = g; c.fillRect(0, 0, S, S); };
  shade(0, 0, 0, k * 0.34, 0.22); shade(0, 0, k * 0.3, 0, 0.16);  // the wall's shade along the top and the left; a lit edge along the bottom and the right
  c.fillStyle = 'rgba(255, 255, 255, .4)'; c.fillRect(0, S - Math.max(1.5, k * 0.06), S, Math.max(1.5, k * 0.06)); c.fillRect(S - Math.max(1.5, k * 0.06), 0, Math.max(1.5, k * 0.06), S);
  lawn.key = key; lawn.cv = cv;
  return cv;
}
// A player's mark as drawn on their food and beside a point: X's cross, O's ring.
function markOn(c, x, y, h, p, col, w) {
  c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = w; c.beginPath();
  if (p === 'O') c.arc(x, y, h * 0.95, 0, Math.PI * 2);
  else { c.moveTo(x - h, y - h); c.lineTo(x + h, y + h); c.moveTo(x + h, y - h); c.lineTo(x - h, y + h); }
  c.stroke();
}
export function draw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, n = sim.n, k = Math.min(W / n, H / (n + SNKV.band)), S = n * k, ox = (W - S) / 2, oy = H - S;   // (the rail takes what the garden leaves at the top)
  const cx = x => ox + (x + 0.5) * k, cy = y => oy + (y + 0.5) * k, lw = f => Math.max(1.2, k * f);
  if (draft && v.sim === draft.sim) draft.geom = { ox, oy, k, W, H };
  const nt = notesOf(sim, now), fxs = v.fx || [], calm = v.still || REDUCED;
  const dead = sim.end === 'wall' || sim.end === 'self' || sim.end === 'bomb', endAgo = sim.end && v.endAt ? now - v.endAt : null;
  c.fillStyle = LAWN.edge; c.fillRect(0, 0, W, H);
  c.save();
  if (dead && v.endAt) jolt(c, W, H, { crash: true }, { at: v.endAt }, now);   // a crash kicks the garden (the rail over it stays still)
  c.drawImage(lawnLayer(n, k, Math.min(2, window.devicePixelRatio || 1)), ox, oy, S, S);
  // the food: a round berry in its player's colour with their mark on it and a leaf (a gentle bob while a run is on; one just put back pops in)
  sim.food.forEach((f, i) => {
    if (!f) return;
    const [fx, fy, fc] = f, born = nt.born.get(i), bk = born && !REDUCED ? clamp01((now - born) / SNKV.born) : 1, s = bk < 1 ? Math.max(0.05, backOut(bk)) : 1;
    const bob = calm ? 0 : k * 0.035 * Math.sin(now / 260 + fx * 1.7 + fy), r = k * 0.37 * s, x = cx(fx), y = cy(fy) + k * 0.03 + bob;
    shadow(c, x + k * 0.06, cy(fy) + k * 0.4, r * 0.95, r * 0.34, 0.18);
    c.strokeStyle = P.ink; c.lineWidth = lw(0.05); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - r * 0.8); c.lineTo(x + r * 0.12, y - r * 1.18); c.stroke();
    c.beginPath(); c.ellipse(x + r * 0.5, y - r * 1.02, r * 0.46, r * 0.22, -0.5, 0, Math.PI * 2); outlined(c, P.green, P.ink, lw(0.05));
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); outlined(c, fc === 'O' ? P.O : P.X, P.ink, lw(0.075));
    c.fillStyle = 'rgba(255, 255, 255, .5)'; c.beginPath(); c.ellipse(x - r * 0.42, y - r * 0.46, r * 0.2, r * 0.12, -0.7, 0, Math.PI * 2); c.fill();
    markOn(c, x, y + r * 0.04, r * 0.4, fc, fc === 'O' ? P.ink : '#fff', lw(0.085) * s);
  });
  // the bombs: a round black bomb with a fuse and a spark (fixed for the run; the one hit goes up: fx 'boom')
  const boomFx = fxs.find(e => e.kind === 'boom');
  for (const b of sim.bombs || []) {
    if (boomFx && boomFx.x === b[0] && boomFx.y === b[1]) continue;   // (gone in its blast)
    const r = k * 0.33, x = cx(b[0]), y = cy(b[1]) + k * 0.07;
    shadow(c, x + k * 0.06, cy(b[1]) + k * 0.4, r * 0.95, r * 0.34, 0.2);
    c.strokeStyle = '#8a6a3a'; c.lineWidth = lw(0.07); c.lineCap = 'round'; c.beginPath(); c.moveTo(x + r * 0.45, y - r * 0.8); c.quadraticCurveTo(x + r * 0.9, y - r * 1.45, x + r * 1.15, y - r * 1.2); c.stroke();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); outlined(c, '#2b2b33', P.ink, lw(0.07));
    c.beginPath(); c.roundRect(x + r * 0.18, y - r * 1.12, r * 0.5, r * 0.36, r * 0.1); outlined(c, '#4a4a55', P.ink, lw(0.05));
    c.fillStyle = 'rgba(255, 255, 255, .38)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.4, r * 0.26, r * 0.16, -0.7, 0, Math.PI * 2); c.fill();
    const sp = calm ? 1 : 0.75 + 0.25 * Math.sin(now / 70 + b[0] * 2);
    starPath(c, x + r * 1.15, y - r * 1.2, k * 0.14 * sp, 4, calm ? 0 : now / 300 + b[1]); c.fillStyle = '#ffb21e'; c.fill();
    c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(x + r * 1.15, y - r * 1.2, k * 0.045 * sp, 0, Math.PI * 2); c.fill();
  }
  // the snake: through the centres of its cells, exactly where the last tick put it
  const body = sim.body, path = body.map(([x, y]) => [cx(x), cy(y)]), head = path[0], L = path.length, taper = L >= 3, bodyTo = taper ? L - 2 : L - 1;
  const [dx, dy] = DIRS[sim.dir], px = -dy, py = dx;
  const base = sim.p === 'O' ? P.O : P.X, col = dead ? mix(base, '#b9b2a6', 0.3 * (endAgo == null ? 1 : clamp01(endAgo / 300))) : base, band = mix(col, P.ink, 0.3);
  const w = k * 0.72, o = Math.max(2.5, k * 0.13);
  const trace = to => { c.beginPath(); c.moveTo(path[0][0], path[0][1]); for (let i = 1; i <= to; i++) c.lineTo(path[i][0], path[i][1]); if (!to) c.lineTo(path[0][0] + 0.01, path[0][1]); };
  const tail = () => {                                              // the last cell: the body narrowing to a rounded tip
    const [ax, ay] = path[L - 2], [bx, by] = path[L - 1], ux = (bx - ax) / k, uy = (by - ay) / k, nx = -uy, ny = ux, h0 = w / 2, h1 = w * 0.33, m = k * 0.5, q = k * 0.92;
    c.beginPath(); c.moveTo(ax + nx * h0, ay + ny * h0); c.lineTo(ax + ux * m + nx * h0 * 0.94, ay + uy * m + ny * h0 * 0.94); c.lineTo(ax + ux * q + nx * h1, ay + uy * q + ny * h1);
    c.quadraticCurveTo(ax + ux * (q + h1 * 2.1), ay + uy * (q + h1 * 2.1), ax + ux * q - nx * h1, ay + uy * q - ny * h1); c.lineTo(ax + ux * m - nx * h0 * 0.94, ay + uy * m - ny * h0 * 0.94); c.lineTo(ax - nx * h0, ay - ny * h0); c.closePath();
  };
  const lumps = [];                                                 // a food swallowed: a lump a cell further down the body every tick
  for (const e of fxs) if (e.kind === 'eat' && e.k != null) { const i = sim.k - e.k; if (i >= 1 && i <= bodyTo - (taper ? 0 : 1)) lumps.push(i); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(k * 0.07, k * 0.11); c.globalAlpha = 0.17;   // its shadow on the lawn, down and to the right
  trace(L - 1); c.strokeStyle = P.ink; c.lineWidth = w + o; c.stroke();
  c.restore();
  if (taper) { tail(); c.fillStyle = P.ink; c.fill(); c.lineWidth = o; c.strokeStyle = P.ink; c.stroke(); }   // the ink first, all of it; then the colour over it, so no outline crosses the body
  trace(bodyTo); c.strokeStyle = P.ink; c.lineWidth = w + o; c.stroke();
  c.fillStyle = P.ink; for (const i of lumps) { c.beginPath(); c.arc(path[i][0], path[i][1], w * SNKV.lump + o / 2, 0, Math.PI * 2); c.fill(); }
  if (taper) { tail(); c.fillStyle = col; c.fill(); }
  trace(bodyTo); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  c.fillStyle = col; for (const i of lumps) { c.beginPath(); c.arc(path[i][0], path[i][1], w * SNKV.lump, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = band; c.lineWidth = k * 0.15; c.globalAlpha = 0.55;   // the bands across its back: every other cell from the head (they travel with the body)
  for (let i = 1; i <= bodyTo; i++) {
    if (i % 2 === 0) continue;
    const ux = (path[i - 1][0] - path[i][0]) / k, uy = (path[i - 1][1] - path[i][1]) / k, nx = -uy, ny = ux, h = w * (lumps.includes(i) ? 0.42 : 0.27);
    c.beginPath(); c.moveTo(path[i][0] + nx * h, path[i][1] + ny * h); c.lineTo(path[i][0] - nx * h, path[i][1] - ny * h); c.stroke();
  }
  c.globalAlpha = 1;
  if (bodyTo >= 1) {                                                // the light along its upper left side
    c.save(); c.translate(-w * 0.17, -w * 0.17); c.beginPath(); c.moveTo(path[1][0], path[1][1]); for (let i = 2; i <= bodyTo; i++) c.lineTo(path[i][0], path[i][1]); if (bodyTo === 1) c.lineTo(path[1][0] + 0.01, path[1][1]);
    c.strokeStyle = 'rgba(255, 255, 255, .3)'; c.lineWidth = w * 0.15; c.stroke(); c.restore();
  }
  // the head: a little bigger, a small pop at every tick, its eyes on the nearest food of its own colour, the tongue out when one is close
  const ate = fxs.length && fxs[fxs.length - 1].kind === 'eat' ? clamp01(1 - (now - fxs[fxs.length - 1].at) / 220) : 0;
  const pop = calm || sim.end ? 0 : 1 - clamp01((now - nt.tickAt) / SNKV.pop), hr = w * 0.64 * (1 + 0.07 * pop + (REDUCED ? 0 : 0.16 * ate));
  let lx = dx, ly = dy;
  if (!sim.end) {
    let best = 1e9;
    for (const f of sim.food) { if (!f || f[2] !== sim.p) continue; const ex = f[0] - body[0][0], ey = f[1] - body[0][1], d = Math.hypot(ex, ey); if (d > 0 && d < best) { best = d; lx = ex / d; ly = ey / d; } }
  }
  if (!sim.end && !v.still) {
    const [hx, hy] = body[0], near = sim.food.some(f => f && f[2] === sim.p && (f[0] - hx) * dx + (f[1] - hy) * dy > 0 && (f[0] - hx) * dx + (f[1] - hy) * dy <= 3 && Math.abs((f[0] - hx) * px + (f[1] - hy) * py) <= 1);
    if (near && Math.floor(now / 220) % 3 !== 0) {
      c.strokeStyle = '#e0434f'; c.lineWidth = lw(0.08); c.lineCap = 'round';
      const tx = head[0] + dx * hr, ty = head[1] + dy * hr, fl = hr * 0.55;
      c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + dx * fl, ty + dy * fl); c.lineTo(tx + dx * fl * 1.4 + px * fl * 0.35, ty + dy * fl * 1.4 + py * fl * 0.35); c.moveTo(tx + dx * fl, ty + dy * fl); c.lineTo(tx + dx * fl * 1.4 - px * fl * 0.35, ty + dy * fl * 1.4 - py * fl * 0.35); c.stroke();
    }
  }
  c.beginPath(); c.arc(head[0], head[1], hr, 0, Math.PI * 2); outlined(c, col, P.ink, lw(0.085));
  c.fillStyle = 'rgba(255, 255, 255, .32)'; c.beginPath(); c.ellipse(head[0] - hr * 0.34 - dx * hr * 0.3, head[1] - hr * 0.42 - dy * hr * 0.3, hr * 0.26, hr * 0.14, -0.7, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.ink; for (const s of [-1, 1]) { c.beginPath(); c.arc(head[0] + dx * hr * 0.74 + px * s * hr * 0.2, head[1] + dy * hr * 0.74 + py * s * hr * 0.2, Math.max(0.8, hr * 0.06), 0, Math.PI * 2); c.fill(); }   // its nostrils
  const xEyes = dead && endAgo != null;
  for (const s of [-1, 1]) {
    const ex = head[0] + px * s * hr * 0.5 + dx * hr * 0.16, ey = head[1] + py * s * hr * 0.5 + dy * hr * 0.16;
    if (xEyes) { c.strokeStyle = P.ink; c.lineWidth = lw(0.075); c.beginPath(); c.moveTo(ex - hr * 0.22, ey - hr * 0.22); c.lineTo(ex + hr * 0.22, ey + hr * 0.22); c.moveTo(ex + hr * 0.22, ey - hr * 0.22); c.lineTo(ex - hr * 0.22, ey + hr * 0.22); c.stroke(); continue; }
    c.beginPath(); c.arc(ex, ey, hr * 0.3, 0, Math.PI * 2); outlined(c, '#fff', P.ink, lw(0.05));
    c.fillStyle = P.ink; c.beginPath(); c.arc(ex + lx * hr * 0.11, ey + ly * hr * 0.11, hr * 0.15, 0, Math.PI * 2); c.fill();
  }
  // the turns waiting (the rules' queue): a chevron on the cell each will take it to, so a swipe is seen at once
  if (!sim.end && !v.still && sim.q.length) {
    let qx = body[0][0], qy = body[0][1];
    c.strokeStyle = P.ink; c.lineWidth = lw(0.09); c.lineCap = 'round'; c.lineJoin = 'round';
    sim.q.forEach((d, i) => {
      const [ex, ey] = DIRS[d]; qx += ex; qy += ey;
      if (qx < 0 || qy < 0 || qx >= n || qy >= n) return;
      const X = cx(qx), Y = cy(qy), a = k * 0.17, nx = -ey, ny = ex;
      c.globalAlpha = i ? 0.3 : 0.5; c.beginPath(); c.moveTo(X - ex * a + nx * a, Y - ey * a + ny * a); c.lineTo(X + ex * a, Y + ey * a); c.lineTo(X - ex * a - nx * a, Y - ey * a - ny * a); c.stroke();
    });
    c.globalAlpha = 1;
  }
  if (v.ready && !REDUCED) {                                        // Start pressed: a ring about the head runs down as it gets ready to set off
    const t = Math.min(1, (now - (draft ? draft.at : now)) / READY_MS);
    c.save(); c.strokeStyle = P.ink; c.lineCap = 'round'; c.lineWidth = lw(0.1); c.globalAlpha = 0.55; c.beginPath(); c.arc(head[0], head[1], hr + k * 0.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t)); c.stroke(); c.restore();
  }
  c.restore();
  // the fence rail over the garden's top wall: the count stands on it (the page's own element) beside the attempt's time bar, while a run plays or replays
  c.fillStyle = LAWN.wood; c.fillRect(0, 0, W, oy);
  c.strokeStyle = LAWN.grain; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
  for (const q of [0.31, 0.69]) { c.moveTo(W * q, 2); c.lineTo(W * q, oy - 4); }
  c.moveTo(W * 0.05, oy * 0.3); c.lineTo(W * 0.2, oy * 0.3); c.moveTo(W * 0.74, oy * 0.68); c.lineTo(W * 0.93, oy * 0.68); c.stroke();
  c.fillStyle = 'rgba(255, 255, 255, .35)'; c.fillRect(0, 0, W, Math.max(1.5, oy * 0.09));
  c.fillStyle = P.ink; c.fillRect(0, oy - Math.max(2.5, k * 0.11), W, Math.max(2.5, k * 0.11));
  if (!v.still) {
    const x0 = Math.round(W * 0.36), bw = W - x0, bh = Math.max(5, Math.round(Math.min(bw, H) * 0.016)), bm = Math.max(4, bh);   // (drawTimeBar's own height and margin: centred on the rail)
    c.save(); c.translate(x0, Math.max(0, (oy - Math.max(2.5, k * 0.11) - bh) / 2 - bm)); drawTimeBar(c, bw, H, 1 - sim.ms / (sim.cfg.runCap * 1000), P); c.restore();
  }
  // the effects of the moment (over the rail too: a knock at the top wall is seen whole)
  if (xEyes) dizzy(c, head[0], head[1] - hr * 1.15, hr * 0.95, now, P);
  c.font = FONT(Math.max(14, k * 0.82)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  for (const x of fxs) {
    const t = (now - x.at) / MAX_FX_MS;
    if (t < 0 || t > 1) continue;
    const X = cx(x.x), Y = cy(x.y);
    if (x.kind === 'eat') {                                         // juice flying, a ring, and the point with whose it is: "+1" in the mover's colour, or "+1" and the other player's mark in theirs
      const fc = x.c === 'O' ? P.O : P.X, e = easeOut(t * 1.7);
      c.save();
      if (!REDUCED) for (let i = 0; i < 7; i++) { const a = i * 0.9 + x.x + x.y, r = k * (0.25 + 0.75 * e) * (0.8 + 0.4 * hash(i + x.x * 9)); c.globalAlpha = clamp01(1.5 - t * 2.4); c.beginPath(); c.arc(X + Math.cos(a) * r, Y + Math.sin(a) * r + k * 0.5 * t * t, k * 0.075 * (1 - t * 0.6), 0, Math.PI * 2); outlined(c, fc, P.ink, 1.2); }
      c.globalAlpha = clamp01(1 - t * 1.6); c.strokeStyle = fc; c.lineWidth = Math.max(2, k * 0.1); c.beginPath(); c.arc(X, Y, k * (0.3 + 0.7 * e), 0, Math.PI * 2); c.stroke();
      const [ux, uy] = x.to || [0, -1], rise = easeOut(t), sc = REDUCED ? 1 : 0.6 + 0.4 * backOut(t * 4), half = k * (x.own ? 0.5 : 0.9);
      const tx = Math.max(ox + half, Math.min(ox + S - half, X + ux * k * (1 + (x.own ? 0 : 0.42) + 0.1 * rise))), ty = Math.max(oy + k * 0.45, Math.min(oy + S - k * 0.45, Y + uy * k * (0.95 + 0.2 * rise) - (ux ? k * 0.2 * rise : 0)));   // (on the cell beside it noted as it was eaten, drifting off)
      c.globalAlpha = clamp01(2.6 - t * 2.6); c.translate(tx, ty); c.scale(sc, sc);
      c.strokeStyle = P.ink; c.lineWidth = Math.max(2.5, k * 0.11); c.strokeText('+1', x.own ? 0 : -k * 0.32, 0); c.fillStyle = fc; c.fillText('+1', x.own ? 0 : -k * 0.32, 0);
      if (!x.own) { markOn(c, k * 0.5, -k * 0.03, k * 0.2, x.c, P.ink, Math.max(4, k * 0.2)); markOn(c, k * 0.5, -k * 0.03, k * 0.2, x.c, fc, Math.max(2, k * 0.1)); }
      c.restore();
    } else if (x.kind === 'bonk') {                                 // the knock: a star where the head met the wall (or its own body), lines flying off
      const [bx, by] = DIRS[x.dir], hx = X + bx * k * 0.5, hy = Y + by * k * 0.5;
      impact(c, hx, hy, k * 0.85, { at: x.at }, now, P);
      c.save(); c.globalAlpha = 1 - t; c.strokeStyle = P.ink; c.lineWidth = Math.max(2, k * 0.09); c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = Math.atan2(by, bx) + Math.PI + (i - 2.5) * 0.45, r0 = k * (0.55 + 0.7 * easeOut(t)), r1 = r0 + k * 0.28; c.beginPath(); c.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); c.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); c.stroke(); }
      c.restore();
    } else if (x.kind === 'boom') {                                 // the blast: a flash of fire, a star, smoke going up
      const e = easeOut(t * 1.5);
      c.save(); c.globalAlpha = clamp01(1.2 - t * 1.8); c.fillStyle = '#ff8a1e'; c.beginPath(); c.arc(X, Y, k * (0.4 + 1.0 * e), 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffe07a'; c.beginPath(); c.arc(X, Y, k * (0.2 + 0.6 * e), 0, Math.PI * 2); c.fill(); c.restore();
      impact(c, X, Y, k * 1.05, { at: x.at }, now, P, '#ffd24a');
      if (!REDUCED) for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4, r = k * (0.3 + 0.9 * e); puff(c, X + Math.cos(a) * r, Y + Math.sin(a) * r * 0.7 - k * 0.9 * t, k * (0.22 + 0.25 * t), 0.5 * (1 - t), '70, 64, 66'); }
    } else if (x.kind === 'win') {                                  // the target: stars out of the head, in gold and the winner's colour
      const fc = x.c === 'O' ? P.O : P.X, e = easeOut(t);
      c.save(); c.globalAlpha = clamp01(1.6 - t * 1.6); c.lineWidth = Math.max(1.5, k * 0.06); c.strokeStyle = P.ink;
      for (let i = 0; i < 10; i++) { const a = i * 0.63 + 0.4, r = k * (0.6 + (1.5 + (i % 3) * 0.5) * e); starPath(c, X + Math.cos(a) * r, Y + Math.sin(a) * r - k * 0.5 * e, k * (0.27 + 0.1 * (i % 2)), 5, a + t * 3); c.fillStyle = i % 2 ? '#f2b01e' : fc; c.fill(); c.stroke(); }
      c.restore();
    }
  }
  if (sim.end === 'out' && v.endAt) banner(c, W, H, 'TIME!', { at: v.endAt }, now, P, (oy + S * 0.36) / H);   // the attempt's limit: the runners' word
}

// ---- the square: both players' totals, the garden, a line of words, Start ----
// A run can move both totals: the mover's by their own colour, the other player's by the other colour (s.ofrom -> s.oto).
const rowSpan = (s, p) => (s.by === p ? [s.from, s.to] : [s.ofrom == null ? s.to : s.ofrom, s.oto == null ? s.to : s.oto]);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.snake ? a.snake : null, T = snakeGoal(mini), l = mini.last, zoom = state.zoom;
  const fd = draft && draft.sq === zoom ? draft : null, replaying = !!(rep && rep.sq === zoom && rep.stage === 'inputs');
  const pre = s && !snakeShown(a) && !s.auto && !a.timeout && !mine(a) ? Number(s.ms) || 0 : 0;   // the run plays in the flash first (a bot's run online)
  const own = !view && !s && !d && !cpuTurn() && !remoteTurn() && !replaying;   // this phone's run to make
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const row = p => {
    const span = s && !s.auto ? rowSpan(s, p) : null, here = live && live.sq === zoom && !s && performance.now() - live.at < 20000 ? live.view.sim : null;
    const hereAt = here ? (here.p === p ? here.from + here.got : here.ofrom + here.gave) : null;
    const at = fd ? (fd.p === p ? fd.sim.from + fd.sim.got : fd.sim.ofrom + fd.sim.gave) : span ? span[1] : hereAt != null && hereAt > mini.score[p] ? hereAt : mini.score[p];
    const grow = !!span && span[1] > span[0], w1 = 100 * Math.min(1, at / T), w0 = grow ? 100 * Math.min(1, span[0] / T) : w1;
    const say = grow && pre ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${fmtN(span[0])} / ${fmtN(T)}</span><span class="tf" style="--f:${pre}ms">${fmtN(at)} / ${fmtN(T)}</span></span>` : `${fmtN(at)} / ${fmtN(T)}`;
    return `<div class="rprog snk-prog ${p}${!view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${T}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:${RUNT.bar}ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${say}</small></div>`;
  };
  const shown = s || ((d || view) && l && !l.auto ? l : null), who = s ? a.by : shown ? shown.by : turn;
  const said = shown ? resultText(shown, T, W) : null;
  const words = s ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is having a go…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : fd ? '<span></span>'
    : replaying ? `<span>${W(rep.by)} is having a go…</span>`
    : own && moveWait ? '<span></span>'   // (your own run never waits: the server confirms it in the background)
    : view || d ? (said ? `<span>${said.text}</span>` : '')
    : own ? '<span></span>'   // (how to play is in the ? explainer)
    : `<span>${waitLine(turn)}</span>`;
  const hudV = fd ? fd.sim.from + fd.sim.got : s ? s.to : mini.score[view && l ? l.by : turn];
  const scene = `<div class="snk-scene" data-snk="scene" aria-label="The garden grid, the snake and the food"><canvas data-snk="cv"></canvas><div class="rhud snk-hud" data-snk="hud">${fmtN(hudV)} / ${fmtN(T)}</div></div>`;
  const go = own && !fd && !locked && !moveWait;
  const btn = view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="snk-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the garden never moves
  ensureLoop();
  return `<div class="g-arc g-snake"><div class="snk"><div class="rprogs">${row('X')}${row('O')}</div><div class="snk-wrap">${scene}<p class="atwords snk-words">${words}</p></div></div>${btn}</div>`;   // (the words right under the scene, in their reserved row)
}
// What a run came to, in words (text) and whether it did the mover any good (ok). W(p): a player's name.
function resultText(s, T, W) {
  const who = W(s.by), q = s.by === 'X' ? 'O' : 'X';
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const gain = s.to - s.from, gave = (s.oto || 0) - (s.ofrom || 0);
  if (s.end === 'gift' || (s.oto >= T && gave > 0)) return { text: `${who} fed ${W(q)} the last point`, ok: false };
  const how = s.end === 'wall' ? 'hit the wall' : s.end === 'self' ? 'bit its own tail' : s.end === 'bomb' ? 'hit a bomb' : s.end === 'top' ? `reached ${fmtN(T)}!` : 'ran out of time';
  if (s.to >= T) return { text: `${who} ${how}`, ok: true };
  const tail = gave > 0 ? ` · ${W(q)} +${fmtN(gave)}` : ` · ${fmtN(s.to)} of ${fmtN(T)}`;
  return { text: `${who} ${how} · ${gain > 0 ? `+${fmtN(gain)}` : '+0'}${tail}`, ok: gain > gave };
}
export function moveText(f, who) {
  const s = f.snake;
  if (!s || s.auto) return `${who} ran out of time`;
  const g = s.to - s.from, gave = (s.oto || 0) - (s.ofrom || 0), q = s.by === 'X' ? 'O' : 'X';
  const mineTxt = g > 0 ? `${who} scored ${g} · ${fmtN(s.to)} of ${fmtN(s.goal)}` : `${who} scored nothing · ${fmtN(s.to)} of ${fmtN(s.goal)}`;
  return gave > 0 ? `${mineTxt} · gave ${q} ${gave}` : mineTxt;
}
// The move's sounds: a run shown before the move (the replay's chunks, this phone's own, the computer's here)
// has sounded as it went, so only the result; a run playing in its flash (a bot's) sounds as it plays, then
// the result: a ding for points, a thud for none.
export function sounds(f, add, won, mini, last) {
  const s = f.snake;
  if (!s) return;
  let pre = 0;
  if (!s.auto && !f.timeout && !snakeShown(f) && !mine(f) && typeof s.log === 'string') {
    const m = JSON.parse(JSON.stringify(mini)); m.score[s.by] = s.from; m.tries[s.by] = s.try; if (s.ofrom != null) m.score[s.by === 'X' ? 'O' : 'X'] = s.ofrom;
    const log = fingUnlog(s.log, 2 * Number(s.ticks) - 1, 3) || [], turns = new Map(log), sim = snakeStart(m, s.by);
    add('go', 0);
    let n = 0;
    while (sim.k < s.ticks && !sim.end && n < 220) {
      snakeFeed(sim, turns); snakeTick(sim, null);
      if (sim.turned) { add('snkTurn', sim.ms); n++; }
      if (sim.last === 'eat') { add('snkCrunch', sim.ms); n++; }
      if (sim.last === 'gift') { add('snkGulp', sim.ms); n++; }
    }
    if (s.end === 'wall' || s.end === 'self') add('snkBonk', sim.ms);
    else if (s.end === 'bomb') add('boom', sim.ms);
    else if (s.end === 'out') add('buzz', sim.ms);
    else if (s.end === 'top') add('sparkle', sim.ms);
    pre = Number(s.ms) || sim.ms;
  }
  add(s.auto ? 'thud' : s.to > s.from ? 'ding' : 'thud', pre + 150);
}
// The miniature: a small garden with each player's snake heading for its own food (X's red, O's yellow; each
// snake longer the nearer its total is to the target, its eyes on its food), and each player's total beside it, big.
export function miniature(mini, final) {
  const T = snakeGoal(mini), len = p => 2 + Math.round(3 * Math.min(1, mini.score[p] / T));
  const cells = pts => pts.map(([x, y]) => `${x * 8 + 4},${y * 8 + 4}`).join(' ');
  const xs = Array.from({ length: len('X') }, (_, i) => [i, 1]), os = Array.from({ length: len('O') }, (_, i) => [6 - i, 5]);
  const snake = (p, pts) => {                                      // (X's runs to the right, O's to the left: the head last, its eyes on the way ahead)
    const hx = pts[pts.length - 1][0] * 8 + 4, hy = pts[pts.length - 1][1] * 8 + 4, d = p === 'X' ? 1 : -1;
    const eye = dy => `<circle class="tsnk-e" cx="${hx + d * 0.9}" cy="${hy + dy}" r="1.25"/><circle class="tsnk-p" cx="${hx + d * 1.3}" cy="${hy + dy}" r=".6"/>`;
    return `<polyline class="tsnk-sh" points="${cells(pts)}" transform="translate(.8 1.3)"/><polyline class="tsnk-so" points="${cells(pts)}"/><polyline class="tsnk-s ${p}" points="${cells(pts)}"/><circle class="tsnk-h ${p}" cx="${hx}" cy="${hy}" r="3.7"/>${eye(-1.7)}${eye(1.7)}`;
  };
  const food = (p, x, y) => `<g class="tsnk-f ${p}" transform="translate(${x * 8 + 4} ${y * 8 + 4})"><ellipse class="tsnk-l" cx="2.4" cy="-5.4" rx="2.4" ry="1.2"/><circle r="4.6"/>${markSvgG(p, 2)}</g>`;
  const checks = []; for (let y = 0; y < 7; y++) for (let x = y % 2; x < 7; x += 2) checks.push(`<rect class="tsnk-g" x="${x * 8}" y="${y * 8}" width="8" height="8"/>`);
  return `<div class="tsnk" aria-label="X has ${mini.score.X}, O has ${mini.score.O} of ${T} points"><svg viewBox="-1 -1 58 58" aria-hidden="true"><rect class="tsnk-b" x="0" y="0" width="56" height="56" rx="4"/>${checks.join('')}<rect class="tsnk-r" x="0" y="0" width="56" height="56" rx="4"/>${snake('X', xs)}${snake('O', os)}${food('X', 5.3, 1)}${food('O', 0.7, 5)}</svg><div class="tsnk-n"><div><b class="X">X</b><span>${mini.score.X}</span></div><div><b class="O">O</b><span>${mini.score.O}</span></div></div></div>`;
}
export const actions = { 'snk-start': () => snakeGo() };

// ---- the inputs: a swipe or a tap anywhere on the mini-game screen but its header, or the arrow keys ----
function tapDir(fd, x, y) {                                        // a tap: across the snake's way (above or below it running across; left or right of it running up or down)
  const g = fd.geom; if (!g) return null;
  const cv = app.querySelector('canvas[data-snk="cv"]'); if (!cv) return null;
  const r = cv.getBoundingClientRect(), [hx, hy] = fd.sim.body[0], sx = r.left + g.ox + (hx + 0.5) * g.k * (r.width / g.W), sy = r.top + g.oy + (hy + 0.5) * g.k * (r.height / g.H);
  const cur = snakeHeading(fd.sim);
  if (cur === 0 || cur === 2) return y < sy ? 3 : 1;
  return x < sx ? 2 : 0;
}
const KEYS = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 };
if (app && typeof app.addEventListener === 'function') {
  app.addEventListener('pointerdown', e => {
    const fd = draft;
    if (!fd || (fd.phase !== 'play' && fd.phase !== 'ready') || !runInputAt(e.target)) return;
    e.preventDefault(); ownPress();
    try { (e.target.closest('main.scr.mini') || e.target).setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    fd.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  });
  app.addEventListener('pointermove', e => {
    const fd = draft;
    if (!fd || !fd.ptr || fd.ptr.id !== e.pointerId) return;
    const dx = e.clientX - fd.ptr.x, dy = e.clientY - fd.ptr.y;
    if (Math.hypot(dx, dy) < SWIPE_PX) return;
    queueTurn(fd, Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3));
    fd.ptr.x = e.clientX; fd.ptr.y = e.clientY; fd.ptr.moved = true;   // (a drag that bends turns again)
  });
  const up = e => {
    const fd = draft;
    if (!fd || !fd.ptr || fd.ptr.id !== e.pointerId) return;
    const p = fd.ptr; fd.ptr = null;
    if (!p.moved && e.type === 'pointerup') queueTurn(fd, tapDir(fd, e.clientX, e.clientY));
  };
  app.addEventListener('pointerup', up);
  app.addEventListener('pointercancel', up);
  // While a run is on, touches on the screen do nothing else: no scrolling, selection, magnifier or callout.
  ['touchstart', 'touchmove', 'touchend'].forEach(ev => app.addEventListener(ev, e => { if (draft && runInputAt(e.target) && e.cancelable) e.preventDefault(); }, { passive: false }));
  app.addEventListener('contextmenu', e => { if (draft && e.target && e.target.closest && e.target.closest('main.scr.mini')) e.preventDefault(); });
  document.addEventListener('keydown', e => {
    const fd = draft;
    if (!fd || (fd.phase !== 'play' && fd.phase !== 'ready') || KEYS[e.key] == null) return;
    e.preventDefault();
    if (!e.repeat) queueTurn(fd, KEYS[e.key]);
  });
  // The page hidden mid-run (another app, the lock button): the run ends there, its apples kept.
  document.addEventListener('visibilitychange', () => { if (document.hidden && draft && (draft.phase === 'play' || draft.phase === 'ready')) { stopRun(draft, performance.now()); finish(draft); } });
}
