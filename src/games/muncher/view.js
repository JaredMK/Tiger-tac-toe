// Muncher: the screen, the miniature, the move's words and sounds, and the inputs.
import { DIRS, MUN, MUN_VIEW, cellAt, layoutOf, munAte, munCell, munGh, munInput, munMove, munMs, munPos, munRawMs, munScore, munSimScore, munStart, munStep, munTarget, munUnlog, munVer } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, remoteTurn } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { shownSq } from '../../ui/chaos.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { drawTimeBar, runCanvas, runColours, runInputAt } from '../../ui/runner.js';
import { FONT, backOut, banner, clamp01, easeOut, impact, jolt, starPath } from '../../ui/runfx.js';
import { cpuTurn } from '../../ui/turns.js';

// ---------- Muncher ----------
// A square opens on the maze with the player's dots as they stand (the ones they have eaten are gone), the muncher
// where its last run ended (its start at first, or after a spook caught it) and the spooks in their pen, with Start
// below. Start begins one run: a swipe anywhere on the screen (an arrow key, or a tap on one side of the muncher) says
// which way to turn, taken at the next cell where it opens (pressed early, it waits; pressed just before the corner,
// it cuts it), and the muncher runs on until a wall. The run ends on a spook, when its time is up (the bar on the
// maze's top wall), when the target is reached or the maze is empty; its end shows a moment, then it goes in as its
// inputs (rules.js: the server plays them through again). Someone else's run (the computer's, the other phone's) plays
// here first, from its inputs, then the result. All on one canvas, drawn every frame: the maze as a slab of wall with
// the corridors cut into it (cached as a picture of their own, cut close to the maze: munGeom), the dots and the
// pulsing pellets, the muncher in the player's colour whose mouth chomps as it goes and faces its way, the four spooks
// each in their colour with eyes on where they go (see-through in the pen, bright blue and shivering while frightened,
// flashing before a fright ends, a pair of eyes going home once eaten), a mover going through a tunnel drawn at both
// ends, and the moments of a run from its steps' events, each once (munNote): a dot's spark, a pellet's ring over the
// maze, a spook's worth going up, the knock and the maze's kick at being caught, the stars at the target, TIME!.
const MUN_END = 700;                                               // the end of a run (a spook, the time, the target) shows this long before it goes in
const MUN_EARLY = 700;                                             // online: a run ends this long before the turn's time is up, so it goes in before the timeout
const SWIPE = 14;                                                  // px a finger moves to turn the muncher (then again from there: no need to lift)
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
const SPOOK = ['#ff8a7a', '#b9a7ff', '#8fe0c8', '#ffc07a'];       // the chaser, the ambusher, the patroller, the wanderer (coral, lavender, mint, peach)
const MAZE = { void: '#0e0c22', floor: '#14112e', wall: '#252a7a', wall2: '#30369a', under: '#171a52', edge: '#6677ff', edge2: '#8a97ff', dot: '#ffdca6', pel: '#fff0cf', door: '#ffb6d5', fright: '#2f6dff', flash: '#eef0ff', pupil: '#2b3bd0', ink: '#0b0920' };
const FLASH_STEPS = Math.round(MUN.hz * 1.5);                      // a fright flashes this many steps before its end
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
  munLive = null; hudWas = null;
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
    while (fd.acc >= STEP - 1e-9 && !sim.end) { fd.acc -= STEP; if (fd.want >= 0) munInput(sim, fd.want); munLoud(sim); munNote(sim, now); }
    if (sim.end) { fd.phase = 'end'; fd.end = sim.end; fd.endAt = now; fd.ptr = null; }
    munHud(fd);
  } else if (now - fd.endAt >= MUN_END) { munFinish(true); return; }
  const cv = app.querySelector('canvas[data-mun="cv"]');
  if (cv) munDraw(cv, munDraftView(fd, now), now);
  munRaf = requestAnimationFrame(munFrame);
}
// One step of this phone's own run, with its sounds (and the buzzes: a spook eaten, being caught), once each from the step's events.
function munLoud(sim) {
  munStep(sim);
  for (const ev of sim.evs) {
    if (ev === 'eat') SND.play('munChomp');
    else if (ev === 'pellet') { SND.play('munPellet'); haptic('tap'); }
    else if (ev === 'ghost') { SND.play('munGhost'); haptic('medium'); }
    else if (ev === 'caught') { SND.play('munDeath'); haptic('error'); }
  }
  if (sim.end === 'win' || sim.end === 'clear') SND.play('sparkle');
  else if (sim.end === 'time') { SND.play('buzz'); haptic('medium'); }   // (the attempt's time limit: a buzzer, its dots kept)
}
// The run goes in (send): as it ended, or as it stands (the time ran out, the page went away); or is dropped.
export function munFinish(send) {
  const fd = munDraft;
  if (!fd) return;
  cancelAnimationFrame(munRaf); munRaf = 0; munDraft = null;
  if (!send || state.screen !== 'mini' || state.zoom !== fd.sq) { render(); return; }
  const sim = fd.sim;
  if (sim.n === 0) { if (fd.want >= 0) munInput(sim, fd.want); munStep(sim); }   // (at least one step: a run of none is no run)
  munLive = { sq: fd.sq, p: fd.p, id: fd.id, to: munSimScore(sim), view: munDraftView(fd, performance.now()), at: performance.now() };
  attemptMove(munMove(sim));
  render();
}
function munHud(fd) {
  const sim = fd.sim, val = munSimScore(sim), goal = sim.target;
  munHudSet(val, goal);
  const row = app.querySelector(`.munprog.${fd.p}`);
  if (!row) return;
  const w = (100 * Math.min(1, val / goal)).toFixed(2) + '%', bi = row.querySelector('.rbar i');
  if (bi) { bi.classList.remove('grow'); bi.style.setProperty('--w0', w); bi.style.setProperty('--w1', w); }
  const sm = row.querySelector('small');
  if (sm) sm.textContent = munSay(val, goal);
}
const munSay = (v, goal) => `${fmtN(v)} / ${fmtN(goal)}`;
// The count over the maze as a run plays here (this phone's or a replay): it pops when a spook's worth lands on it
// (dot by dot it only counts: a pop for each would be a flutter), from the step that scored.
let hudWas = null;
function munHudSet(val, goal) {
  const hud = app.querySelector('[data-mun="hud"]'), txt = munSay(val, goal), jump = hudWas != null && val - hudWas >= 2;
  hudWas = val;
  if (!hud || hud.textContent === txt) return;
  hud.textContent = txt;
  if (jump && !REDUCED && typeof hud.animate === 'function') hud.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.4, 0, .2, 1)' });
}
// A way asked for on this phone (a swipe, a tap, a key): kept as before; a light buzz when it is a new one.
function munWant(fd, d) { if (d !== fd.want) haptic('tap'); fd.want = d; }
// A tap on one side of the muncher turns it that way (a desktop without arrows, a phone without a swipe).
function munTapDir(fd, x, y) {
  const cv = app.querySelector('canvas[data-mun="cv"]'), geo = fd.geo;
  if (!cv || !geo) return;
  const r = cv.getBoundingClientRect(), [px, py] = munPos(fd.sim.ch);
  const sx = r.left + geo.ox + (px / MUN.U + 0.5) * geo.k, sy = r.top + geo.oy + (py / MUN.U + 0.5) * geo.k, dx = x - sx, dy = y - sy;
  if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
  munWant(fd, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
}

// ---- what the maze shows: the run under way, a replay, the last moment, or the clean start ----
const munDraftView = (fd, now) => ({ type: 'muncher', p: fd.p, sim: fd.sim, end: fd.end, endAt: fd.endAt, want: fd.want, live: true });
const munStill = (mini, p) => ({ type: 'muncher', p, sim: munStart(mini, p), still: true });
// The square as it was before a run (its dots and spooks put back for the player who made it, the muncher where that
// run began): the replay starts there.
function munBefore(mini, g) {
  const p = g.by, ran = new Set(g.ate || []), m = JSON.parse(JSON.stringify(mini));
  if (!m.ate) m.ate = { X: [], O: [] };
  m.ate[p] = munAte(mini, p).filter(c => !ran.has(c));
  if (!m.gh) m.gh = { X: 0, O: 0 };
  m.gh[p] = Math.max(0, munGh(mini, p) - (Number(g.gh) || 0));
  if (!m.tries) m.tries = { X: 0, O: 0 };
  m.tries[p] = Number.isInteger(g.try) ? g.try : Math.max(0, (m.tries[p] || 1) - 1);
  if (!m.at) m.at = { X: null, O: null };
  m.at[p] = Number.isInteger(g.cell0) ? g.cell0 : null;
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
    hudWas = null;
  }
  munReps.set(f, rep);
  return rep;
}
// A replay's view at T seconds into the run (the sim stepped on to there; rewound when a phone comes back to its start).
function munRepView(rep, T, now) {
  const want = Math.min(rep.steps, Math.floor(T * MUN.hz + 1e-6));
  if (!rep.sim || rep.sim.n > want) { rep.sim = munStart(rep.mini0, rep.p); rep.k = 0; rep.endAt = null; }
  const sim = rep.sim;
  while (sim.n < want && !sim.end) {
    while (rep.k < rep.log.length && rep.log[rep.k][0] <= sim.n) { if (rep.log[rep.k][0] === sim.n) munInput(sim, rep.log[rep.k][1]); rep.k++; }
    munStep(sim); munNote(sim, now);
  }
  if (sim.end && rep.endAt == null) rep.endAt = now;
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
      const e = Math.max(0, now - start), T = (Math.min(e, rep.ms) * rep.speed) / 1000, v = munRepView(rep, T, now);
      munDraw(cv, v, now);
      munHudSet(munSimScore(v.sim), v.sim.target);
      return e < rep.ms + 1200;
    }
  }
  const lv = munLive && state.screen === 'mini' && munLive.sq === state.zoom && munLive.view ? munLive : null;   // this phone's run just made: its last moment, while it goes in and its result shows
  if (lv && (f ? f.by === lv.p : munId(state.zoom, lv.p) === lv.id && now - lv.at < 15000)) { munDraw(cv, lv.view, now); return now - lv.at < 1500; }
  if (lastStill) munDraw(cv, lastStill, now);
  return false;
}

// ---- the drawing ----
// Where the maze lies on the canvas (pure). A version 2 maze has a ring of wall all round it: the picture is cut close
// on the left, the right and the bottom (MUNV.crop of a cell hidden there, a sliver of the wall left) and keeps the top
// wall's row whole, which holds the count and the attempt's time bar, so neither lies over the maze's corner pellets;
// the cells are as big as the box allows. { k: a cell's size, ox, oy: the top left of cell (0, 0), band: the top row's
// height (0 on a first maze, which has no ring) }. The stylesheet places the count by the same figures (.munhud).
export const MUNV = { crop: 0.78, dot: 220, pellet: 520, ghost: 850, hit: 340, win: 900, pop: 200 };   // crop: cells of the outer wall left out of the picture; the rest: how long each moment's effect shows (ms)
export function munGeom(L, W, H) {
  const cr = L.v === 2 ? MUNV.crop : 0, wv = L.w - 2 * cr, hv = L.h - cr, k = Math.min(W / wv, H / hv);
  return { k, ox: (W - L.w * k) / 2, oy: (H - hv * k) / 2, band: cr ? k : 0 };
}
// The view's own notes on a run (never read by the rules): the moments its steps gave, for the picture's effects.
const NOTES = new WeakMap();
const notesOf = sim => { let nt = NOTES.get(sim); if (!nt) { nt = { fx: [] }; NOTES.set(sim, nt); } return nt; };
function munNote(sim, now) {                                         // after a step shown here: its events, each once
  if (!sim.evs.length) return;
  const nt = notesOf(sim), [x, y] = munPos(sim.ch), cell = sim.ate[sim.ate.length - 1];
  for (const ev of sim.evs) {
    if (ev === 'eat') nt.fx.push({ kind: 'dot', cell, at: now });
    else if (ev === 'pellet') nt.fx.push({ kind: 'pellet', cell, at: now });
    else if (ev === 'ghost') nt.fx.push({ kind: 'ghost', x, y, at: now, n: sim.ghostDots });
    else if (ev === 'caught') nt.fx.push({ kind: 'caught', x, y, at: now });
  }
  if (nt.fx.length > 48) nt.fx.splice(0, nt.fx.length - 48);
}
// The maze, drawn once per layout and size: a slab of wall in deep indigo with the corridors (and the pen) cut into
// it as wide rounded ways with a bright edge, so the walls read as solid blocks between them; a thin bright line round
// the slab, open where a tunnel leaves; the pen's door as a bar.
const mazeCache = { key: '', cv: null };
function mazeLayer(L, k, w, h, dpr) {
  const key = `${L.v}:${L.k}:${w.toFixed(1)}:${h.toFixed(1)}:${dpr}`;
  if (mazeCache.key === key && mazeCache.cv) return mazeCache.cv;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = k * 0.72, e = Math.max(1.6, k * 0.09), at = (x, y) => [(x + 0.5) * k, (y + 0.5) * k];
  const g = c.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, MAZE.wall2); g.addColorStop(1, MAZE.wall);   // the slab, lit from the top left
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const path = () => {
    c.beginPath();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const cell = y * L.w + x;
      if (!L.gopen[cell]) continue;
      const [cx, cy] = at(x, y);
      c.moveTo(cx, cy); c.lineTo(cx + 0.01, cy);                     // (a lone cell is still a round spot)
      if (L.gopen[cellAt(L, x + 1, y)] && x + 1 < L.w) { c.moveTo(cx, cy); c.lineTo(cx + k, cy); }
      if (y + 1 < L.h && L.gopen[cellAt(L, x, y + 1)]) { c.moveTo(cx, cy); c.lineTo(cx, cy + k); }
      if (L.wrap[y] && x === 0) { c.moveTo(cx, cy); c.lineTo(cx - k, cy); }
      if (L.wrap[y] && x === L.w - 1) { c.moveTo(cx, cy); c.lineTo(cx + k, cy); }
    }
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(e * 0.5, e * 0.7); path(); c.lineWidth = cw + 2 * e; c.strokeStyle = MAZE.under; c.stroke(); c.restore();   // the far edge's shade: the ways are sunk into the slab
  path(); c.lineWidth = cw + 2 * e; c.strokeStyle = MAZE.edge; c.stroke();
  path(); c.lineWidth = cw; c.strokeStyle = MAZE.floor; c.stroke();
  c.lineWidth = e; c.strokeStyle = MAZE.edge2;                       // the slab's rim: a thin bright line, open where a tunnel leaves
  c.strokeRect(e / 2 + 1, e / 2 + 1, w - e - 2, h - e - 2);
  c.fillStyle = MAZE.floor;
  for (let y = 0; y < L.h; y++) if (L.wrap[y]) { c.fillRect(0, y * k + (k - cw) / 2, e + 3, cw); c.fillRect(w - e - 3, y * k + (k - cw) / 2, e + 3, cw); }
  if (L.pen) {                                                        // the door: a bar across the way out
    const dx = L.pen.door % L.w, dy = (L.pen.door - dx) / L.w, ex = L.pen.exit % L.w, ey = (L.pen.exit - ex) / L.w;
    const [cx, cy] = at(dx, dy), ox = (ex - dx) * k / 2, oy = (ey - dy) * k / 2;
    c.strokeStyle = MAZE.door; c.lineWidth = Math.max(2, k * 0.13); c.lineCap = 'butt';
    c.beginPath();
    if (ox) { c.moveTo(cx + ox, cy - cw / 2); c.lineTo(cx + ox, cy + cw / 2); } else { c.moveTo(cx - cw / 2, cy + oy); c.lineTo(cx + cw / 2, cy + oy); }
    c.stroke();
  }
  mazeCache.key = key; mazeCache.cv = cv;
  return cv;
}
const smooth = new WeakMap();                                         // the muncher's drawn spot eases to its true one (a corner cut is a small jump in the rules)
function munDraw(cv, v, now) {
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  const P = runColours(), sim = v.sim, L = sim.L, { k, ox, oy, band } = munGeom(L, W, H), mw = L.w * k, mh = L.h * k;
  if (munDraft && v.sim === munDraft.sim) munDraft.geo = { ox, oy, k };
  const fxs = notesOf(sim).fx, col = v.p === 'O' ? P.O : P.X, cellXY = cell => { const x = cell % L.w; return [ox + (x + 0.5) * k, oy + ((cell - x) / L.w + 0.5) * k]; };
  const caughtAt = v.end === 'caught' && v.endAt ? v.endAt : null;
  c.fillStyle = MAZE.void; c.fillRect(0, 0, W, H);
  c.save();
  if (caughtAt) jolt(c, W, H, { crash: true }, { at: caughtAt }, now);   // caught: the maze kicks (the count and the time bar over it stay still)
  c.save(); c.beginPath(); c.roundRect(ox, oy, mw, mh, k * 0.45); c.clip();
  c.drawImage(mazeLayer(L, k, mw, mh, Math.min(2, window.devicePixelRatio || 1)), ox, oy, mw, mh);
  const pulse = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(now / 160), dr = Math.max(2, k * 0.105), pr = k * (0.25 + 0.05 * pulse);
  for (let cell = 0; cell < sim.dots.length; cell++) {               // the dots left for this player; the pellets bigger, pulsing in a soft halo
    if (!sim.dots[cell]) continue;
    const [x, y] = cellXY(cell);
    if (sim.pel[cell]) { c.fillStyle = `rgba(255, 220, 166, ${0.16 + 0.12 * pulse})`; c.beginPath(); c.arc(x, y, pr * 1.75, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = sim.pel[cell] ? MAZE.pel : MAZE.dot; c.beginPath(); c.arc(x, y, sim.pel[cell] ? pr : dr, 0, Math.PI * 2); c.fill();
  }
  if (!REDUCED) for (const x of fxs) {                                // under the movers: a dot's last spark, a pellet's ring going out over the maze
    const age = now - x.at;
    if (x.kind === 'dot' && age < MUNV.dot) { const t = age / MUNV.dot, [X, Y] = cellXY(x.cell); c.strokeStyle = `rgba(255, 220, 166, ${0.8 * (1 - t)})`; c.lineWidth = Math.max(1.2, k * 0.07); c.beginPath(); c.arc(X, Y, dr + k * 0.34 * easeOut(t), 0, Math.PI * 2); c.stroke(); }
    else if (x.kind === 'pellet' && age < MUNV.pellet) {
      const t = age / MUNV.pellet, [X, Y] = cellXY(x.cell), e = easeOut(t);
      if (t < 0.25) { c.fillStyle = `rgba(238, 240, 255, ${0.16 * (1 - t / 0.25)})`; c.fillRect(ox, oy, mw, mh); }
      c.lineWidth = Math.max(2, k * 0.16) * (1 - t * 0.6);
      for (const [q, a] of [[1, 0.75], [0.62, 0.45]]) { c.strokeStyle = `rgba(238, 240, 255, ${a * (1 - t)})`; c.beginPath(); c.arc(X, Y, k * (0.4 + 3.4 * e * q), 0, Math.PI * 2); c.stroke(); }
    }
  }
  const at = m => { const [px, py] = munPos(m); return [ox + (px / MUN.U + 0.5) * k, oy + (py / MUN.U + 0.5) * k]; };
  const twice = (x, draw) => { draw(x); if (x < ox + k) draw(x + mw); else if (x > ox + mw - k) draw(x - mw); };   // (through a tunnel: at both ends)
  const [tx, ty] = at(sim.ch);
  let sp = smooth.get(sim);
  if (!sp || sim.n === 0 || Math.abs(sp.x - tx) > k * 2 || Math.abs(sp.y - ty) > k * 2) sp = { x: tx, y: ty };
  else { sp.x += (tx - sp.x) * 0.55; sp.y += (ty - sp.y) * 0.55; }
  smooth.set(sim, sp);
  let gulp = 0;                                                      // a pellet or a spook just eaten: the muncher swells for a moment
  if (!REDUCED) for (const x of fxs) if (x.kind === 'ghost' || x.kind === 'pellet') gulp = Math.max(gulp, clamp01(1 - (now - x.at) / MUNV.pop));
  for (const g of sim.gh) { const [x, y] = at(g); twice(x, xx => munSpook(c, xx, y, k * 0.45, g, sim, now)); }
  twice(sp.x, xx => munMuncher(c, xx, sp.y, k * 0.47 * (1 + 0.22 * gulp), col, sim, v, now, P));
  c.restore();
  // over the movers: a spook eaten (its worth going up in the player's colour, shards flying), the knock of being caught, the stars at the target
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  for (const x of fxs) {
    const age = now - x.at, X = ox + (x.x / MUN.U + 0.5) * k, Y = oy + (x.y / MUN.U + 0.5) * k;
    if (x.kind === 'ghost' && age < MUNV.ghost) {
      const t = age / MUNV.ghost, e = easeOut(t), px = Math.max(14, k * 0.8), txt = `+${x.n}`;
      c.save();
      if (!REDUCED) for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3, r = k * (0.4 + 1.1 * easeOut(t * 1.6)); c.globalAlpha = clamp01(1.3 - t * 2.2); c.fillStyle = i % 2 ? MAZE.flash : MAZE.fright; c.beginPath(); c.arc(X + Math.cos(a) * r, Y + Math.sin(a) * r, k * 0.09 * (1 - t * 0.5), 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = clamp01(2.6 - t * 2.6); c.font = FONT(px);
      const tw = c.measureText(txt).width / 2 + 4, TX = Math.max(tw, Math.min(W - tw, X)), TY = Math.max(band + px * 0.6, Y - k * (0.75 + 0.7 * e));
      c.translate(TX, TY); if (!REDUCED) c.scale(0.6 + 0.4 * backOut(t * 4), 0.6 + 0.4 * backOut(t * 4));
      c.lineWidth = Math.max(3, px * 0.22); c.strokeStyle = P.ink; c.strokeText(txt, 0, 0); c.fillStyle = col; c.fillText(txt, 0, 0);
      c.restore();
    } else if (x.kind === 'caught' && age < MUNV.hit) impact(c, X, Y, k * 1.15, { at: x.at }, now, P, col);
  }
  if ((v.end === 'win' || v.end === 'clear') && v.endAt && now - v.endAt < MUNV.win) {
    const t = (now - v.endAt) / MUNV.win, e = easeOut(t);
    c.save(); c.globalAlpha = clamp01(1.6 - t * 1.6); c.lineWidth = Math.max(1.5, k * 0.07); c.strokeStyle = P.ink;
    for (let i = 0; i < 10; i++) { const a = i * 0.63 + 0.4, r = k * (0.7 + (1.6 + (i % 3) * 0.6) * e); starPath(c, sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r - k * 0.4 * e, k * (0.24 + 0.1 * (i % 2)), 5, a + t * 3); c.fillStyle = i % 2 ? '#f2b01e' : col; c.fill(); c.stroke(); }
    c.restore();
  }
  c.restore();
  if (!v.still) {                                                    // the attempt's time limit: its bar (ui/runner.js drawTimeBar) on the maze's top wall beside the count, while the run plays or replays
    const x0 = Math.round(W * 0.36), bw = W - x0, bh = Math.max(5, Math.round(Math.min(bw, H) * 0.016)), bm = Math.max(4, bh);
    c.save(); c.translate(x0, band ? Math.max(0, oy + (band - bh) / 2 - bm) : 0); drawTimeBar(c, bw, H, 1 - sim.n / sim.cap, P); c.restore();
  }
  if (v.end === 'time' && v.endAt) banner(c, W, H, 'TIME!', { at: v.endAt }, now, P, 0.4);   // the attempt's limit: the runners' word
}
// The muncher: a round fellow in the player's colour, ink-outlined, whose mouth opens and shuts as it goes (shut when
// it stands), facing its way, a bright eye above the mouth; it swells for a moment on a pellet or a spook; caught: it
// pales, spins and shrinks away.
function munMuncher(c, x, y, R, col, sim, v, now, P) {
  const caught = v.end === 'caught', u = caught && v.endAt ? Math.min(1, (now - v.endAt) / 600) : 0;
  const ch = sim.ch, moving = ch.d >= 0 && !sim.end, face = ch.face >= 0 ? ch.face : 1;
  const bite = moving ? 0.08 + 0.62 * Math.abs(Math.sin((ch.f / MUN.U) * Math.PI * 2)) : sim.end === 'caught' ? 0.7 + 0.3 * u : 0.12;
  const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][face], half = bite * 0.75, lw = Math.max(2, R * 0.2);
  c.save(); c.translate(x, y);
  if (caught) { if (!REDUCED) c.rotate(u * u * 5); c.scale(1 - u * 0.95, 1 - u * 0.95); }
  c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, ang + half, ang - half + Math.PI * 2); c.closePath();
  c.fillStyle = caught ? '#e9d4d0' : col; c.fill(); c.lineWidth = lw; c.strokeStyle = P.ink; c.stroke();
  const [fx, fy] = DIRS[face], side = face === 1 || face === 3, eyeX = side ? fx * R * 0.12 : -R * 0.4, eyeY = side ? -R * 0.46 : -fy * R * 0.12;   // the eye: above the mouth
  c.fillStyle = 'rgba(255, 255, 255, .32)'; c.beginPath(); c.ellipse(side ? -fx * R * 0.45 : R * 0.42, side ? -R * 0.5 : fy * R * 0.45, R * 0.2, R * 0.11, -0.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(eyeX, eyeY, R * 0.24, 0, Math.PI * 2); c.fill(); c.lineWidth = Math.max(1, R * 0.09); c.stroke();
  c.fillStyle = P.ink; c.beginPath(); c.arc(eyeX + fx * R * 0.08, eyeY + fy * R * 0.08, R * 0.12, 0, Math.PI * 2); c.fill();
  c.restore();
}
// A spook: a dome on a wavy skirt in its colour with a dark outline and a glint, two eyes looking where it goes;
// see-through while it waits in the pen; frightened: bright blue with a pale outline, small eyes and a wavy mouth,
// shivering (flashing pale as the fright ends); a pair of eyes going home once eaten.
function munSpook(c, x, y, R, g, sim, now) {
  const fright = g.fr && sim.fr > 0, flash = fright && sim.fr <= FLASH_STEPS && Math.floor(sim.fr / Math.round(MUN.hz * 0.15)) % 2 === 1;
  const look = g.d >= 0 ? g.d : 2, [fx, fy] = DIRS[look], eyes = g.mode === 'eyes', bob = g.mode === 'pen' && !REDUCED ? Math.sin(now / 180 + g.i * 2) * R * 0.1 : 0;
  const skirt = REDUCED ? 0 : Math.sin(now / 110 + g.i * 1.7) * R * 0.06, shiver = fright && !REDUCED ? Math.sin(now / 38 + g.i * 2.1) * R * 0.07 : 0;
  c.save(); c.translate(x + shiver, y + bob);
  if (g.mode === 'pen') c.globalAlpha = 0.5;
  if (!eyes) {
    c.beginPath(); c.moveTo(-R, R * 0.95);
    c.lineTo(-R, -R * 0.1); c.arc(0, -R * 0.1, R, Math.PI, 0); c.lineTo(R, R * 0.95 + skirt);
    for (let t = 0; t < 3; t++) c.arc(R - (2 * t + 1) * R / 3, R * 0.95 + (t === 1 ? -skirt : skirt), R / 3, 0, Math.PI);   // the skirt's three scallops, swaying
    c.closePath();
    c.fillStyle = flash ? MAZE.flash : fright ? MAZE.fright : SPOOK[g.i % SPOOK.length]; c.fill();
    c.lineJoin = 'round'; c.lineWidth = Math.max(1.6, R * 0.17); c.strokeStyle = flash ? MAZE.fright : fright ? MAZE.flash : MAZE.ink; c.stroke();
    if (!fright) { c.fillStyle = 'rgba(255, 255, 255, .34)'; c.beginPath(); c.ellipse(-R * 0.45, -R * 0.62, R * 0.24, R * 0.13, -0.7, 0, Math.PI * 2); c.fill(); }
    if (fright) {                                                    // a frightened face: small eyes and a wavy mouth
      c.fillStyle = flash ? MAZE.fright : MAZE.flash;
      c.beginPath(); c.arc(-R * 0.33, -R * 0.2, R * 0.13, 0, Math.PI * 2); c.arc(R * 0.33, -R * 0.2, R * 0.13, 0, Math.PI * 2); c.fill();
      c.strokeStyle = flash ? MAZE.fright : MAZE.flash; c.lineWidth = Math.max(1.4, R * 0.12); c.beginPath();
      for (let i = 0; i <= 6; i++) c.lineTo(-R * 0.6 + i * R * 0.2, R * 0.35 + (i % 2 ? -R * 0.12 : R * 0.12));
      c.stroke(); c.restore(); return;
    }
  }
  for (const s of [-1, 1]) {                                           // the eyes, on where it goes
    const cx = s * R * 0.38 + fx * R * 0.08, cy = -R * 0.2 + fy * R * 0.1;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy, R * 0.26, R * 0.32, 0, 0, Math.PI * 2); c.fill();
    if (eyes) { c.lineWidth = Math.max(1, R * 0.09); c.strokeStyle = MAZE.fright; c.stroke(); }
    c.fillStyle = MAZE.pupil; c.beginPath(); c.arc(cx + fx * R * 0.12, cy + fy * R * 0.14, R * 0.14, 0, Math.PI * 2); c.fill();
  }
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
    const at = own ? munSimScore(live.sim) : fresh ? g.to : here && here.to > munScore(mini, p) ? here.to : munScore(mini, p);
    const grow = fresh && pre > 0, w1 = 100 * Math.min(1, at / goal), w0 = grow ? 100 * Math.min(1, g.from / goal) : w1;
    const say = grow ? `<span class="sbn"><span class="tu" style="--u:${pre}ms">${munSay(g.from, goal)}</span><span class="tf" style="--f:${pre}ms">${munSay(at, goal)}</span></span>` : munSay(at, goal);
    return `<div class="rprog munprog ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><div class="rbar" role="progressbar" aria-valuenow="${Math.floor(at)}" aria-valuemax="${goal}"><i class="${grow ? 'grow' : ''}" style="--w0:${w0.toFixed(1)}%;--w1:${w1.toFixed(1)}%;--d:900ms${grow ? `;--t:${pre}ms` : ''}"></i></div><small>${say}</small></div>`;
  };
  const shown = g || ((o.done || o.view) && l && !l.auto ? l : null), who = g ? a.by : shown ? shown.by : turn;
  const said = shown ? munResultText(shown, goal, W(who)) : { text: '', ok: false };
  const words = g ? (pre ? `<span class="tu" style="--u:${pre}ms">${W(who)} is on a run…</span><span ${lateAt('arcres ' + (said.ok ? 'ok' : 'no'), pre)} role="status">${said.text}</span>` : `<span class="arcres ${said.ok ? 'ok' : 'no'}" role="status">${said.text}</span>`)
    : live ? '<span></span>'
    : o.view ? (shown ? `<span>${said.text}</span>` : '')
    : mine ? '<span></span>'   // (how to play is in the ? explainer; its run on its way to the server: played here already, nothing to wait for)
    : `<span>${state.lock === o.zoom && !state.online ? `${W(turn)} is on a run…` : waitLine(turn)}</span>`;
  const hudV = live ? munSimScore(live.sim) : munScore(mini, g ? a.by : o.view && l ? l.by : turn);
  const hud = `<div class="rhud munhud" data-mun="hud">${munSay(hudV, goal)}</div>`;
  const scene = `<div class="munscene" data-mun="scene" data-v="${munVer(mini)}" aria-label="The maze, with the muncher and the spooks in their pen"><canvas data-mun="cv"></canvas>${hud}</div>`;
  const go = mine && !live && !o.locked;
  const btn = o.view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big ${turn}" data-act="mun-start"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Start</button></div>`;   // always there (hidden while it can't be used), so the maze never moves
  const stillP = o.view && l ? l.by : g ? a.by : turn;
  lastStill = munLive && munLive.sq === o.zoom && !g ? lastStill : munStill(mini, stillP);
  return `<div class="g-arc"><div class="mun">${`<div class="rprogs">${row('X')}${row('O')}</div>`}${scene}<p class="atwords munwords">${words}</p></div>${btn}</div>`;
}
// What a run came to, in words (text) and whether it gained anything (ok).
const dotsW = n => `${n} dot${n === 1 ? '' : 's'}`, spooksW = n => `${n} spook${n === 1 ? '' : 's'}`;
function munResultText(s, goal, who) {
  if (s.auto) return { text: `${who} ran out of time`, ok: false };
  const gain = s.to - s.from, gh = Number(s.gh) || 0;
  if (s.to >= goal) return { text: `${who} made ${goal}!`, ok: true };
  if (gain > 0) return { text: `${who} ate ${dotsW(s.ate ? s.ate.length : gain)}${gh ? ` and ${spooksW(gh)}` : ''}${s.end === 'caught' ? ', then a spook' : s.end === 'out' ? ' (out of time)' : ''} · ${s.to} of ${goal}`, ok: true };
  return { text: `${who} ${s.end === 'caught' ? 'was caught' : 'ate nothing'} · ${s.to} of ${goal}`, ok: false };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  wire();
  g = munTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
export function moveText(f, who) {
  const g = f.mun; if (!g || g.auto) return `${who} ran out of time`; const n = g.to - g.from, gh = Number(g.gh) || 0;
  return n > 0 ? `${who} ate ${dotsW(g.ate ? g.ate.length : n)}${gh ? ` and ${spooksW(gh)}` : ''} · ${g.to} of ${g.target}` : `${who} ${g.end === 'caught' ? 'was caught' : 'ate nothing'} · ${g.to} of ${g.target}`;
}
const EV_SOUND = { eat: 'munChomp', pellet: 'munPellet', ghost: 'munGhost', caught: 'munDeath' };
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
      for (const ev of sim.evs) { if (ev === 'eat' && n++ >= 150) continue; add(EV_SOUND[ev], at(sim.n / MUN.hz)); }
    }
    if (sim.end === 'win' || sim.end === 'clear') add('sparkle', at(sim.n / MUN.hz));
    else if (sim.end === 'time') add('buzz', at(sim.n / MUN.hz));
  }
  add(g.auto ? 'thud' : g.to > g.from ? 'ding' : 'thud', pre + 250);
}
// The miniature: the maze as the square shows it (the slab of wall with its corridors cut in, cut close like the scene,
// a dot on every other cell, the muncher where it stands with its mouth open, a spook at the pen: both drawn bigger
// than a cell, to be seen) and each player's dots eaten as a bar with its count.
export function miniature(mini, final) {
  const L = layoutOf(mini), goal = munTarget(mini), s = 10, cw = s * 0.72, cr = L.v === 2 ? MUNV.crop * s : 0, f = v => +v.toFixed(1);
  let cor = '', dots = '';
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const c = y * L.w + x;
    if (!L.gopen[c]) continue;
    const cx = x * s + s / 2, cy = y * s + s / 2;
    cor += `M${cx} ${cy}h0.01`;
    if (x + 1 < L.w && L.gopen[c + 1]) cor += `M${cx} ${cy}h${s}`;
    if (y + 1 < L.h && L.gopen[c + L.w]) cor += `M${cx} ${cy}v${s}`;
    if (L.wrap[y] && (x === 0 || x === L.w - 1)) cor += `M${cx} ${cy}h${x ? s : -s}`;
    if (L.open[c] && L.dots.includes(c) && (x + y) % 2 === 0) dots += `M${cx} ${cy}h0.01`;
  }
  const bar = p => { const n = munScore(mini, p); return `<div class="mr ${p}"><b class="${p}">${p}</b><i><s style="--w:${(100 * Math.min(1, n / goal)).toFixed(1)}%"></s></i><span>${n}</span></div>`; };
  const g0 = L.pen ? L.pen.centre : L.ghosts[0][1] * L.w + L.ghosts[0][0], gx = (g0 % L.w) * s + s / 2, gy = ((g0 - g0 % L.w) / L.w) * s + s / 2, m0 = munCell(mini, 'X'), mx = (m0 % L.w) * s + s / 2, my = ((m0 - m0 % L.w) / L.w) * s + s / 2, R = s * 0.82, q = f(R / 3);
  const spook = `<path class="sp" d="M${f(gx - R)} ${f(gy + R * 0.9)}V${f(gy - R * 0.1)}a${f(R)} ${f(R)} 0 0 1 ${f(2 * R)} 0V${f(gy + R * 0.9)}l${-q} ${-q}l${-q} ${q}l${-q} ${-q}l${-q} ${q}l${-q} ${-q}z"/><circle class="spe" cx="${f(gx - R * 0.36)}" cy="${f(gy - R * 0.2)}" r="${f(R * 0.26)}"/><circle class="spe" cx="${f(gx + R * 0.36)}" cy="${f(gy - R * 0.2)}" r="${f(R * 0.26)}"/>`;
  const muncher = `<path class="mu" d="M${f(mx)} ${f(my)}L${f(mx - R * 0.83)} ${f(my - R * 0.56)}A${f(R)} ${f(R)} 0 1 1 ${f(mx - R * 0.83)} ${f(my + R * 0.56)}Z"/><circle class="mue" cx="${f(mx - R * 0.1)}" cy="${f(my - R * 0.5)}" r="${f(R * 0.15)}"/>`;
  return `<div class="tmun" aria-label="Muncher: X has eaten ${munScore(mini, 'X')}, O ${munScore(mini, 'O')} of ${goal}"><div class="mpic" aria-hidden="true"><svg viewBox="${f(cr)} 0 ${f(L.w * s - 2 * cr)} ${f(L.h * s - cr)}"><rect class="bg" x="0" y="0" width="${L.w * s}" height="${L.h * s}"/><path class="w" d="${cor}" style="stroke-width:${(cw + 2.6).toFixed(1)}"/><path class="fl" d="${cor}" style="stroke-width:${cw.toFixed(1)}"/><path class="dots" d="${dots}"/>${spook}${muncher}</svg></div><div class="mrows">${bar('X')}${bar('O')}</div></div>`;
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
    munWant(fd, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));   // the swipe's way; then again from here, without lifting
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
    e.preventDefault(); munWant(fd, KEYS[e.key]);
  });
  // The page hidden mid-run (another app, the lock button): the run ends there, its dots kept.
  document.addEventListener('visibilitychange', () => { if (document.hidden && munDraft && munDraft.phase === 'play') munFinish(true); });
}
