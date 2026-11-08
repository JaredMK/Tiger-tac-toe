// Snake: the screen, the miniature, the move's words and sounds, and the inputs (swipes, taps and the arrow keys).
import { tune } from '../../core/tune.js';
import { fingUnlog } from '../shared/finger.js';
import { RUNT } from '../shared/runner.js';
import { DIRS, SNAKE, SNAKE_REP, snakeChunkParse, snakeChunkVals, snakeEats, snakeResult, snakeShown, snakeStart, snakeSynthList, snakeTick, snakeTickMs } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { moveWait, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state } from '../../ui/app.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { rep, repNote } from '../../ui/replay.js';
import { outlined, rr, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { cpuTurn } from '../../ui/turns.js';

// ---------- Snake: one run a turn ----------
// The square opens on the garden grid with the snake at rest in the middle and Start below. Start begins
// a run: after a short moment the snake sets off to the right, a cell a tick; a swipe anywhere on the
// screen (or a tap: above or below it while it runs across, left or right of it while it runs up or down;
// or the arrow keys) turns it. Apples eaten grow it and count; the wall or its own tail ends the run, as
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
let draft = null;        // the run under way here: { sq, p, id, mini, sim, phase: 'ready' | 'play' | 'end', at, last, acc, queue, ptr, fx, chunkAt, noted, geom, endAt, goAt }
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
  draft = { sq: i, p, id: idOf(i, p), mini: sq.mini, sim: snakeStart(sq.mini, p), phase: 'ready', at: now, last: now, acc: 0, queue: [], ptr: null, fx: [], chunkAt: now, noted: 0, geom: null, endAt: 0, goAt: 0 };
  live = null;
  SND.play('go');
  render();
  ensureLoop();
}
function queueTurn(fd, dir) {
  if (!fd || (fd.phase !== 'play' && fd.phase !== 'ready') || dir == null) return;
  const cur = fd.queue.length ? fd.queue[fd.queue.length - 1] : fd.sim.dir;
  if (dir === cur || (dir + 2) % 4 === cur) return;              // (straight on, or straight back: nothing)
  if (fd.queue.length < 2) fd.queue.push(dir);
}
// A tick of the run as it plays here: its sounds and buzzes (this phone's own run), its effects.
function tickEvents(fd, sim, now, loud) {
  if (sim.turned && loud) SND.play('snkTurn');
  if (sim.last === 'eat' || sim.last === 'gold') {
    const [x, y] = sim.body[0];
    fd.fx.push({ kind: 'eat', x, y, at: now, gold: sim.last === 'gold', n: sim.last === 'gold' ? sim.cfg.goldWorth : 1 });
    if (loud) { SND.play('snkCrunch'); haptic('medium'); }
  }
}
function endEvents(fd, sim, now, loud) {
  const [x, y] = sim.body[0];
  if (sim.end === 'wall' || sim.end === 'self') { fd.fx.push({ kind: 'bonk', x, y, at: now, dir: sim.dir, wall: sim.end === 'wall' }); if (loud) { SND.play('snkBonk'); haptic('error'); } }
  else if (sim.end === 'top') { fd.fx.push({ kind: 'win', x, y, at: now }); if (loud) { SND.play('sparkle'); haptic('success'); } }
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
      snakeTick(fd.sim, fd.queue.length ? fd.queue.shift() : null);
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
    if (now - fd.endAt >= (fd.sim.end === 'top' ? SNAKE.winPause : fd.sim.end === 'stop' ? 300 : SNAKE.endPause)) finish(fd);
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
  const sim = fd.sim, turns = sim.rec.slice(fd.noted);
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
  for (const [t, d] of c.turns) repRun.turns.set(t, d);
  repRun.horizon = Math.max(repRun.horizon, c.k);
  if (c.end) repRun.endK = c.k;
  return true;
}
function repSynth(move, mini, o) {
  if (!move || typeof move !== 'object' || typeof move.log !== 'string') return null;
  const m = JSON.parse(JSON.stringify(mini)), log = fingUnlog(move.log, Number(move.ticks), 3);
  if (!log) return null;
  const sim = snakeStart(m, o.by);
  let j = 0;
  while (sim.k < move.ticks && !sim.end) { let d = null; if (j < log.length && log[j][0] === sim.k) d = log[j++][1]; snakeTick(sim, d); }
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
    snakeTick(sim, rr.turns.has(sim.k) ? rr.turns.get(sim.k) : null);
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
    m.score[s.by] = s.from; m.tries[s.by] = s.try;                 // the square as the mover found it
    const log = fingUnlog(s.log, Number(s.ticks), 3) || [];
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
    if (draft === fd) { v = { sim: fd.sim, u: fd.phase === 'play' && !fd.sim.end ? Math.min(0.999, fd.acc / snakeTickMs(fd.sim)) : 0, fx: fd.fx, endAt: fd.endAt, p: fd.p, ready: fd.phase === 'ready' }; more = true; }
  }
  const f = state.flash && state.flash.square === state.zoom && state.flash.snake ? state.flash : null;
  if (!v && f && !snakeShown(f) && !f.snake.auto && !f.timeout && !mine(f)) {   // a run playing in its flash (no whole replay log), timed from the move
    const fb = fallbackOf(f), start = fxAt('move', f);
    if (fb && start != null) {
      const T = Math.max(0, now - start);
      stepRep(fb, T, now, false);
      const sim = fb.sim, next = !sim.end && !fb.done && sim.k < fb.horizon;
      v = { sim, u: next ? Math.min(0.999, Math.max(0, (T - sim.at[sim.k]) / snakeTickMs(sim))) : 0, fx: fb.fx, endAt: fb.endAt, p: sim.p };
      more = next || now - (fb.endAt || now) < MAX_FX_MS;
    }
  }
  const rr = !v && repRun && repRun.sq === state.zoom && rep && rep.sq === state.zoom ? repRun : null;
  if (rr) {
    const T = Math.max(0, (now - rr.t0 - rr.lag) * rr.speed);
    stepRep(rr, T, now, true);
    const sim = rr.sim, next = !sim.end && !rr.done && sim.k < rr.horizon;
    v = { sim, u: next ? Math.min(0.98, Math.max(0, (T - sim.at[sim.k]) / snakeTickMs(sim))) : 0, fx: rr.fx, endAt: rr.endAt, p: sim.p };
    more = true;
  } else if (repRun && !(rep && rep.sq === repRun.sq)) repRun = null;
  if (!v) {
    const lv = live && live.sq === state.zoom ? live : null;
    if (lv && (f ? f.by === lv.p : state.turn === lv.p && now - lv.at < 15000) && (!state.done || state.done.by === lv.p)) { v = lv.view; more = now - lv.at < MAX_FX_MS; }
    else { const p = sq.owner || (f ? f.by : state.turn); v = { sim: snakeStart(sq.mini, p), u: 0, fx: [], endAt: 0, p, still: true }; }
  }
  draw(cv, v, now);
  const hud = app.querySelector('[data-snk="hud"]');
  if (hud) hud.textContent = `${fmtN(v.sim.from + v.sim.ate)} / ${fmtN(v.sim.goal)}`;
  const row = fd ? app.querySelector(`.snk-prog.${fd.p} .rbar i`) : null;
  if (row) { const w = (100 * Math.min(1, (fd.sim.from + fd.sim.ate) / fd.sim.goal)).toFixed(2) + '%'; row.classList.remove('grow'); row.style.setProperty('--w0', w); row.style.setProperty('--w1', w); const sm = app.querySelector(`.snk-prog.${fd.p} small`); if (sm) sm.textContent = `${fmtN(fd.sim.from + fd.sim.ate)} / ${fmtN(fd.sim.goal)}`; }
  if (v.fx && v.fx.some(x => now - x.at < MAX_FX_MS)) more = true;
  if (v.sim.apple && !v.still && !REDUCED) more = true;           // (the apple's shine, while anything is going on)
  if (more) ensureLoop();
}
// The garden grid, the apple and the snake (the player's colour, its eyes on the way ahead), the effects of
// the moment (an apple's burst and its points, the bonk at the wall, the stars at the target).
export function draw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, n = sim.n, k = Math.min(W, H) / n, ox = (W - n * k) / 2, oy = (H - n * k) / 2;
  const cx = x => ox + (x + 0.5) * k, cy = y => oy + (y + 0.5) * k;
  if (draft && v.sim === draft.sim) draft.geom = { ox, oy, k, W, H };
  c.fillStyle = '#e3f1cd'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#d3e8b6';
  for (let y = 0; y < n; y++) for (let x = (y % 2); x < n; x += 2) c.fillRect(ox + x * k, oy + y * k, k, k);
  // the apple (a golden one shines)
  if (sim.apple) {
    const [ax, ay, gold] = sim.apple, pulse = v.still || REDUCED ? 1 : 1 + 0.05 * Math.sin(now / 260), r = k * 0.34 * pulse, x = cx(ax), y = cy(ay) + k * 0.04;
    if (gold) { c.fillStyle = 'rgba(246,194,27,.35)'; c.beginPath(); c.arc(x, y, r * 1.5 + k * 0.05 * Math.sin(now / 180), 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, k * 0.07); c.beginPath(); c.moveTo(x, y - r * 0.8); c.quadraticCurveTo(x + r * 0.15, y - r * 1.35, x + r * 0.45, y - r * 1.4); c.stroke();
    c.beginPath(); c.ellipse(x + r * 0.55, y - r * 1.05, r * 0.5, r * 0.24, -0.5, 0, Math.PI * 2); outlined(c, P.green, P.ink, Math.max(1.2, k * 0.05));
    c.beginPath(); c.arc(x - r * 0.3, y, r, 0, Math.PI * 2); c.arc(x + r * 0.3, y, r, 0, Math.PI * 2); outlined(c, gold ? '#f2b826' : '#d93a2b', P.ink, Math.max(1.5, k * 0.07));
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - r * 0.45, y - r * 0.35, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2); c.fill();
  }
  // the snake: through the centres of its cells, the head on its way to the next, the tail drawing in behind
  const body = sim.body, L = body.length, pts = body.map(([x, y]) => [cx(x), cy(y)]);
  const [dx, dy] = DIRS[sim.dir], u = v.u || 0, grow = snakeEats(sim);
  const endAgo = sim.end && v.endAt ? now - v.endAt : null;
  let bump = 0;
  if ((sim.end === 'wall' || sim.end === 'self') && endAgo != null && endAgo < 420) bump = 0.22 * Math.sin(Math.min(1, endAgo / 420) * Math.PI);
  const head = [pts[0][0] + dx * k * (u + bump), pts[0][1] + dy * k * (u + bump)];
  if (L > 1 && !grow && u > 0) { const t = pts[L - 1], q = pts[L - 2]; pts[L - 1] = [t[0] + (q[0] - t[0]) * u, t[1] + (q[1] - t[1]) * u]; }
  const path = [head].concat(pts);
  const col = sim.p === 'O' ? P.O : P.X, w = k * 0.74, dead = sim.end === 'wall' || sim.end === 'self';
  c.save();
  if (dead && endAgo != null) c.globalAlpha = 0.72 + 0.28 * Math.max(0, 1 - endAgo / 300);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const trace = () => { c.beginPath(); c.moveTo(path[0][0], path[0][1]); for (let i = 1; i < path.length; i++) c.lineTo(path[i][0], path[i][1]); };
  trace(); c.strokeStyle = P.ink; c.lineWidth = w + Math.max(3, k * 0.16); c.stroke();
  trace(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = w * 0.3;    // the belly line, stopping short of the head
  c.beginPath(); c.moveTo(path[1][0], path[1][1]); for (let i = 2; i < path.length; i++) c.lineTo(path[i][0], path[i][1]); c.stroke();
  c.setLineDash([k * 0.18, k * 0.36]); c.lineDashOffset = -(sim.ms + u * snakeTickMs(sim)) / 24;   // the scales: dashes along the back
  c.strokeStyle = 'rgba(22,18,16,.16)'; c.lineWidth = w * 0.42; c.beginPath(); c.moveTo(path[1][0], path[1][1]); for (let i = 2; i < path.length; i++) c.lineTo(path[i][0], path[i][1]); c.stroke(); c.setLineDash([]);
  // the head: a little bigger, two eyes looking ahead, the tongue out when the apple is close
  const hr = w * 0.62, px = -dy, py = dx;
  c.beginPath(); c.arc(head[0], head[1], hr, 0, Math.PI * 2); outlined(c, col, P.ink, Math.max(1.5, k * 0.08));
  const squint = dead && endAgo != null && endAgo < 1200;
  for (const s of [-1, 1]) {
    const ex = head[0] + px * s * hr * 0.5 + dx * hr * 0.22, ey = head[1] + py * s * hr * 0.5 + dy * hr * 0.22;
    if (squint) { c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, k * 0.07); c.beginPath(); c.moveTo(ex - hr * 0.2, ey - hr * 0.2); c.lineTo(ex + hr * 0.2, ey + hr * 0.2); c.moveTo(ex + hr * 0.2, ey - hr * 0.2); c.lineTo(ex - hr * 0.2, ey + hr * 0.2); c.stroke(); continue; }
    c.beginPath(); c.arc(ex, ey, hr * 0.26, 0, Math.PI * 2); outlined(c, '#fff', P.ink, Math.max(1, k * 0.05));
    c.fillStyle = P.ink; c.beginPath(); c.arc(ex + dx * hr * 0.1, ey + dy * hr * 0.1, hr * 0.13, 0, Math.PI * 2); c.fill();
  }
  if (sim.apple && !sim.end) {
    const [ax, ay] = sim.apple, [hx, hy] = body[0], near = (ax - hx) * dx + (ay - hy) * dy;
    if (near > 0 && near <= 3 && Math.abs((ax - hx) * px + (ay - hy) * py) <= 1 && Math.floor(now / 220) % 3 !== 0) {
      c.strokeStyle = '#e0434f'; c.lineWidth = Math.max(1.5, k * 0.08); c.lineCap = 'round';
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
    if (x.kind === 'eat') {
      c.save(); c.globalAlpha = 1 - t; c.strokeStyle = x.gold ? '#f2b826' : '#d93a2b'; c.lineWidth = Math.max(2, k * 0.1); c.beginPath(); c.arc(X, Y, k * (0.3 + 0.7 * t), 0, Math.PI * 2); c.stroke();
      c.fillStyle = x.gold ? '#f2b826' : P.ink; c.strokeStyle = x.gold ? P.ink : P.paper; c.lineWidth = 3; c.strokeText(`+${x.n}`, X, Y - k * (0.3 + 0.9 * t)); c.fillText(`+${x.n}`, X, Y - k * (0.3 + 0.9 * t)); c.restore();
    } else if (x.kind === 'bonk') {
      const [bx, by] = DIRS[x.dir], hx = X + bx * k * 0.45, hy = Y + by * k * 0.45;
      c.save(); c.globalAlpha = 1 - t; c.strokeStyle = P.ink; c.lineWidth = Math.max(2, k * 0.09); c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = Math.atan2(by, bx) + (i - 2.5) * 0.45, r0 = k * (0.35 + 0.5 * t), r1 = r0 + k * 0.3; c.beginPath(); c.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); c.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); c.stroke(); }
      c.restore();
    } else if (x.kind === 'win') {
      c.save(); c.globalAlpha = 1 - t * t; c.fillStyle = '#f2b826'; c.strokeStyle = P.ink; c.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, r = k * (0.5 + 1.6 * t), sx = X + Math.cos(a) * r, sy = Y + Math.sin(a) * r - k * t; c.strokeText('✦', sx, sy); c.fillText('✦', sx, sy); }
      c.restore();
    }
  }
  if (v.ready && !REDUCED) {                                        // Start pressed: a small "ready" ring about the head before it sets off
    const t = Math.min(1, (now - (draft ? draft.at : now)) / READY_MS);
    c.save(); c.globalAlpha = 0.5 * (1 - t); c.strokeStyle = P.ink; c.lineWidth = Math.max(2, k * 0.08); c.beginPath(); c.arc(head[0], head[1], hr + k * 0.5 * t, 0, Math.PI * 2); c.stroke(); c.restore();
  }
}

// ---- the square: both players' totals, the garden, a line of words, Start ----
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.snake ? a.snake : null, T = tune(mini).target, l = mini.last, zoom = state.zoom;
  const fd = draft && draft.sq === zoom ? draft : null, replaying = !!(rep && rep.sq === zoom && rep.stage === 'inputs');
  const pre = s && !snakeShown(a) && !s.auto && !a.timeout && !mine(a) ? Number(s.ms) || 0 : 0;   // the run plays in the flash first (a bot's run online)
  const own = !view && !s && !d && !cpuTurn() && !remoteTurn() && !replaying;   // this phone's run to make
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const row = p => {
    const fresh = !!s && s.by === p, here = live && live.sq === zoom && live.p === p && !fresh && performance.now() - live.at < 20000 ? live : null;
    const at = fd && fd.p === p ? fd.sim.from + fd.sim.ate : fresh ? s.to : here && here.view.sim.from + here.view.sim.ate > mini.score[p] ? here.view.sim.from + here.view.sim.ate : mini.score[p];
    const grow = fresh && s.to > s.from, w1 = 100 * Math.min(1, at / T), w0 = grow ? 100 * Math.min(1, s.from / T) : w1;
    const say = grow && pre ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${fmtN(s.from)} / ${fmtN(T)}</span><span class="tf" style="--f:${pre}ms">${fmtN(at)} / ${fmtN(T)}</span></span>` : `${fmtN(at)} / ${fmtN(T)}`;
    return `<div class="rprog snk-prog ${p}${!view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${T}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:${RUNT.bar}ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${say}</small></div>`;
  };
  const shown = s || ((d || view) && l && !l.auto ? l : null), who = s ? a.by : shown ? shown.by : turn;
  const said = shown ? resultText(shown, T, W(who)) : null;
  const words = s ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is having a go…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : fd ? '<span></span>'
    : replaying ? `<span>${W(rep.by)} is having a go…</span>`
    : own && moveWait ? '<span>Sending your run…</span>'
    : view || d ? (said ? `<span>${said.text}</span>` : '')
    : own ? '<span></span>'   // (how to play is in the ? explainer)
    : `<span>Waiting for ${W(turn)}…</span>`;
  const hudV = fd ? fd.sim.from + fd.sim.ate : s ? s.to : mini.score[view && l ? l.by : turn];
  const scene = `<div class="snk-scene" data-snk="scene" aria-label="The garden grid, the snake and the apple"><canvas data-snk="cv"></canvas><div class="rhud snk-hud" data-snk="hud">${fmtN(hudV)} / ${fmtN(T)}</div></div>`;
  const go = own && !fd && !locked && !moveWait;
  const btn = view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="snk-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the garden never moves
  ensureLoop();
  return `<div class="g-arc g-snake"><div class="snk"><div class="rprogs">${row('X')}${row('O')}</div><div class="snk-wrap">${scene}<p class="atwords snk-words">${words}</p></div></div>${btn}</div>`;   // (the words right under the scene, in their reserved row)
}
// What a run came to, in words (text) and whether it gained anything (ok).
function resultText(s, T, who) {
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const gain = s.to - s.from, how = s.end === 'wall' ? 'hit the wall' : s.end === 'self' ? 'bit its own tail' : s.end === 'top' ? `reached ${fmtN(T)}!` : 'ran out of time';
  if (s.to >= T) return { text: `${who} ${how}`, ok: true };
  return { text: `${who} ${how} · ${gain > 0 ? `+${fmtN(gain)} · ` : ''}${fmtN(s.to)} of ${fmtN(T)}`, ok: gain > 0 };
}
export function moveText(f, who) {
  const s = f.snake;
  if (!s || s.auto) return `${who} ran out of time`;
  const g = s.to - s.from;
  return g > 0 ? `${who} ate ${g} apple${g === 1 ? '' : 's'} · ${fmtN(s.to)} of ${fmtN(s.goal)}` : `${who} ate nothing · ${fmtN(s.to)} of ${fmtN(s.goal)}`;
}
// The move's sounds: a run shown before the move (the replay's chunks, this phone's own, the computer's here)
// has sounded as it went, so only the result; a run playing in its flash (a bot's) sounds as it plays, then
// the result: a ding for apples, a thud for none.
export function sounds(f, add, won, mini, last) {
  const s = f.snake;
  if (!s) return;
  let pre = 0;
  if (!s.auto && !f.timeout && !snakeShown(f) && !mine(f) && typeof s.log === 'string') {
    const m = JSON.parse(JSON.stringify(mini)); m.score[s.by] = s.from; m.tries[s.by] = s.try;
    const log = fingUnlog(s.log, Number(s.ticks), 3) || [], turns = new Map(log), sim = snakeStart(m, s.by);
    add('go', 0);
    let n = 0;
    while (sim.k < s.ticks && !sim.end && n < 220) {
      snakeTick(sim, turns.has(sim.k) ? turns.get(sim.k) : null);
      if (sim.turned) { add('snkTurn', sim.ms); n++; }
      if (sim.last === 'eat' || sim.last === 'gold') { add('snkCrunch', sim.ms); n++; }
    }
    if (s.end === 'wall' || s.end === 'self') add('snkBonk', sim.ms);
    else if (s.end === 'top') add('sparkle', sim.ms);
    pre = Number(s.ms) || sim.ms;
  }
  add(s.auto ? 'thud' : s.to > s.from ? 'ding' : 'thud', pre + 150);
}
// The miniature: a small garden with each player's snake (longer the nearer their total is to the target) and
// the apple, and each player's count beside it.
export function miniature(mini, final) {
  const T = tune(mini).target, len = p => 2 + Math.round(4 * Math.min(1, mini.score[p] / T));
  const cells = (pts) => pts.map(([x, y]) => `${x * 8 + 4},${y * 8 + 4}`).join(' ');
  const xs = Array.from({ length: len('X') }, (_, i) => [i, 1]), os = Array.from({ length: len('O') }, (_, i) => [6 - i, 5]);
  const snake = (p, pts) => `<polyline class="tsnk-so" points="${cells(pts)}"/><polyline class="tsnk-s ${p}" points="${cells(pts)}"/><circle class="tsnk-h ${p}" cx="${pts[pts.length - 1][0] * 8 + 4}" cy="${pts[pts.length - 1][1] * 8 + 4}" r="3.4"/>`;
  const checks = []; for (let y = 0; y < 7; y++) for (let x = y % 2; x < 7; x += 2) checks.push(`<rect class="tsnk-g" x="${x * 8}" y="${y * 8}" width="8" height="8"/>`);
  return `<div class="tsnk" aria-label="X has ${mini.score.X}, O has ${mini.score.O} of ${T} apples"><svg viewBox="-1 -1 58 58" aria-hidden="true"><rect class="tsnk-b" x="0" y="0" width="56" height="56" rx="4"/>${checks.join('')}${snake('X', xs)}${snake('O', os)}<circle class="tsnk-a" cx="28" cy="28" r="3.2"/><ellipse class="tsnk-l" cx="30" cy="24" rx="2" ry="1"/></svg><div class="tsnk-n"><div><b class="X">X</b><span>${mini.score.X}</span><small>/${T}</small></div><div><b class="O">O</b><span>${mini.score.O}</span><small>/${T}</small></div></div></div>`;
}
export const actions = { 'snk-start': () => snakeGo() };

// ---- the inputs: a swipe or a tap anywhere on the mini-game screen but its header, or the arrow keys ----
function tapDir(fd, x, y) {                                        // a tap: across the snake's way (above or below it running across; left or right of it running up or down)
  const g = fd.geom; if (!g) return null;
  const cv = app.querySelector('canvas[data-snk="cv"]'); if (!cv) return null;
  const r = cv.getBoundingClientRect(), [hx, hy] = fd.sim.body[0], sx = r.left + g.ox + (hx + 0.5) * g.k * (r.width / g.W), sy = r.top + g.oy + (hy + 0.5) * g.k * (r.height / g.H);
  const cur = fd.queue.length ? fd.queue[fd.queue.length - 1] : fd.sim.dir;
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
