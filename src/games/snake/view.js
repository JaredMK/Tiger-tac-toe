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
import { outlined, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { cpuTurn } from '../../ui/turns.js';

// ---------- Snake: one run a turn ----------
// The square opens on the garden grid with the snake at rest in the middle and Start below. Start begins
// a run: after a short moment the snake sets off to the right, snapping a cell a tick (no gliding between
// cells); a swipe anywhere on the screen (or a tap: above or below it while it runs across, left or right
// of it while it runs up or down; or the arrow keys) queues a turn for the next tick (two may wait: the
// rules' queue, rules.js snakeQueue). Food eaten grows it: its own colour a point for the mover, the other
// colour a point for the other player; the wall or its own tail ends the run, as
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
  snakeQueue(fd.sim, dir);
}
// A tick of the run as it plays here: its sounds and buzzes (this phone's own run), its effects.
function tickEvents(fd, sim, now, loud) {
  if (sim.turned && loud) SND.play('snkTurn');
  if (sim.last === 'eat' || sim.last === 'gift') {                // its own colour: a point for the mover; the other colour: a point for the other player
    const [x, y] = sim.body[0], c = sim.ate.c;
    fd.fx.push({ kind: 'eat', x, y, at: now, c, own: c === sim.p });
    if (loud) { if (c === sim.p) { SND.play('snkCrunch'); haptic('medium'); } else { SND.play('snkGulp'); haptic('error'); } }
  }
}
function endEvents(fd, sim, now, loud) {
  const [x, y] = sim.body[0];
  if (sim.end === 'wall' || sim.end === 'self') { fd.fx.push({ kind: 'bonk', x, y, at: now, dir: sim.dir, wall: sim.end === 'wall' }); if (loud) { SND.play('snkBonk'); haptic('error'); } }
  else if (sim.end === 'top') { fd.fx.push({ kind: 'win', x, y, at: now, c: sim.p }); if (loud) { SND.play('sparkle'); haptic('success'); } }
  else if (sim.end === 'gift') fd.fx.push({ kind: 'win', x, y, at: now, c: sim.p === 'X' ? 'O' : 'X' });   // (the other player's target, from food eaten here: its gulp has sounded)
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
      tickEvents(fd, fd.sim, now, true);
    }
    if (fd.sim.k > 0 && now - fd.chunkAt >= SNAKE_REP.chunkMs) noteChunk(fd, false, now);
    if (fd.sim.end) { fd.phase = 'end'; fd.endAt = now; fd.acc = 0; endEvents(fd, fd.sim, now, true); }
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
    tickEvents(rr, sim, now, loud);
    if (rr.endK != null && sim.k >= rr.endK) rr.done = true;
  }
  if (rr.endK != null && sim.k >= rr.endK && !rr.done) rr.done = true;
  if ((sim.end || rr.done) && !rr.endAt) { rr.endAt = now; if (!sim.end && rr.endK != null && rr.end) sim.end = rr.end; endEvents(rr, sim, now, loud); }
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
  if (hud) hud.textContent = `${fmtN(v.sim.from + v.sim.got)} / ${fmtN(v.sim.goal)}`;
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
// The garden grid, the food (X's red, O's yellow, each marked with its player's mark) and the snake (the
// player's colour, its eyes on the way ahead), snapped to its cells as the last tick left it (no gliding
// between cells, as on the old phones); the effects of the moment (a food's burst and whose point it was, the
// bonk at the wall, the stars at a target).
export function draw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, n = sim.n, k = Math.min(W, H) / n, ox = (W - n * k) / 2, oy = (H - n * k) / 2;
  const cx = x => ox + (x + 0.5) * k, cy = y => oy + (y + 0.5) * k, lw = f => Math.max(1.2, k * f);
  if (draft && v.sim === draft.sim) draft.geom = { ox, oy, k, W, H };
  c.fillStyle = '#e3f1cd'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#d3e8b6';
  for (let y = 0; y < n; y++) for (let x = (y % 2); x < n; x += 2) c.fillRect(ox + x * k, oy + y * k, k, k);
  // the food: a round berry in its player's colour with their mark on it and a leaf (a gentle bob while a run is on)
  for (const f of sim.food) {
    if (!f) continue;
    const [fx, fy, fc] = f, bob = v.still || REDUCED ? 0 : k * 0.04 * Math.sin(now / 260 + fx + fy), r = k * 0.36, x = cx(fx), y = cy(fy) + k * 0.05 + bob;
    c.beginPath(); c.ellipse(x + r * 0.45, y - r * 1.02, r * 0.46, r * 0.22, -0.5, 0, Math.PI * 2); outlined(c, P.green, P.ink, lw(0.05));
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); outlined(c, fc === 'O' ? P.O : P.X, P.ink, lw(0.07));
    c.strokeStyle = fc === 'O' ? P.ink : '#fff'; c.lineCap = 'round'; c.lineWidth = lw(0.085);
    const h = r * 0.42;
    if (fc === 'O') { c.beginPath(); c.arc(x, y, h * 0.95, 0, Math.PI * 2); c.stroke(); }
    else { c.beginPath(); c.moveTo(x - h, y - h); c.lineTo(x + h, y + h); c.moveTo(x + h, y - h); c.lineTo(x - h, y + h); c.stroke(); }
  }
  // the snake: through the centres of its cells, exactly where the last tick put it
  const body = sim.body, path = body.map(([x, y]) => [cx(x), cy(y)]), head = path[0];
  const [dx, dy] = DIRS[sim.dir];
  const endAgo = sim.end && v.endAt ? now - v.endAt : null;
  const col = sim.p === 'O' ? P.O : P.X, w = k * 0.74, dead = sim.end === 'wall' || sim.end === 'self';
  c.save();
  if (dead && endAgo != null) c.globalAlpha = 0.72 + 0.28 * Math.max(0, 1 - endAgo / 300);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const trace = from => { c.beginPath(); c.moveTo(path[from][0], path[from][1]); for (let i = from + 1; i < path.length; i++) c.lineTo(path[i][0], path[i][1]); };
  trace(0); c.strokeStyle = P.ink; c.lineWidth = w + Math.max(3, k * 0.16); c.stroke();
  trace(0); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  if (path.length > 1) {
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = w * 0.3; trace(1); c.stroke();   // the belly line, stopping short of the head
    c.setLineDash([k * 0.18, k * 0.32]); c.lineDashOffset = -sim.k * k * 0.5;               // the scales: dashes along the back, a step on each tick
    c.strokeStyle = 'rgba(22,18,16,.16)'; c.lineWidth = w * 0.42; trace(1); c.stroke(); c.setLineDash([]);
  }
  // the head: a little bigger, two eyes looking ahead, the tongue out when its own food is close
  const hr = w * 0.62, px = -dy, py = dx;
  c.beginPath(); c.arc(head[0], head[1], hr, 0, Math.PI * 2); outlined(c, col, P.ink, lw(0.08));
  const squint = dead && endAgo != null && endAgo < 1200;
  for (const s of [-1, 1]) {
    const ex = head[0] + px * s * hr * 0.5 + dx * hr * 0.22, ey = head[1] + py * s * hr * 0.5 + dy * hr * 0.22;
    if (squint) { c.strokeStyle = P.ink; c.lineWidth = lw(0.07); c.beginPath(); c.moveTo(ex - hr * 0.2, ey - hr * 0.2); c.lineTo(ex + hr * 0.2, ey + hr * 0.2); c.moveTo(ex + hr * 0.2, ey - hr * 0.2); c.lineTo(ex - hr * 0.2, ey + hr * 0.2); c.stroke(); continue; }
    c.beginPath(); c.arc(ex, ey, hr * 0.26, 0, Math.PI * 2); outlined(c, '#fff', P.ink, lw(0.05));
    c.fillStyle = P.ink; c.beginPath(); c.arc(ex + dx * hr * 0.1, ey + dy * hr * 0.1, hr * 0.13, 0, Math.PI * 2); c.fill();
  }
  if (!sim.end && !v.still) {
    const [hx, hy] = body[0], near = sim.food.some(f => f && f[2] === sim.p && (f[0] - hx) * dx + (f[1] - hy) * dy > 0 && (f[0] - hx) * dx + (f[1] - hy) * dy <= 3 && Math.abs((f[0] - hx) * px + (f[1] - hy) * py) <= 1);
    if (near && Math.floor(now / 220) % 3 !== 0) {
      c.strokeStyle = '#e0434f'; c.lineWidth = lw(0.08); c.lineCap = 'round';
      const tx = head[0] + dx * hr, ty = head[1] + dy * hr, fl = hr * 0.55;
      c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + dx * fl, ty + dy * fl); c.lineTo(tx + dx * fl * 1.4 + px * fl * 0.35, ty + dy * fl * 1.4 + py * fl * 0.35); c.moveTo(tx + dx * fl, ty + dy * fl); c.lineTo(tx + dx * fl * 1.4 - px * fl * 0.35, ty + dy * fl * 1.4 - py * fl * 0.35); c.stroke();
    }
  }
  c.restore();
  // the effects of the moment
  c.font = `400 ${Math.max(12, Math.round(k * 0.7))}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const x of v.fx || []) {
    const t = (now - x.at) / MAX_FX_MS;
    if (t < 0 || t > 1) continue;
    const X = cx(x.x), Y = cy(x.y);
    if (x.kind === 'eat') {                                         // the point and whose it is: "+1" in the mover's colour, or "+1 O" (the other player's) in theirs
      const fc = x.c === 'O' ? P.O : P.X, txt = x.own ? '+1' : `+1 ${x.c}`;
      c.save(); c.globalAlpha = 1 - t; c.strokeStyle = fc; c.lineWidth = Math.max(2, k * 0.1); c.beginPath(); c.arc(X, Y, k * (0.3 + 0.7 * t), 0, Math.PI * 2); c.stroke();
      c.fillStyle = fc; c.strokeStyle = P.ink; c.lineWidth = 3; c.strokeText(txt, X, Y - k * (0.3 + 0.9 * t)); c.fillText(txt, X, Y - k * (0.3 + 0.9 * t)); c.restore();
    } else if (x.kind === 'bonk') {
      const [bx, by] = DIRS[x.dir], hx = X + bx * k * 0.45, hy = Y + by * k * 0.45;
      c.save(); c.globalAlpha = 1 - t; c.strokeStyle = P.ink; c.lineWidth = Math.max(2, k * 0.09); c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = Math.atan2(by, bx) + (i - 2.5) * 0.45, r0 = k * (0.35 + 0.5 * t), r1 = r0 + k * 0.3; c.beginPath(); c.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); c.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); c.stroke(); }
      c.restore();
    } else if (x.kind === 'win') {
      c.save(); c.globalAlpha = 1 - t * t; c.fillStyle = x.c === 'O' ? P.O : P.X; c.strokeStyle = P.ink; c.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, r = k * (0.5 + 1.6 * t), sx = X + Math.cos(a) * r, sy = Y + Math.sin(a) * r - k * t; c.strokeText('✦', sx, sy); c.fillText('✦', sx, sy); }
      c.restore();
    }
  }
  if (v.ready && !REDUCED) {                                        // Start pressed: a small "ready" ring about the head before it sets off
    const t = Math.min(1, (now - (draft ? draft.at : now)) / READY_MS);
    c.save(); c.globalAlpha = 0.5 * (1 - t); c.strokeStyle = P.ink; c.lineWidth = lw(0.08); c.beginPath(); c.arc(head[0], head[1], hr + k * 0.5 * t, 0, Math.PI * 2); c.stroke(); c.restore();
  }
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
  const how = s.end === 'wall' ? 'hit the wall' : s.end === 'self' ? 'bit its own tail' : s.end === 'top' ? `reached ${fmtN(T)}!` : 'ran out of time';
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
    else if (s.end === 'top') add('sparkle', sim.ms);
    pre = Number(s.ms) || sim.ms;
  }
  add(s.auto ? 'thud' : s.to > s.from ? 'ding' : 'thud', pre + 150);
}
// The miniature: a small garden with each player's snake heading for its own food (X's red, O's yellow; each
// snake longer the nearer its total is to the target), and each player's total beside it, big.
export function miniature(mini, final) {
  const T = snakeGoal(mini), len = p => 2 + Math.round(3 * Math.min(1, mini.score[p] / T));
  const cells = pts => pts.map(([x, y]) => `${x * 8 + 4},${y * 8 + 4}`).join(' ');
  const xs = Array.from({ length: len('X') }, (_, i) => [i, 1]), os = Array.from({ length: len('O') }, (_, i) => [6 - i, 5]);
  const snake = (p, pts) => `<polyline class="tsnk-so" points="${cells(pts)}"/><polyline class="tsnk-s ${p}" points="${cells(pts)}"/><circle class="tsnk-h ${p}" cx="${pts[pts.length - 1][0] * 8 + 4}" cy="${pts[pts.length - 1][1] * 8 + 4}" r="3.4"/>`;
  const food = (p, x, y) => `<g class="tsnk-f ${p}" transform="translate(${x * 8 + 4} ${y * 8 + 4})"><ellipse class="tsnk-l" cx="2.4" cy="-5.4" rx="2.4" ry="1.2"/><circle r="4.6"/>${markSvgG(p, 2)}</g>`;
  const checks = []; for (let y = 0; y < 7; y++) for (let x = y % 2; x < 7; x += 2) checks.push(`<rect class="tsnk-g" x="${x * 8}" y="${y * 8}" width="8" height="8"/>`);
  return `<div class="tsnk" aria-label="X has ${mini.score.X}, O has ${mini.score.O} of ${T} points"><svg viewBox="-1 -1 58 58" aria-hidden="true"><rect class="tsnk-b" x="0" y="0" width="56" height="56" rx="4"/>${checks.join('')}${snake('X', xs)}${snake('O', os)}${food('X', 5.3, 1)}${food('O', 0.7, 5)}</svg><div class="tsnk-n"><div><b class="X">X</b><span>${mini.score.X}</span></div><div><b class="O">O</b><span>${mini.score.O}</span></div></div></div>`;
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
