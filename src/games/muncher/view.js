// Muncher: the screen, the miniature, the move's words and sounds, and the inputs.
import { DIRS, MUN, MUN_VIEW, cellAt, layoutOf, munAte, munCell, munGh, munInput, munMove, munMs, munPos, munRawMs, munScore, munSimScore, munStart, munStep, munTarget, munUnlog } from './rules.js';
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
import { cpuTurn } from '../../ui/turns.js';

// ---------- Muncher ----------
// A square opens on the maze with the player's dots as they stand (the ones they have eaten are gone), the muncher
// where its last run ended (its start at first, or after a spook caught it) and the spooks in their pen, with Start
// below. Start begins one run: a swipe anywhere on the screen (an arrow key, or a tap on one side of the muncher) says
// which way to turn, taken at the next cell where it opens (pressed early, it waits; pressed just before the corner,
// it cuts it), and the muncher runs on until a wall. The run ends on a spook, when its time is up (the bar along the
// bottom), when the target is reached or the maze is empty; its end shows a moment, then it goes in as its inputs
// (rules.js: the server plays them through again). Someone else's run (the computer's, the other phone's) plays here
// first, from its inputs, then the result. All on one canvas, drawn every frame: the maze's walls as outlined blocks
// between the corridors (cached as a picture of their own), the dots and the pulsing pellets, the muncher as a disc in
// the player's colour whose mouth chomps as it goes and faces its way, the four spooks each in their colour with eyes
// on where they go (see-through in the pen, deep blue and flashing before a fright ends, a pair of eyes going home
// once eaten), and a mover going through a tunnel drawn at both ends.
const MUN_END = 700;                                               // the end of a run (a spook, the time, the target) shows this long before it goes in
const MUN_EARLY = 700;                                             // online: a run ends this long before the turn's time is up, so it goes in before the timeout
const SWIPE = 14;                                                  // px a finger moves to turn the muncher (then again from there: no need to lift)
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
const SPOOK = ['#ff8a7a', '#b9a7ff', '#8fe0c8', '#ffc07a'];       // the chaser, the ambusher, the patroller, the wanderer (coral, lavender, mint, peach)
const MAZE = { floor: '#14112e', edge: '#4f62f0', edge2: '#8a97ff', dot: '#ffdca6', door: '#ffb6d5', fright: '#3d4de0', flash: '#eef0ff' };
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
      if (hud) hud.textContent = munSay(munSimScore(v.sim), v.sim.target);
      return e < rep.ms + 1200;
    }
  }
  const lv = munLive && state.screen === 'mini' && munLive.sq === state.zoom && munLive.view ? munLive : null;   // this phone's run just made: its last moment, while it goes in and its result shows
  if (lv && (f ? f.by === lv.p : munId(state.zoom, lv.p) === lv.id && now - lv.at < 15000)) { munDraw(cv, lv.view, now); return now - lv.at < 1500; }
  if (lastStill) munDraw(cv, lastStill, now);
  return false;
}

// ---- the drawing ----
// The maze's walls, drawn once per layout and size: the corridors (and the pen) as wide rounded strokes over the floor,
// each with a thin bright edge, so the walls read as outlined blocks between them; the border likewise, open at the
// tunnels; the pen's door as a bar.
const mazeCache = { key: '', cv: null };
function mazeLayer(L, k, w, h, dpr) {
  const key = `${L.v}:${L.k}:${w}:${h}:${dpr}`;
  if (mazeCache.key === key && mazeCache.cv) return mazeCache.cv;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = k * 0.7, e = Math.max(1.6, k * 0.09), at = (x, y) => [(x + 0.5) * k, (y + 0.5) * k];
  c.fillStyle = MAZE.floor; c.fillRect(0, 0, w, h);
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
  path(); c.lineWidth = cw + 2 * e; c.strokeStyle = MAZE.edge; c.stroke();
  path(); c.lineWidth = cw; c.strokeStyle = MAZE.floor; c.stroke();
  c.lineWidth = e; c.strokeStyle = MAZE.edge2;                       // the border: a thin bright line, open where a tunnel leaves
  c.strokeRect(e / 2 + 1, e / 2 + 1, w - e - 2, h - e - 2);
  c.fillStyle = MAZE.floor;
  for (let y = 0; y < L.h; y++) if (L.wrap[y]) { c.fillRect(0, y * k + (k - cw) / 2 - e, e + 3, cw + 2 * e); c.fillRect(w - e - 3, y * k + (k - cw) / 2 - e, e + 3, cw + 2 * e); }
  if (L.pen) {                                                        // the door: a bar across the way out
    const dx = L.pen.door % L.w, dy = (L.pen.door - dx) / L.w, ex = L.pen.exit % L.w, ey = (L.pen.exit - ex) / L.w;
    const [cx, cy] = at(dx, dy), ox = (ex - dx) * k / 2, oy = (ey - dy) * k / 2;
    c.strokeStyle = MAZE.door; c.lineWidth = Math.max(2, k * 0.12); c.lineCap = 'butt';
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
  const P = runColours(), sim = v.sim, L = sim.L, k = Math.min(W / L.w, H / L.h), mw = L.w * k, mh = L.h * k, ox = (W - mw) / 2, oy = (H - mh) / 2;
  if (munDraft && v.sim === munDraft.sim) munDraft.geo = { ox, oy, k };
  c.fillStyle = MAZE.floor; c.fillRect(0, 0, W, H);
  c.drawImage(mazeLayer(L, k, mw, mh, Math.min(2, window.devicePixelRatio || 1)), ox, oy, mw, mh);
  const dr = Math.max(2, k * 0.1), pr = k * (0.26 + 0.04 * Math.sin(now / 160));
  c.fillStyle = MAZE.dot;
  for (let cell = 0; cell < sim.dots.length; cell++) {               // the dots left for this player, the pellets bigger and pulsing
    if (!sim.dots[cell]) continue;
    const x = cell % L.w, y = (cell - x) / L.w;
    c.beginPath(); c.arc(ox + (x + 0.5) * k, oy + (y + 0.5) * k, sim.pel[cell] ? pr : dr, 0, Math.PI * 2); c.fill();
  }
  c.save(); c.beginPath(); c.rect(ox, oy, mw, mh); c.clip();
  const at = m => { const [px, py] = munPos(m); return [ox + (px / MUN.U + 0.5) * k, oy + (py / MUN.U + 0.5) * k]; };
  const twice = (x, draw) => { draw(x); if (x < ox + k) draw(x + mw); else if (x > ox + mw - k) draw(x - mw); };   // (through a tunnel: at both ends)
  const [tx, ty] = at(sim.ch);
  let sp = smooth.get(sim);
  if (!sp || sim.n === 0 || Math.abs(sp.x - tx) > k * 2 || Math.abs(sp.y - ty) > k * 2) sp = { x: tx, y: ty };
  else { sp.x += (tx - sp.x) * 0.55; sp.y += (ty - sp.y) * 0.55; }
  smooth.set(sim, sp);
  for (const g of sim.gh) { const [x, y] = at(g); twice(x, xx => munSpook(c, xx, y, k * 0.42, g, sim, now)); }
  twice(sp.x, xx => munMuncher(c, xx, sp.y, k * 0.44, v.p === 'O' ? P.O : P.X, sim, v, now, P));
  c.restore();
  if (!v.still) { const x0 = Math.round(W * 0.36); c.save(); c.translate(x0, 0); drawTimeBar(c, W - x0, H, 1 - sim.n / sim.cap, P); c.restore(); }   // the attempt's time limit: a bar along the top, clear of the score at the top left (ui/runner.js drawTimeBar), while the run plays or replays
  if ((v.end === 'win' || v.end === 'clear') && v.endAt) {           // the target: rays out of the muncher
    const u = Math.min(1, (now - v.endAt) / 600); c.strokeStyle = MAZE.dot; c.lineWidth = 3;
    for (let r = 0; r < 10; r++) { const a = r * Math.PI / 5 + u; c.beginPath(); c.moveTo(sp.x + Math.cos(a) * k * (0.55 + 0.6 * u), sp.y + Math.sin(a) * k * (0.55 + 0.6 * u)); c.lineTo(sp.x + Math.cos(a) * k * (0.8 + 0.9 * u), sp.y + Math.sin(a) * k * (0.8 + 0.9 * u)); c.stroke(); }
  }
}
// The muncher: a disc in the player's colour with a wedge of a mouth that opens and shuts as it moves (shut when it
// stands), facing the way it goes, one eye above; caught: it opens wide and shrinks away.
function munMuncher(c, x, y, R, col, sim, v, now, P) {
  const caught = v.end === 'caught', u = caught && v.endAt ? Math.min(1, (now - v.endAt) / 600) : 0;
  const ch = sim.ch, moving = ch.d >= 0 && !sim.end, face = ch.face >= 0 ? ch.face : 1;
  const bite = moving ? 0.08 + 0.62 * Math.abs(Math.sin((ch.f / MUN.U) * Math.PI * 2)) : sim.end === 'caught' ? 0.7 + 0.3 * u : 0.12;
  const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][face], half = bite * 0.75;
  c.save(); c.translate(x, y);
  if (caught) { c.scale(1 - u * 0.95, 1 - u * 0.95); }
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, ang + half, ang - half + Math.PI * 2); c.closePath();
  c.fillStyle = caught ? '#e9d4d0' : col; c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();
  const [fx, fy] = DIRS[face], side = face === 1 || face === 3, eyeX = side ? fx * R * 0.1 : -R * 0.35, eyeY = side ? -R * 0.42 : -fy * R * 0.1;   // the eye: above the mouth
  c.fillStyle = P.ink; c.beginPath(); c.arc(eyeX, eyeY, R * 0.11, 0, Math.PI * 2); c.fill();
  c.restore();
}
// A spook: a dome on a wavy skirt in its colour, two eyes looking where it goes; see-through while it waits in the pen,
// deep blue with a wavy mouth while frightened (flashing pale as the fright ends), a pair of eyes going home once eaten.
function munSpook(c, x, y, R, g, sim, now) {
  const fright = g.fr && sim.fr > 0, flash = fright && sim.fr <= FLASH_STEPS && Math.floor(sim.fr / Math.round(MUN.hz * 0.15)) % 2 === 1;
  const look = g.d >= 0 ? g.d : 2, [fx, fy] = DIRS[look], eyes = g.mode === 'eyes', bob = g.mode === 'pen' ? Math.sin(now / 180 + g.i * 2) * R * 0.1 : 0;
  c.save(); c.translate(x, y + bob);
  if (g.mode === 'pen') c.globalAlpha = 0.5;
  if (!eyes) {
    c.beginPath(); c.moveTo(-R, R * 0.95);
    c.lineTo(-R, -R * 0.1); c.arc(0, -R * 0.1, R, Math.PI, 0); c.lineTo(R, R * 0.95);
    for (let t = 0; t < 3; t++) c.arc(R - (2 * t + 1) * R / 3, R * 0.95, R / 3, 0, Math.PI);   // the skirt's three scallops
    c.closePath();
    c.fillStyle = flash ? MAZE.flash : fright ? MAZE.fright : SPOOK[g.i % SPOOK.length]; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = flash ? MAZE.fright : 'rgba(0,0,0,.35)'; c.stroke();
    if (fright) {                                                    // a frightened face: small eyes and a wavy mouth
      c.fillStyle = flash ? MAZE.fright : MAZE.flash;
      c.beginPath(); c.arc(-R * 0.33, -R * 0.2, R * 0.12, 0, Math.PI * 2); c.arc(R * 0.33, -R * 0.2, R * 0.12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = flash ? MAZE.fright : MAZE.flash; c.lineWidth = Math.max(1.4, R * 0.12); c.beginPath();
      for (let i = 0; i <= 6; i++) c.lineTo(-R * 0.6 + i * R * 0.2, R * 0.35 + (i % 2 ? -R * 0.12 : R * 0.12));
      c.stroke(); c.restore(); return;
    }
  }
  for (const s of [-1, 1]) {                                           // the eyes, on where it goes
    const cx = s * R * 0.38 + fx * R * 0.08, cy = -R * 0.2 + fy * R * 0.1;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy, R * 0.26, R * 0.32, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = MAZE.fright; c.beginPath(); c.arc(cx + fx * R * 0.12, cy + fy * R * 0.14, R * 0.14, 0, Math.PI * 2); c.fill();
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
  const scene = `<div class="munscene" data-mun="scene" aria-label="The maze, with the muncher and the spooks in their pen"><canvas data-mun="cv"></canvas>${hud}</div>`;
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
// The miniature: the maze (its corridors over the walls, the dots, the muncher where it stands, a spook at the pen) and
// each player's dots eaten as a bar with its count.
export function miniature(mini, final) {
  const L = layoutOf(mini), goal = munTarget(mini), s = 10, cw = s * 0.72;
  let cor = '', dots = '';
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const c = y * L.w + x;
    if (!L.gopen[c]) continue;
    const cx = x * s + s / 2, cy = y * s + s / 2;
    cor += `M${cx} ${cy}h0.01`;
    if (x + 1 < L.w && L.gopen[c + 1]) cor += `M${cx} ${cy}h${s}`;
    if (y + 1 < L.h && L.gopen[c + L.w]) cor += `M${cx} ${cy}v${s}`;
    if (L.open[c] && L.dots.includes(c) && (x + y) % 2 === 0) dots += `M${cx} ${cy}h0.01`;
  }
  const bar = p => { const n = munScore(mini, p); return `<div class="mr ${p}"><b class="${p}">${p}</b><i><s style="--w:${(100 * Math.min(1, n / goal)).toFixed(1)}%"></s></i><span>${n}</span></div>`; };
  const g0 = L.pen ? L.pen.centre : L.ghosts[0][1] * L.w + L.ghosts[0][0], gx = g0 % L.w, gy = (g0 - gx) / L.w, m0 = munCell(mini, 'X'), mx = m0 % L.w, my = (m0 - mx) / L.w;
  return `<div class="tmun" aria-label="Muncher: X has eaten ${munScore(mini, 'X')}, O ${munScore(mini, 'O')} of ${goal}"><div class="mpic" aria-hidden="true"><svg viewBox="0 0 ${L.w * s} ${L.h * s}"><rect class="bg" x="0" y="0" width="${L.w * s}" height="${L.h * s}" rx="3"/><path class="w" d="${cor}" style="stroke-width:${(cw + 2.2).toFixed(1)}"/><path class="fl" d="${cor}" style="stroke-width:${cw.toFixed(1)}"/><path class="dots" d="${dots}"/><circle class="sp" cx="${gx * s + s / 2}" cy="${gy * s + s / 2}" r="${s * 0.42}"/><circle class="mu" cx="${mx * s + s / 2}" cy="${my * s + s / 2}" r="${s * 0.42}"/></svg></div><div class="mrows">${bar('X')}${bar('O')}</div></div>`;
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
