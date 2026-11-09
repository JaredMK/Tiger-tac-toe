// Cup Pong: the screen, the miniature, the move's words and sounds, and the inputs.
import { PONG, TABLE, pongDist, pongFlick, pongGeom, pongPlan, pongProject } from './rules.js';
import { tune } from '../../core/tune.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked, moveWait } from '../../net/room.js';
import { REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { repNote } from '../../ui/replay.js';
import { runCanvas, runColours } from '../../ui/runner.js';
import { markSvgG } from '../../ui/thumbs.js';

// Cup Pong (November 2026): the table drawn on a canvas in perspective (rules.js pongGeom: the far end narrower, the
// thrower's rack of three cups standing there as cylinders, the ball in the hand at this end, big and near). A flick
// up from anywhere on the table throws it (pongFlick: the swipe's angle aims, straight at what it points at on the
// screen; the finger's speed over its last 80 ms sets the distance), the ball leaving the hand on the same frame.
// The throw plays from the move's event (fxAt('move'): never from a redraw): the ball flies a parabola, shrinking
// with distance and rising on its arc, a soft shadow on the table under it growing smaller and fainter as it rises,
// drawn in front of or behind the cups by depth; then what the throw did (the flash: rules.js pongPath, pongPlan):
// a make drops into the cup (seen through the opening) and splashes, and the cup lifts off the table; a rim ball
// hops off the rim (the cup rocks) into the cup or onto the table; a ball on the table rolls to the edge and falls
// off. Someone else's throw shows their flick first (pongPre: a finger's streak from the ball), then the flight.
// Online, this phone's own throw leaves the hand at once and hangs at the top of its toss until the server's record
// lands (its landing is the server's draw: CLAUDE.md, moves whose result the server draws); the flight then goes on
// from there. The result's word goes in the reserved line under the table, never over it.
const HAND = PONG.hand, RIM_R = PONG.r + PONG.rim, LAUNCH_MS = 240, POP_MS = 260, WOB_MS = 320, SPLASH_MS = 420;
export const pongWord = g => (g.sunk ? 'Splash!' : g.rim ? 'Rim out' : 'Miss');
let pongDrag = null;                           // the swipe under way: { id, x0, y0, pts: [[ms, x, y]...], area }
let launch = null;                             // this phone's throw let go online, before the server's record: { sq, p, at, aim, power }
let pongRep = null;                            // someone else's flick replayed by the shared system's inputs stage (ui/replay.js): { sq, p, aim, power, at }
let src = null;                                // what the last render drew: { mini, f, by, turn, view, zoom, cups, rack }
let raf = 0, geom = null, lastF = null, popAt = 0;
// Someone else's throw (the computer's, the other phone's): their flick shows first, PONG.pre ms (none for a flick the
// shared replay already pressed here, pongRep; none for this phone's own, which it just made).
export function pongPre(f) {
  if (!f || f.type !== 'pong' || !f.pong || f.timeout || REDUCED) return 0;
  const other = state.online ? f.by !== state.online.me : cpuPlays(f.by);
  if (!other) return 0;
  if (pongRep && pongRep.sq === f.square && pongRep.p === f.by) return 0;
  return PONG.pre;
}
function pongTable(mini, a, o) {
  const g = a && a.pong ? a.pong : null, l = mini.last, turn = o.turn, rack = g ? a.by : o.view && l ? l.by : turn;
  const pre = g ? pongPre(a) : 0, P = g ? pongPlan(g, pre) : null, still = REDUCED;
  const cups = p => `<span class="pcups" aria-label="${mini.cups[p].filter(Boolean).length} cups left">${mini.cups[p].map((up, k) => `<i ${g && g.sunk && a.by === p && g.cup === k && !still ? lateAt('on', P.splash, 'out') : `class="${up ? 'on' : ''}"`}></i>`).join('')}</span>`;   // (the cup made empties at the splash, not before)
  const tal = p => arcTally(p, o, cups(p));
  const pend = !g && launchOn(o.zoom), mine = !o.view && !g && !o.locked && !o.done && !pend;
  const standing = mini.cups[rack].filter(Boolean).length;
  const res = g ? `<p ${lateAt('arcres ' + (g.sunk ? 'ok' : 'no'), still ? null : P.res)} role="status">${pongWord(g)}</p>` : o.done && l ? `<p class="arcres ${l.sunk ? 'ok' : 'no'}">${pongWord(l)}</p>` : `<p class="arcnote">${mine || pend || o.view ? '' : waitLine(turn)}</p>`;
  src = { mini, f: g ? a : null, by: g ? a.by : null, turn, view: o.view, zoom: o.zoom, rack, mine, pend, done: o.done };
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="pong${mine ? ' live' : ''}" data-pong="area"><canvas class="pgcv" data-pong="cv" aria-label="The table: ${standing} of ${rack}'s cups standing"></canvas>${res}</div></div>`;   // (no aim guides: the ball and the cups, nothing else)
}
const launchOn = zoom => !!launch && launch.sq === zoom && performance.now() - launch.at < 8000 && (!!moveWait || performance.now() - launch.at < 700);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pongTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
export function moveText(f, who) {
  return f.pong ? `${who} ${f.pong.sunk ? 'sank a cup' : f.pong.rim ? 'rimmed out' : 'missed'}` : `${who} threw`;
}
// The throw's sounds at its moments: the flick's whoosh (this phone's own online throw played its own at the flick:
// none here), the rim's ting, the splash into the cup, the ball's tap on the table, the roll to the edge.
export function sounds(f, add, won, mini, last) {
  const g = f.pong, pre = pongPre(f);
  if (!(state.online && state.online.me && f.by === state.online.me)) add('pongThrow', pre);
  if (!g) return;
  const P = pongPlan(g, pre);
  if (g.rim) add('clink', P.hit);
  if (g.sunk) add('splash', P.splash);
  else { add('thud', P.bounce); if (P.roll > 360) add('pongRoll', P.bounce + 120); }
}

// ---- the flick ----
// The throw a swipe makes (rules.js pongFlick): its direction from first touch to release, its speed over the last
// 80 ms (the oldest sample kept is the last one at least 80 ms back), both in the canvas's pixels.
function pongRead(d, x, y, now) {
  let b = d.pts[0];
  for (const p of d.pts) if (now - p[0] >= 80) b = p; else break;
  const v = Math.hypot(x - b[1], y - b[2]) / Math.max(16, now - b[0]);
  const cv = d.area.querySelector('canvas'), H = cv ? cv.offsetHeight || 400 : 400, mini = state.squares && state.squares[state.zoom] ? state.squares[state.zoom].mini : null;
  return pongFlick(pongGeom(cv ? cv.offsetWidth || 360 : 360, H), x - d.x0, d.y0 - y, v, tune(mini));
}
function pongRelease(e) {
  if (!pongDrag || e.pointerId !== pongDrag.id) return;
  const d = pongDrag; pongDrag = null;
  const r = pongRead(d, e.clientX, e.clientY, performance.now());
  if (!r || state.screen !== 'mini' || state.flash || blocked()) return;   // too short, or sideways: not a throw (the ball stays in the hand)
  repNote('pong', `aim=${r.aim}|power=${r.power}`);
  const sq = state.zoom;
  launch = { sq, p: state.turn, at: performance.now(), aim: r.aim, power: r.power };
  if (state.online) SND.play('pongThrow');                        // (the whoosh at the flick itself: the server's record, and the flight's sounds, come after)
  attemptMove({ aim: r.aim, power: r.power });
  if (!state.online) launch = null;                               // (here, the move played at once: the flight is the flash's, from this same frame)
  pongPaint(performance.now());                                   // the ball leaves on this frame
}

// ---- someone else's flick through the shared replay (ui/replay.js: its inputs stage, when it presses them) ----
// The log's one input: the flick, `aim=..|power=..`; the computer's is made from its move.
const FLICK = /^aim=(-?[\d.]+)\|power=(-?[\d.]+)$/;
function replayInput(act, val, r) {
  const m = act === 'pong' ? FLICK.exec(val || '') : null;
  if (!m) return false;
  pongRep = { sq: r.sq, p: r.by, aim: Number(m[1]), power: Number(m[2]), at: performance.now() };
  schedulePaint();
  return true;
}
const replaySynth = m => (m && typeof m === 'object' && Number.isFinite(m.aim) ? [[0, 'pong', `aim=${m.aim}|power=${m.power}`]] : null);
export const replay = { input: replayInput, synth: replaySynth };

// ---- the drawing ----
function schedulePaint() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(pongPaint); }
const lerp = (a, b, u) => a + (b - a) * u, clamp01 = u => Math.max(0, Math.min(1, u)), ease = u => u * u * (3 - 2 * u);
function geomFor(W, H) { if (!geom || geom.W !== W || geom.H !== H) geom = pongGeom(W, H); return geom; }
// The flight's arc height (table units): by the throw's power, kept so its peak stays on the canvas.
function arcHeight(G, g) {
  const h = 0.28 + 0.3 * (g.power || 0), ymid = (HAND[1] + g.y) / 2, s = G.s(ymid);
  return Math.max(0.1, Math.min(h, G.hC - (0.05 * G.H + 14 - G.Yh) / s));
}
// Where the flight comes down: into the cup (at the rim's height), on the rim, or on the table.
function landing(g) {
  if (g.rim) { const [cx, cy] = PONG.cups[g.cup]; return [cx + Math.sin(g.ra) * RIM_R, cy + Math.cos(g.ra) * RIM_R, PONG.cupH]; }
  return [g.x, g.y, g.sunk ? PONG.cupH : 0];
}
// The ball at t ms into the move (P: the plan, with its pre), from `start` (the hand, or where this phone's own online
// throw hung): { x, y, z, a (alpha), inCup }, or null once it is gone (in the cup, off the table).
export function ballAt(G, g, P, t, start) {
  if (t < P.pre) return { x: start[0], y: start[1], z: start[2], a: 1 };
  const land = landing(g);
  if (t < P.hit) { const u = (t - P.pre) / PONG.fly, h = arcHeight(G, g); return { x: lerp(start[0], land[0], u), y: lerp(start[1], land[1], u), z: lerp(start[2], land[2], u) + 4 * h * u * (1 - u), a: 1 }; }
  if (g.sunk && !g.rim) {                                   // straight in: down into the cup's middle, seen through the opening, gone at the splash
    if (t >= P.splash) return null;
    const u = clamp01((t - P.hit) / PONG.drop), [cx, cy] = PONG.cups[g.cup];
    return { x: lerp(land[0], cx, u), y: lerp(land[1], cy, u), z: lerp(PONG.cupH, 0.01, u * u), a: 1, inCup: g.cup };
  }
  if (g.rim && g.sunk) {                                    // off the rim: up, over the middle, and down in
    if (t >= P.splash) return null;
    const u = clamp01((t - P.hit) / PONG.hop), [cx, cy] = PONG.cups[g.cup];
    const z = u < 0.6 ? PONG.cupH + 0.11 * Math.sin(Math.PI * u) : lerp(PONG.cupH + 0.11 * Math.sin(Math.PI * 0.6), 0.01, Math.pow((u - 0.6) / 0.4, 1.5));
    return { x: lerp(land[0], cx, ease(u)), y: lerp(land[1], cy, ease(u)), z, a: 1, inCup: z < PONG.cupH ? g.cup : undefined };
  }
  let fx = g.x, fy = g.y;                                    // on the table: from where it came down (a rim ball: where it popped to)
  if (g.rim) {
    fx = g.bx; fy = g.by;
    if (t < P.bounce) { const u = clamp01((t - P.hit) / PONG.hop); return { x: lerp(land[0], fx, u), y: lerp(land[1], fy, u), z: PONG.cupH * (1 - u) + 0.13 * 4 * u * (1 - u), a: 1 }; }
  }
  const dt = t - P.bounce;
  if (g.ox == null) return dt < PONG.settle ? { x: fx, y: fy, z: 0, a: 1 } : null;
  if (dt < P.roll) {                                        // rolling to the edge, a little hop as it comes down
    const u = dt / P.roll, hop = 0.045 * Math.sin(Math.PI * clamp01(dt / PONG.bounce));
    return { x: lerp(fx, g.ox, u), y: lerp(fy, g.oy, u), z: hop, a: 1 };
  }
  const o = dt - P.roll;                                    // over the edge: it falls, and is gone
  if (o >= PONG.settle) return null;
  const dx = g.ox - fx, dy = g.oy - fy, n = Math.hypot(dx, dy) || 1, k = o / PONG.settle;
  return { x: g.ox + dx / n * 0.06 * k, y: g.oy + dy / n * 0.06 * k, z: -0.25 * k * k, a: 1 - k };
}
// This phone's own online throw before the record: the ball tossed up out of the hand along the aim, hanging at the top.
function launchPos(l, dt) {
  const u = clamp01(dt / LAUNCH_MS), th = l.aim * PONG.angle, bob = dt > LAUNCH_MS ? 0.012 * Math.sin((dt - LAUNCH_MS) / 180) : 0;
  return [HAND[0] + Math.sin(th) * 0.1 * u, HAND[1] + Math.cos(th) * 0.1 * u, HAND[2] + 0.09 * Math.sin(Math.PI / 2 * u) + bob];
}
function ellipseAt(G, x, y, z, r) {                       // a circle of radius r on the table (at height z), as drawn: its centre and radii
  const C = pongProject(G, x, y, z), n = pongProject(G, x, y - r, z), f = pongProject(G, x, y + r, z);
  return { X: C.X, Y: C.Y, rx: r * C.s, ry: Math.max(1, (n.Y - f.Y) / 2) };
}
function ell(c, e, k = 1) { c.beginPath(); c.ellipse(e.X, e.Y, Math.max(0.5, e.rx * k), Math.max(0.5, e.ry * k), 0, 0, Math.PI * 2); }
function drawTable(c, G, P) {
  const q = [[-TABLE.x, TABLE.y0], [TABLE.x, TABLE.y0], [TABLE.x, TABLE.y1], [-TABLE.x, TABLE.y1]].map(([x, y]) => pongProject(G, x, y, 0));
  const edge = 0.045, e = [[-TABLE.x, TABLE.y0], [TABLE.x, TABLE.y0]].map(([x, y]) => pongProject(G, x, y, -edge));
  c.fillStyle = '#5a3a22';                                                                 // the table's front edge, below the top
  c.beginPath(); c.moveTo(q[0].X, q[0].Y); c.lineTo(q[1].X, q[1].Y); c.lineTo(e[1].X, e[1].Y); c.lineTo(e[0].X, e[0].Y); c.closePath(); c.fill();
  const grad = c.createLinearGradient(0, q[2].Y, 0, q[0].Y);                                 // the top: green, lighter at the near end
  grad.addColorStop(0, '#2f7a4a'); grad.addColorStop(1, '#3f9a5e');
  c.beginPath(); c.moveTo(q[0].X, q[0].Y); c.lineTo(q[1].X, q[1].Y); c.lineTo(q[2].X, q[2].Y); c.lineTo(q[3].X, q[3].Y); c.closePath();
  c.fillStyle = grad; c.fill(); c.lineWidth = 3; c.strokeStyle = '#6b4a2b'; c.stroke();     // a wooden rail round it
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5;                               // the centre line
  const m0 = pongProject(G, 0, TABLE.y0 + 0.02, 0), m1 = pongProject(G, 0, TABLE.y1 - 0.02, 0);
  c.beginPath(); c.moveTo(m0.X, m0.Y); c.lineTo(m1.X, m1.Y); c.stroke();
}
// A cup as a cylinder in the player's colour: its bottom, its body, the rim and the water in it. lift: 0 to 1 of its way
// up and off (a cup made); wob: a rock about its base (the rim struck); a: its alpha.
function drawCup(c, G, cx, cy, col, o = {}) {
  const lift = o.lift || 0, z0 = lift * 0.45, R = RIM_R, Rb = R * 0.78;
  const top = ellipseAt(G, cx, cy, z0 + PONG.cupH, R), bot = ellipseAt(G, cx, cy, z0, Rb), base = pongProject(G, cx, cy, 0);
  c.save();
  if (o.a != null) c.globalAlpha = o.a;
  if (o.wob) { c.translate(base.X, base.Y); c.rotate(o.wob); c.translate(-base.X, -base.Y); }
  c.beginPath(); c.moveTo(bot.X - bot.rx, bot.Y); c.lineTo(top.X - top.rx, top.Y); c.lineTo(top.X + top.rx, top.Y); c.lineTo(bot.X + bot.rx, bot.Y); c.closePath();
  c.fillStyle = col; c.fill();
  ell(c, bot); c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)';                                                         // its shaded side
  c.beginPath(); c.moveTo(bot.X + bot.rx * 0.45, bot.Y + bot.ry * 0.9); c.lineTo(top.X + top.rx * 0.45, top.Y + top.ry * 0.9); c.lineTo(top.X + top.rx, top.Y); c.lineTo(bot.X + bot.rx, bot.Y); c.closePath(); c.fill();
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(0,0,0,.55)';                                     // the outline
  c.beginPath(); c.moveTo(bot.X - bot.rx, bot.Y); c.lineTo(top.X - top.rx, top.Y); c.moveTo(bot.X + bot.rx, bot.Y); c.lineTo(top.X + top.rx, top.Y); c.stroke();
  ell(c, bot); c.stroke();
  ell(c, top); c.fillStyle = col; c.fill(); c.stroke();                                     // the rim
  c.fillStyle = 'rgba(0,0,0,.42)'; ell(c, top, 0.82); c.fill();                            // the opening
  c.fillStyle = 'rgba(88,168,207,.75)'; ell(c, top, 0.72); c.fill();                       // the water
  c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, { X: top.X - top.rx * 0.25, Y: top.Y + top.ry * 0.1, rx: top.rx * 0.25, ry: top.ry * 0.22 }); c.fill();
  c.restore();
}
function drawBall(c, X, Y, r, a, ink) {
  c.save(); c.globalAlpha = a;
  c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = Math.max(1.2, r * 0.18); c.strokeStyle = ink; c.stroke();
  c.beginPath(); c.arc(X, Y, r * 0.98, Math.PI * 0.15, Math.PI * 0.85); c.lineWidth = r * 0.32; c.strokeStyle = 'rgba(0,0,0,.12)'; c.stroke();   // its underside, shaded
  c.beginPath(); c.arc(X - r * 0.32, Y - r * 0.35, r * 0.22, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill();
  c.restore();
}
function drawShadow(c, G, b) {
  const up = clamp01(b.z / 0.5), e = ellipseAt(G, b.x, b.y, 0, PONG.ballR * (1 - 0.35 * up));
  c.fillStyle = `rgba(0,0,0,${(0.3 * (1 - 0.6 * up) * b.a).toFixed(3)})`; ell(c, e); c.fill();
}
// The streak of a flick from the ball: a finger's trail along the throw's direction, as long as the throw is hard (u: 0 to 1 of it).
function drawFlick(c, G, aim, power, u, col) {
  const th = aim * PONG.angle, d = pongDist(power), Hs = pongProject(G, HAND[0], HAND[1], HAND[2]), L = pongProject(G, Math.sin(th) * d, Math.cos(th) * d, 0);
  const dx = L.X - Hs.X, dy = L.Y - Hs.Y, n = Math.hypot(dx, dy) || 1, len = (60 + 100 * power) * G.H / 400, k = ease(u);
  const ex = Hs.X + dx / n * len * k, ey = Hs.Y + dy / n * len * k;
  c.save(); c.lineCap = 'round';
  const grad = c.createLinearGradient(Hs.X, Hs.Y, ex, ey); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, col);
  c.globalAlpha = 0.75 * (1 - Math.max(0, u - 0.7) / 0.3);
  c.beginPath(); c.moveTo(Hs.X, Hs.Y); c.lineTo(ex, ey); c.lineWidth = 7; c.strokeStyle = grad; c.stroke();
  c.beginPath(); c.arc(ex, ey, 9, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
  c.restore();
}
// The splash: drops thrown up out of the cup, and a ring on the water (u: 0 to 1 of it).
function drawSplash(c, G, cx, cy, u) {
  const top = ellipseAt(G, cx, cy, PONG.cupH, RIM_R);
  c.save(); c.globalAlpha = 1 - u * u;
  c.strokeStyle = 'rgba(88,168,207,.9)'; c.lineWidth = 2; ell(c, top, 0.4 + 0.6 * u); c.stroke();
  c.fillStyle = '#9fd3ee'; c.strokeStyle = '#2c6f8f'; c.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.5, sp = 0.09 + 0.03 * ((k * 7) % 3), x = cx + Math.cos(a) * sp * u * 1.6, z = PONG.cupH + Math.sin(-a) * sp * 1.2 * u - 0.22 * u * u;
    const p = pongProject(G, x, cy - 0.01, Math.max(PONG.cupH * 0.6, z)), r = Math.max(1.2, PONG.ballR * 0.3 * p.s);
    c.beginPath(); c.arc(p.X, p.Y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.restore();
}
// One frame of the table as it is now (from the last render's state and the move's clock); true when another is wanted.
function pongFrame(c, G, now) {
  const Pal = runColours(), mini = src.mini, f = src.f, g = f ? f.pong : null, cupCol = { X: Pal.X, O: Pal.O };
  const at = f ? fxAt('move', f) : null, t = at == null ? null : now - at, pre = f ? pongPre(f) : 0, P = g ? pongPlan(g, pre) : null;
  const rack = src.rack, up = (g ? g.cups : mini.cups)[rack].slice();
  let more = false;
  c.clearRect(0, 0, G.W, G.H);
  drawTable(c, G, Pal);
  if (g && REDUCED) { PONG.cups.forEach(([cx, cy], k) => { if (up[k]) drawCup(c, G, cx, cy, cupCol[rack]); }); return false; }   // (reduced motion: the throw's end at once)
  const items = [];                                            // what stands on the table, drawn far to near: { d (depth: its y), draw }
  let ball = null, lifting = null;
  if (g && t != null) {
    const start = launch && launch.sq === src.zoom && launch.p === f.by && at - launch.at < 8000 && at > launch.at ? launchPos(launch, at - launch.at) : HAND;
    ball = ballAt(G, g, P, t, start);
    if (g.sunk && t >= P.lift) lifting = clamp01((t - P.lift) / PONG.lift);
    if (g.sunk) up[g.cup] = lifting == null || lifting < 1;   // the cup made stands until it is lifted off
    more = t < P.end + PONG.settle;
  } else if (src.pend && launch) {
    const l = launch, p = launchPos(l, now - l.at);
    ball = { x: p[0], y: p[1], z: p[2], a: 1 }; more = true;
  } else if (!src.view) {
    const pop = popAt && now - popAt < POP_MS ? Math.sin(Math.PI * (now - popAt) / POP_MS) * 0.3 : 0;   // back in the hand: a small pop
    ball = { x: HAND[0], y: HAND[1], z: HAND[2], a: 1, pop }; more = pop > 0;
  }
  PONG.cups.forEach(([cx, cy], k) => {
    if (!up[k]) return;
    const o = {};
    if (g && t != null && g.cup === k) {
      if (g.rim && t >= P.hit && t < P.hit + WOB_MS) { const u = (t - P.hit) / WOB_MS; o.wob = Math.sin(u * Math.PI * 3) * 0.09 * (1 - u) * (g.ra < 0 ? -1 : 1); }
      if (lifting != null) { o.lift = lifting; o.a = 1 - lifting * lifting; }
    }
    items.push({ d: cy + (o.lift ? -1 : 0), draw: () => drawCup(c, G, cx, cy, cupCol[rack], o) });
  });
  if (ball) {
    if (ball.z >= -0.001 && ball.inCup == null) drawShadow(c, G, ball);
    const p = pongProject(G, ball.x, ball.y, ball.z), r = PONG.ballR * p.s * (1 + (ball.pop || 0));
    if (ball.inCup != null) {                                  // in the cup: seen through its opening alone
      const [cx, cy] = PONG.cups[ball.inCup], top = ellipseAt(G, cx, cy, PONG.cupH, RIM_R);
      items.push({ d: cy - 0.001, draw: () => { c.save(); ell(c, top, 0.82); c.clip(); drawBall(c, p.X, p.Y, r, ball.a, Pal.ink); c.restore(); } });
    } else items.push({ d: ball.y, draw: () => drawBall(c, p.X, p.Y, r, ball.a, Pal.ink) });
  }
  items.sort((a, b) => b.d - a.d).forEach(i => i.draw());
  if (g && t != null && g.sunk && t >= P.splash && t < P.splash + SPLASH_MS) drawSplash(c, G, PONG.cups[g.cup][0], PONG.cups[g.cup][1], (t - P.splash) / SPLASH_MS);
  if (g && t != null && pre && t < pre) drawFlick(c, G, g.aim, g.power, clamp01(t / (pre * 0.85)), cupCol[f.by]);   // someone else's flick, before their ball flies
  else if (!g && pongRep && pongRep.sq === src.zoom && now - pongRep.at < 4000) { drawFlick(c, G, pongRep.aim, pongRep.power, clamp01((now - pongRep.at) / (PONG.pre * 0.85)), cupCol[pongRep.p]); more = more || now - pongRep.at < PONG.pre; }
  return more;
}
// After every render of the square (and every frame while a throw plays): the table as it is now.
export function pongPaint(now) {
  raf = 0;
  const cv = app.querySelector('canvas[data-pong="cv"]');
  if (!cv || typeof cv.getContext !== 'function' || !src) return;
  const f = src.f;
  if (f) { lastF = f; popAt = 0; }
  else if (lastF) { lastF = null; if (src.mine && !REDUCED) popAt = now; }   // the result cleared, the ball back in the hand
  if (f && launch && launch.p === f.by && launch.sq === src.zoom) launch.flown = true;   // (the flight took over from the toss)
  else if (!f && launch && (launch.flown || now - launch.at > 8000)) launch = null;
  if (pongRep && f && f.pong && f.by === pongRep.p && f.square === pongRep.sq) pongRep.flown = true;   // (the flick the shared replay pressed: its throw is playing, no streak before it)
  else if (pongRep && !f && (pongRep.flown || now - pongRep.at > 6000 || pongRep.sq !== src.zoom)) pongRep = null;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  if (pongFrame(c, geomFor(W, H), now)) raf = requestAnimationFrame(pongPaint);
}

// ---- the miniature ----
// A tiny table in the same perspective, each player's rack of cups at the far end (X's on the left, O's on the right)
// in their colour: a cup still standing drawn as a cup, one sunk as the ring where it stood; so the barer a rack, the
// closer that player is to the square. Each end's mark drawn under its rack (a letter would be too small to read).
const TPG = { X: [[26, 25], [18, 20], [34, 20]], O: [[74, 25], [66, 20], [82, 20]] };
export function miniature(mini, final) {
  const cup = (p, k) => { const [x, y] = TPG[p][k], up = mini.cups[p][k], r = 4.6, h = 6; return up
    ? `<g class="c ${p}"><ellipse class="cb" cx="${x}" cy="${y}" rx="${r * 0.8}" ry="${r * 0.3}"/><path class="cb" d="M${x - r * 0.8} ${y}L${x - r} ${y - h}L${x + r} ${y - h}L${x + r * 0.8} ${y}Z"/><ellipse class="ct" cx="${x}" cy="${y - h}" rx="${r}" ry="${r * 0.4}"/><ellipse class="cw" cx="${x}" cy="${y - h}" rx="${r * 0.68}" ry="${r * 0.26}"/></g>`
    : `<ellipse class="cs" cx="${x}" cy="${y}" rx="${r * 0.8}" ry="${r * 0.3}"/>`; };
  const n = p => mini.cups[p].filter(up => !up).length;
  return `<div class="tpg" aria-label="Cup Pong: X has sunk ${n('X')}, O ${n('O')} of 3"><svg viewBox="0 0 100 58" aria-hidden="true"><path class="tedge" d="M8 44L92 44L96 49L4 49Z"/><path class="ttop" d="M20 10H80L92 44H8Z"/><path class="tline" d="M50 11v32"/>${[0, 1, 2].map(k => cup('X', k)).join('')}${[0, 1, 2].map(k => cup('O', k)).join('')}<g class="tpm X" transform="translate(26 54)">${markSvgG('X', 3.4)}</g><g class="tpm O" transform="translate(74 54)">${markSvgG('O', 3.4)}</g></svg></div>`;
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  // Cup Pong: a flick up from anywhere on the game area (the table and the line under it), not only the ball. The
  // swipe's direction aims, its speed sets the distance; nothing is drawn while it is under way (no aim line, no
  // target). Letting go throws at once, as does the finger leaving the table; a short or sideways swipe is nothing.
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.pong.live[data-pong="area"]');
    if (!area || pongDrag || state.screen !== 'mini' || state.flash || state.done || blocked() || launchOn(state.zoom)) return;
    ownPress();
    const now = performance.now();
    pongDrag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, area, pts: [[now, e.clientX, e.clientY]] };
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    e.preventDefault();
  });
  app.addEventListener('pointermove', e => {
    if (!pongDrag || e.pointerId !== pongDrag.id) return;
    const d = pongDrag, now = performance.now();
    d.pts.push([now, e.clientX, e.clientY]);
    while (d.pts.length > 2 && now - d.pts[1][0] > 160) d.pts.shift();   // (the oldest sample kept is the last one at least 80 ms back: pongRead)
    const cv = d.area.querySelector('canvas'), r = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
    if (r && (e.clientY < r.top || e.clientX < r.left - 8 || e.clientX > r.right + 8)) pongRelease(e);   // the finger leaves the table: the throw goes
  });
  app.addEventListener('pointerup', pongRelease);
  app.addEventListener('pointercancel', e => { if (pongDrag && e.pointerId === pongDrag.id) pongDrag = null; });
}
