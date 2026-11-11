// Bowling: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { PHYSICS, physShot, physicsReady } from '../shared/physics.js';
import { BOWLG, BLANE, bowlFlick, bowlGeom, bowlProject, bowlScreenAngle, bowlTarget } from './rules.js';
import { ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, state } from '../../ui/app.js';
import { physPaint, physPendOn, physResult, physTable, physThumb } from '../../ui/physics.js';
import { repNote } from '../../ui/replay.js';
import { rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

// Bowling (reworked November 2026, to Cup Pong's standard): the lane drawn on the canvas in perspective (rules.js
// bowlGeom: the camera behind the bowler, the pins small at the far end, the ball big in the hand). A flick up from
// anywhere on the game area rolls it (bowlFlick: the swipe's angle is the line the ball takes as the lane is drawn, the
// finger's speed over its last 80 ms the power), the ball leaving on the same frame; nothing is drawn while the swipe
// is under way (no arrow, no meter). The roll is the physics' recording (the same on both phones and the server),
// played from the move's event (ui/physics.js): the ball rolls away shrinking, its finger holes turning with it, a
// shadow under it; a pin knocked off its spot topples over the way it was sent (it hops, tips, lies and slides as the
// recording moves it), a pin only nudged rocks and stands; what passes the end of the lane drops into the pit; a ball in
// the gutter runs on down it. Once everything has settled the sweep comes down (BOWL_SWEEP ms, inside the move's hold):
// the pins left standing are lifted, the fallen ones swept into the pit, and the standing ones set down again: the rack
// as the roll left it. Someone else's roll shows their flick first, as a streak from the ball (the shared replay's one
// input: replay.input/synth), then the roll. The result's words go in the reserved line under the lane; each player's
// rolls are score boxes on the board over the pins.
export const BOWL_SWEEP = 420;                 // the sweep after a roll, ms (within BOWLG.hold and the result's hold)
const PIN_H = 13.5, STREAK_MS = 360;           // a pin's height in lane units; a replayed flick's streak
let drag = null;                               // the swipe under way: { id, x0, y0, pts: [[ms, x, y]...], area }
let bowlRep = null;                            // someone else's flick replayed by the shared system's inputs stage (ui/replay.js): { sq, p, aim, power, at }
export const bowlRepOn = () => bowlRep;        // (the tests look)
let geom = null, layer = null;

// ---- the words ----
// The line under the lane while it is this player's roll and a finished game waits on it (rules.js `final`): the
// roll that answers the leader's total, or the leader's own that takes a square left unanswered. Else nothing.
export function bowlNote(mini, turn) {
  const f = mini.final;
  if (!f) return '';
  if (f.by === turn) return 'No answer yet: roll to take it';
  return `One roll to beat <b class="${f.by}">${N(f.by)}</b>'s ${mini.pins[f.by]}`;
}

// ---- the flick ----
// The roll a swipe makes (rules.js bowlFlick): its direction from first touch to release, its speed over the last
// 80 ms (the oldest sample kept is the last one at least 80 ms back), both in the canvas's pixels.
function bowlRead(d, x, y, now) {
  let b = d.pts[0];
  for (const p of d.pts) if (now - p[0] >= 80) b = p; else break;
  const v = Math.hypot(x - b[1], y - b[2]) / Math.max(16, now - b[0]);
  const cv = d.area.querySelector('canvas'), mini = state.squares && state.squares[state.zoom] ? state.squares[state.zoom].mini : null;
  return bowlFlick(bowlGeom(cv ? cv.offsetWidth || 340 : 340, cv ? cv.offsetHeight || 400 : 400), x - d.x0, d.y0 - y, v, tune(mini));
}
function bowlRelease(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  const r = bowlRead(d, e.clientX, e.clientY, performance.now());
  const sq = state.squares && state.squares[state.zoom];
  if (!r || state.screen !== 'mini' || !sq || sq.mini.type !== 'bowling' || sq.owner || state.flash || state.done || blocked() || !physicsReady() || physPendOn()) return;   // too short, or sideways: not a roll (the ball stays in the hand)
  repNote('bowl', `aim=${r.aim}|power=${r.power}`);
  attemptMove(physShot({ aim: r.aim, power: r.power }));           // the ball leaves on this frame (the move's flash here; online, the roll played at once: ui/physics.js physLaunch)
}

// ---- someone else's flick through the shared replay (ui/replay.js: its inputs stage, when it presses them) ----
// The log's one input: the flick, `aim=..|power=..`; the computer's is made from its move.
const FLICK = /^aim=(-?[\d.]+)\|power=(-?[\d.]+)$/;
function replayInput(act, val, r) {
  const m = act === 'bowl' ? FLICK.exec(val || '') : null;
  if (!m) return false;
  bowlRep = { sq: r.sq, p: r.by, aim: Number(m[1]), power: Number(m[2]), at: performance.now(), speed: r.speed || 1 };
  physPaint();
  return true;
}
const replaySynth = m => (m && typeof m === 'object' && Number.isFinite(m.aim) ? [[0, 'bowl', `aim=${m.aim}|power=${m.power}`]] : null);
export const replay = { input: replayInput, synth: replaySynth };

// ---- the roll's recording, read once for the drawing ----
// For each pin: when it was first moved (hit, s into the move as it plays), which way and how fast it was sent, whether
// it ends down (the result's own word), and when it left the lane for the pit (gone). For the ball: how far it has
// rolled by each frame (its turning), and how it left (the pit past the end, or the gutter: it runs on down it).
const FX = new WeakMap();
export function rollFx(ph) {
  const rec = ph.rec;
  let o = FX.get(rec);
  if (o) return o;
  const fps = rec.fps, n = rec.frames.length, idx = {};
  rec.ids.forEach((id, i) => { idx[id] = i; });
  const at = (id, k) => { const i = idx[id], f = rec.frames[k]; return i == null || !f || f[2 * i] == null ? null : [f[2 * i], f[2 * i + 1]]; };
  const pins = {};
  for (let k = 0; k < 10; k++) {
    const id = 'p' + k, start = at(id, 0);
    if (!start) continue;
    let hit = null, gone = null, last = start, before = start;
    for (let f = 1; f < n; f++) {
      const p = at(id, f);
      if (!p) { gone = f; break; }
      if (hit == null && Math.hypot(p[0] - start[0], p[1] - start[1]) > 0.2) hit = f;
      before = last; last = p;
    }
    let dir = [0, -1], v = 0;
    if (hit != null) {
      const a = at(id, hit - 1) || start, b = at(id, Math.min(n - 1, hit + 2)) || last, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len > 1e-6) { dir = [dx / len, dy / len]; v = len * fps / 3; }
    }
    const moved = Math.hypot(last[0] - start[0], last[1] - start[1]);
    pins[k] = { start, hit: hit == null ? null : (hit - 1) / fps, gone: gone == null ? null : gone / fps, dir, v, last, vel: [(last[0] - before[0]) * fps, (last[1] - before[1]) * fps],
      down: ph.down ? !!ph.down[k] : gone != null || moved > 2.2 };
  }
  const dist = [0];
  let gone = null, last = at('ball', 0) || BLANE.start, before = last;
  for (let f = 1; f < n; f++) {
    const p = at('ball', f);
    if (!p) { if (gone == null) gone = f; dist.push(dist[f - 1]); continue; }
    dist.push(dist[f - 1] + Math.hypot(p[0] - last[0], p[1] - last[1])); before = last; last = p;
  }
  const how = gone == null ? null : (ph.events || []).some(e => e.k === 'gutter' && e.id === 'ball') ? 'gutter' : 'pit';
  o = { fps, n, pins, ball: { dist, gone: gone == null ? null : gone / fps, last, vel: [(last[0] - before[0]) * fps, (last[1] - before[1]) * fps], how } };
  FX.set(rec, o);
  return o;
}

// ---- the drawing ----
const clamp01 = u => Math.max(0, Math.min(1, u)), ease = u => u * u * (3 - 2 * u);
function geomFor(W, H) { if (!geom || geom.W !== W || geom.H !== H) geom = bowlGeom(W, H); return geom; }
const quad = (c, G, pts) => { c.beginPath(); pts.forEach(([x, y, z], i) => { const p = bowlProject(G, x, y, z || 0); if (i) c.lineTo(p.X, p.Y); else c.moveTo(p.X, p.Y); }); c.closePath(); };
// The lane and all that stands still, drawn once for a canvas size (and again only when it changes): the hall, the
// pit and its curtain, the walls beside the pin deck, the gutters, the lane with its boards, arrows and foul line.
function drawLane(c, G) {
  const g0 = BLANE.gutter, g1 = BLANE.w - BLANE.gutter, n = BLANE.near, f = BLANE.far;
  c.fillStyle = '#262933'; c.fillRect(0, 0, G.W, G.H);                                     // the hall
  const top = bowlProject(G, 50, f, 34);
  const wall = c.createLinearGradient(0, 0, 0, top.Y + 40); wall.addColorStop(0, '#191b22'); wall.addColorStop(1, '#2b2e3a');
  c.fillStyle = wall; c.fillRect(0, 0, G.W, Math.max(0, bowlProject(G, 50, 0, 0).Y));       // the wall over the pit (the score board hangs on it)
  quad(c, G, [[-8, f, -5], [108, f, -5], [108, f, 30], [-8, f, 30]]); c.fillStyle = '#14151b'; c.fill();   // the pit's curtain
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
  for (let x = -4; x <= 104; x += 6) { const a = bowlProject(G, x, f, -5), b = bowlProject(G, x, f, 30); c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(b.X, b.Y); c.stroke(); }
  quad(c, G, [[-8, f, -5], [108, f, -5], [108, 0, -5], [-8, 0, -5]]); c.fillStyle = '#0c0d11'; c.fill();   // the pit's floor
  for (const s of [-1, 1]) {                                                                 // either side: the floor, the division, the wall beside the pin deck, the gutter
    const x0 = s < 0 ? 0 : BLANE.w, out = x0 + s * 9, far = x0 + s * 60;
    quad(c, G, [[out, n, 0], [far, n, 0], [far, f, 0], [out, f, 0]]); c.fillStyle = '#30343f'; c.fill();
    quad(c, G, [[x0, n, 1.6], [out, n, 1.6], [out, 0, 1.6], [x0, 0, 1.6]]); c.fillStyle = '#5a5f6e'; c.fill();
    quad(c, G, [[x0, n, 1.6], [x0, n, -1.4], [x0, 0, -1.4], [x0, 0, 1.6]]); c.fillStyle = '#3d414d'; c.fill();
    quad(c, G, [[x0 + s * 1, 70, 1.6], [x0 + s * 1, f, 1.6], [x0 + s * 1, f, 17], [x0 + s * 1, 70, 12]]); c.fillStyle = '#474c5a'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
    const a = s < 0 ? 0 : g1, b = s < 0 ? g0 : BLANE.w;
    quad(c, G, [[a, n, -1.4], [b, n, -1.4], [b, 0, -1.4], [a, 0, -1.4]]);
    const gg = c.createLinearGradient(bowlProject(G, a, 120, 0).X, 0, bowlProject(G, b, 120, 0).X, 0); gg.addColorStop(0, s < 0 ? '#1f2128' : '#2f323c'); gg.addColorStop(1, s < 0 ? '#2f323c' : '#1f2128');
    c.fillStyle = gg; c.fill();
  }
  quad(c, G, [[g0, n, 0], [g1, n, 0], [g1, 0, 0], [g0, 0, 0]]);                             // the lane: wood, paler towards the pins
  const far = bowlProject(G, 50, 0, 0), near = bowlProject(G, 50, n, 0);
  const wood = c.createLinearGradient(0, far.Y, 0, near.Y); wood.addColorStop(0, '#f1d7a4'); wood.addColorStop(0.25, '#eccb8f'); wood.addColorStop(1, '#e2b877');
  c.fillStyle = wood; c.fill();
  c.save(); c.clip();
  quad(c, G, [[g0, n, 0], [g1, n, 0], [g1, 228, 0], [g0, 228, 0]]); c.fillStyle = 'rgba(120,70,20,.14)'; c.fill();   // the approach, behind the foul line
  c.strokeStyle = 'rgba(120,70,20,.2)'; c.lineWidth = 1;                                   // the boards
  for (let k = 1; k < 14; k++) { const x = g0 + k * (g1 - g0) / 14, a = bowlProject(G, x, n, 0), b = bowlProject(G, x, 0, 0); c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(b.X, b.Y); c.stroke(); }
  const shine = c.createLinearGradient(bowlProject(G, 26, 120, 0).X, 0, bowlProject(G, 74, 120, 0).X, 0);   // the lane's gloss, down the middle
  shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(0.5, 'rgba(255,255,255,.16)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = shine; c.fillRect(0, far.Y, G.W, near.Y - far.Y);
  c.fillStyle = 'rgba(110,60,20,.55)';                                                      // the arrows, and the dots before the foul line
  for (let i = 0; i < 7; i++) { const x = 50 + (i - 3) * 9.5, y = 150 - Math.abs(i - 3) * 7; quad(c, G, [[x, y - 9, 0], [x + 1.9, y, 0], [x - 1.9, y, 0]]); c.fill(); }
  for (let i = 0; i < 5; i++) { const p = bowlProject(G, 50 + (i - 2) * 12, 202, 0); c.beginPath(); c.ellipse(p.X, p.Y, 1.1 * p.s, 0.5 * p.s, 0, 0, Math.PI * 2); c.fill(); }
  quad(c, G, [[g0, 229, 0], [g1, 229, 0], [g1, 227, 0], [g0, 227, 0]]); c.fillStyle = 'rgba(40,20,5,.7)'; c.fill();   // the foul line
  c.fillStyle = 'rgba(60,30,10,.35)';                                                       // the pin spots
  for (const [x, y] of PHYSICS.lib.BOWL.pins) { const p = bowlProject(G, x, y, 0), q = bowlProject(G, x, y + 1.2, 0); c.beginPath(); c.ellipse(p.X, p.Y, 1.6 * p.s, Math.max(0.6, q.Y - p.Y), 0, 0, Math.PI * 2); c.fill(); }
  quad(c, G, [[g0, 2, 0], [g1, 2, 0], [g1, 0, 0], [g0, 0, 0]]); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill();   // the lane's end over the pit
  c.restore();
  c.lineWidth = 2; c.strokeStyle = 'rgba(60,35,15,.75)';                                    // the lane's edges
  for (const x of [g0, g1]) { const a = bowlProject(G, x, n, 0), b = bowlProject(G, x, 0, 0); c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(b.X, b.Y); c.stroke(); }
}
function laneLayer(G) {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1), key = `${G.W}x${G.H}x${dpr}`;
  if (layer && layer.key === key) return layer.cv;
  try {
    const cv = document.createElement('canvas'); cv.width = Math.round(G.W * dpr); cv.height = Math.round(G.H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLane(c, G);
    layer = { key, cv };
    return cv;
  } catch (e) { layer = null; return null; }                      // (no canvas to keep it on: drawn straight each frame)
}
// A circle of radius r lying on the lane (at height z), as drawn: its centre and radii.
function ellipseAt(G, x, y, z, r) {
  const C = bowlProject(G, x, y, z), a = bowlProject(G, x, y - r, z), b = bowlProject(G, x, y + r, z);
  return { X: C.X, Y: C.Y, rx: r * C.s, ry: Math.max(0.8, (b.Y - a.Y) / 2) };
}
// A pin, from its foot at (x, y, z): standing (tip 0), or tipped over by `tip` radians the way (dx, dy) on the lane.
// Drawn along the line from its foot to its head as the camera sees it: white, two red bands on the neck, an ink edge.
const PIN_SHAPE = [[0, 1.3], [0.07, 1.75], [0.3, 2.35], [0.47, 1.95], [0.63, 0.95], [0.73, 0.82], [0.85, 1.28], [0.94, 1.1], [1, 0.45]];   // (how far up it, its half width in lane units)
function drawPin(c, G, x, y, o, P) {
  const tip = o.tip || 0, z = o.z || 0, dx = o.dir ? o.dir[0] : 0, dy = o.dir ? o.dir[1] : -1, st = Math.sin(tip), ct = Math.cos(tip);
  const B = bowlProject(G, x, y, z), T = bowlProject(G, x + PIN_H * st * dx, y + PIN_H * st * dy, z + PIN_H * ct);
  const s = B.s, vx = T.X - B.X, vy = T.Y - B.Y, len = Math.max(Math.hypot(vx, vy), 3.6 * s), ang = Math.atan2(vx, -vy);   // (seen end on, it is still as long as it is wide)
  c.save();
  if (o.a != null) c.globalAlpha = o.a;
  c.translate(B.X, B.Y); c.rotate(ang);
  const path = () => {
    c.beginPath(); c.moveTo(-PIN_SHAPE[0][1] * s, 0);
    for (let k = 1; k < PIN_SHAPE.length; k++) { const [u0, w0] = PIN_SHAPE[k - 1], [u1, w1] = PIN_SHAPE[k]; c.quadraticCurveTo(-w0 * s, -(u0 + (u1 - u0) * 0.5) * len, -w1 * s, -u1 * len); }
    for (let k = PIN_SHAPE.length - 1; k > 0; k--) { const [u0, w0] = PIN_SHAPE[k], [u1, w1] = PIN_SHAPE[k - 1]; c.quadraticCurveTo(w0 * s, -(u0 + (u1 - u0) * 0.5) * len, w1 * s, -u1 * len); }
    c.closePath();
  };
  path(); c.fillStyle = '#fffdf6'; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(40,30,60,.16)'; c.fillRect(0.5 * s, -len, 3 * s, len);              // its shaded side
  c.fillStyle = P.X; c.fillRect(-3 * s, -0.7 * len, 6 * s, 0.035 * len); c.fillRect(-3 * s, -0.635 * len, 6 * s, 0.035 * len);   // the bands
  c.restore();
  path(); c.lineWidth = Math.max(1, 0.34 * s); c.strokeStyle = P.ink; c.stroke();
  c.restore();
}
// The ball: the mover's colour, shaded, its three finger holes turning as it rolls (roll: radians turned, head: the way
// it is going on the lane), a soft shadow under it on the lane.
const HOLES = [[-0.3, 0.12, 1], [0.3, 0.12, 1], [0, -0.3, 1]].map(([x, f, z]) => { const n = Math.hypot(x, f, z); return [x / n, f / n, z / n]; });
function drawBall(c, G, x, y, o, col, P) {
  const R = PHYSICS.lib.BOWL.ballR, z = o.z || 0, p = bowlProject(G, x, y, z + R), r = R * p.s;
  if (o.a != null && o.a <= 0) return;
  c.save();
  if (o.a != null) c.globalAlpha = o.a;
  if (z > -R) { const e = ellipseAt(G, x + 0.6, y + 0.4, 0, R * 1.02); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(e.X, e.Y, e.rx, e.ry, 0, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(p.X, p.Y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill();
  c.save(); c.clip();
  const sh = c.createRadialGradient(p.X - r * 0.35, p.Y - r * 0.45, r * 0.1, p.X, p.Y, r * 1.05);   // lit from the upper left, dark underneath
  sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.35, 'rgba(255,255,255,.08)'); sh.addColorStop(1, 'rgba(0,0,0,.38)');
  c.fillStyle = sh; c.fillRect(p.X - r, p.Y - r, 2 * r, 2 * r);
  const beta = Math.atan2(G.hC, G.dC + BLANE.near - y), sb = Math.sin(beta), cb = Math.cos(beta), th = o.roll || 0, cs = Math.cos(th), sn = Math.sin(th);
  const hx = o.head ? o.head[0] : 0;                              // (the sideways lean of its path: the holes drift across as it goes)
  c.fillStyle = 'rgba(0,0,0,.72)';
  for (const [ax, af, az] of HOLES) {                              // each hole, turned forward by the roll about the ball's axle, seen from the camera
    const f = af * cs + az * sn, zz = -af * sn + az * cs, xx = ax + hx * f * 0.6;
    const face = -f * cb + zz * sb;                                // how squarely it faces the camera (behind the ball: not drawn)
    if (face < 0.08) continue;
    const X = p.X + xx * r * 0.92, Y = p.Y - (f * sb + zz * cb) * r * 0.92;
    c.beginPath(); c.ellipse(X, Y, r * 0.15, r * 0.15 * Math.max(0.35, face), 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.lineWidth = Math.max(1.4, r * 0.13); c.strokeStyle = P.ink; c.beginPath(); c.arc(p.X, p.Y, r, 0, Math.PI * 2); c.stroke();
  c.restore();
}
// The streak of a flick from the ball: a finger's trail up the lane along the roll's line, as long as the roll is hard (u: 0 to 1 of it).
function drawFlick(c, G, aim, power, u, col) {
  const R = PHYSICS.lib.BOWL.ballR, b = bowlProject(G, BLANE.start[0], BLANE.start[1], R), a = bowlScreenAngle(G, aim);
  const k = ease(clamp01(u)), len = (95 + 170 * clamp01((power - BOWLG.powMin) / (1 - BOWLG.powMin))) * G.Hg / 420 * k, ex = b.X + Math.sin(a) * len, ey = b.Y - Math.cos(a) * len;
  c.save(); c.lineCap = 'round';
  const grad = c.createLinearGradient(b.X, b.Y, ex, ey); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, col);
  c.globalAlpha = 0.8 * (1 - Math.max(0, u - 0.75) / 0.25);
  c.beginPath(); c.moveTo(b.X, b.Y); c.lineTo(ex, ey); c.lineWidth = 11; c.strokeStyle = grad; c.stroke();
  c.beginPath(); c.arc(ex, ey, 10, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
  c.restore();
}
// Each player's rolls as score boxes on the board over the pins (X's on the left, O's on the right): their mark and
// their pins of the target, then a box a roll, oldest first: the roll on top (X a strike, - nothing) and the running
// total under it. An empty first box is there from the start. The roll just made fills in once the pins have settled
// (settled: the recording has played); until then the board shows what stood before it. Older boxes than fit are left
// off (their pins stay in the totals).
function drawFrames(c, G, mini, settled, P) {
  const frames = mini.frames || { X: [], O: [] }, l = mini.last, W = G.W, pad = 6, pw = (W - 3 * pad) / 2, top = 5, BH = 30, gap = 3;
  const bw = Math.max(20, Math.min(30, (pw - 4 * gap - 8) / 5)), fit = Math.max(1, Math.floor((pw - 8 + gap) / (bw + gap)));
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const p of ['X', 'O']) {
    let fs = frames[p].map(f => ({ r: f.r.slice(), strike: f.strike, total: f.total })), pins = mini.pins[p];
    if (!settled && l && l.by === p && fs.length) { pins -= l.knocked; fs.pop(); }   // the roll under way: not on the board yet
    if (!fs.length) fs = [{ r: [], total: 0, strike: false }];     // no roll yet: the first box, empty, so the board is there from the start
    const x0 = p === 'X' ? pad : pad * 2 + pw, y0 = top;
    rr(c, x0, y0, pw, 18 + BH + 8, 7); c.fillStyle = 'rgba(8,9,14,.62)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.14)'; c.stroke();
    c.font = '800 13px Nunito, Arial, sans-serif'; c.fillStyle = P[p]; c.textAlign = 'left';
    c.fillText(p, x0 + 8, y0 + 11);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.fillText(`${Math.min(pins, 999)}/${bowlTarget(mini)}`, x0 + pw - 8, y0 + 11);
    c.textAlign = 'center';
    const shown = fs.slice(Math.max(0, fs.length - fit));
    let run = 0, x = x0 + 4;
    for (const f of fs.slice(0, fs.length - shown.length)) run += f.total;   // (the earliest rolls, off the board: their pins stay in the total)
    for (const f of shown) {
      run += f.total;
      rr(c, x, y0 + 20, bw, BH, 4); c.fillStyle = 'rgba(255,255,255,.94)'; c.fill();
      if (f.r.length) {
        const sym = f.strike ? 'X' : f.r[0] === 0 ? '-' : String(f.r[0]);
        c.fillStyle = f.strike ? P.X : P.ink; c.font = '800 12px Nunito, Arial, sans-serif'; c.fillText(sym, x + bw / 2, y0 + 20 + 8.5);
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 3, y0 + 20 + 15, bw - 6, 1);
        c.fillStyle = P.ink; c.font = '700 11px Nunito, Arial, sans-serif'; c.fillText(String(run), x + bw / 2, y0 + 20 + 23);
      }
      x += bw + gap;
    }
  }
  c.restore();
}
// One drawing of the lane as it is now (ui/physics.js physDrawNow, after every render and every frame while a roll
// plays). pos: where the ball and the pins are (the recording's frame, or the square as it stands); o: { ph (the roll
// playing: its recording), el (s into it, as it plays), flash (it is the move's own flash: the sweep follows it),
// settled (the boxes take the roll), by (whose ball), still (nothing in hand: a finished square, a review), now }.
// Returns true while something of its own is still moving (the sweep, a flick's streak).
export function drawBowl(g, mini, pos, o = {}) {
  const c = g.c, P = runColours(), L = PHYSICS.lib, S = L.BOWL, G = geomFor(g.W, g.H), ph = o.ph || null, el = o.el;
  const lay = laneLayer(G);
  if (lay) c.drawImage(lay, 0, 0, G.W, G.H); else drawLane(c, G);
  const col = o.by === 'O' ? P.O : P.X, fx = ph && ph.rec && !REDUCED ? rollFx(ph) : null;
  const ts = fx && o.flash ? el * 1000 - ph.ms : -1;              // ms into the sweep (after the recording)
  const barY = ts < 0 ? null : 66 - 70 * ease(clamp01((ts - 90) / (BOWL_SWEEP - 190)));   // the sweep bar's place down the deck
  const lift = ts < 0 ? 0 : 6 * (ease(clamp01((ts - 20) / 90)) - ease(clamp01((ts - (BOWL_SWEEP - 90)) / 90)));   // the standing pins, lifted clear of it
  const items = [];                                                // what stands on the lane, drawn far to near: { d (its y), draw }
  S.pins.forEach((spot, k) => {
    const f = fx ? fx.pins[k] : null;
    let p = pos['p' + k], q = { z: 0 };
    if (ph && !fx && ph.down && ph.down[k]) return;               // (reduced motion: the roll's end at once, the fallen pins swept)
    if (f && f.gone != null && el >= f.gone) {                     // past the end of the lane: it drops into the pit
      const t = el - f.gone;
      if (t > 0.16) return;
      p = [f.last[0] + f.vel[0] * t, f.last[1] + f.vel[1] * t]; q = { tip: Math.PI / 2 - 0.05, dir: f.dir, z: -140 * t * t, a: 1 - t / 0.16 };
    } else if (!p) return;
    else if (f && f.hit != null && el >= f.hit) {
      const t = el - f.hit;
      if (f.down) {                                                // sent off its spot: it hops, tips over the way it was sent, and lies turning a little as it slides
        const T = Math.max(0.15, Math.min(0.32, 0.34 - f.v / 900)), u = clamp01(t / T), a0 = Math.atan2(f.dir[0], -f.dir[1]) + ((k * 37) % 7 - 3) * 0.22 * clamp01(t / 0.7);
        const tip = (Math.PI / 2 - 0.05) * Math.pow(u, 1.6), h = Math.max(0.6, Math.min(5, f.v / 36)), hu = clamp01(t / 0.3);
        q = { tip, dir: [Math.sin(a0), -Math.cos(a0)], z: h * 4 * hu * (1 - hu) };
        p = [p[0] - q.dir[0] * PIN_H * 0.42 * Math.sin(tip), p[1] - q.dir[1] * PIN_H * 0.42 * Math.sin(tip)];   // (the recording's place is its middle: lying, it lies about it)
        if (barY != null) { if (p[1] > barY - 3) p = [p[0], barY - 3]; if (p[1] < 1) { q.z = -8 * clamp01((1 - p[1]) / 6); q.a = clamp01(1 - (1 - p[1]) / 6); } }   // the sweep takes it back into the pit
      } else q = { tip: 0.17 * Math.sin(t * 24) * Math.exp(-t * 6), dir: f.dir, z: 0 };   // only nudged: it rocks and stands
    }
    if (!(f && f.down) && lift) q.z = (q.z || 0) + lift;
    p = [Math.max(2.5, Math.min(BLANE.w - 2.5, p[0])), p[1]];   // (a pin sent off the side lies against the wall beside the deck, never through it)
    const lying = (q.tip || 0) > 0.5;
    if (q.z > -1 && (q.a == null || q.a > 0.5)) { const e = ellipseAt(G, p[0] + (lying ? q.dir[0] * PIN_H * 0.4 : 0.5), p[1] + (lying ? q.dir[1] * PIN_H * 0.4 : 0.3), 0, lying ? 3.4 : 2.5); c.fillStyle = `rgba(0,0,0,${lift ? 0.12 : 0.2})`; c.beginPath(); c.ellipse(e.X, e.Y, e.rx * (lying ? 1.5 : 1), e.ry, 0, 0, Math.PI * 2); c.fill(); }
    items.push({ d: p[1] - (q.z > 2 ? 0.01 : 0), draw: () => drawPin(c, G, p[0], p[1], q, P) });
  });
  let ball = pos.ball ? { x: pos.ball[0], y: pos.ball[1], z: 0 } : null;
  if (fx) {
    const b = fx.ball, k = Math.max(0, Math.min(fx.n - 1, el * fx.fps)), i = Math.floor(k), d = b.dist[i] + ((b.dist[Math.min(fx.n - 1, i + 1)] || b.dist[i]) - b.dist[i]) * (k - i);
    if (ball) { const sp = Math.hypot(b.vel[0], b.vel[1]) || 1; ball.roll = d / S.ballR; ball.head = ph.aim != null ? [Math.sin(ph.aim), -Math.cos(ph.aim)] : [b.vel[0] / sp, b.vel[1] / sp]; }
    else if (b.gone != null && el >= b.gone) {                     // off the lane: down the gutter to the pit, or over the end into it
      const t = el - b.gone, sp = Math.max(40, Math.hypot(b.vel[0], b.vel[1]));
      if (b.how === 'gutter') {
        const gx = b.last[0] < 50 ? BLANE.gutter / 2 : BLANE.w - BLANE.gutter / 2, y = b.last[1] - sp * t, into = clamp01(t / 0.08);
        if (y > -6) ball = { x: b.last[0] + (gx - b.last[0]) * into, y, z: -1.6 * into - (y < 0 ? 10 * clamp01(-y / 6) : 0), a: y < 0 ? clamp01(1 + y / 6) : 1, roll: (d + sp * t) / S.ballR, head: [0, -1] };
      } else if (t < 0.2) ball = { x: b.last[0] + b.vel[0] * t, y: b.last[1] + b.vel[1] * t, z: -110 * t * t, a: 1 - t / 0.2, roll: (d + sp * t) / S.ballR, head: [0, -1] };
    }
  }
  if (ball) items.push({ d: ball.y, draw: () => drawBall(c, G, ball.x, ball.y, ball, col, P) });
  if (barY != null && ts < BOWL_SWEEP) {                           // the sweep: a bar across the deck, down, back to the pit, and away
    const a = Math.min(clamp01(ts / 70), clamp01((BOWL_SWEEP - ts) / 70)), up = 14 * (1 - ease(clamp01(ts / 90)));
    items.push({ d: barY, draw: () => { c.save(); c.globalAlpha = a; quad(c, G, [[5, barY, up + 0.5], [95, barY, up + 0.5], [95, barY, up + 6.5], [5, barY, up + 6.5]]); c.fillStyle = '#3a3e4b'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = P.ink; c.stroke(); quad(c, G, [[5, barY, up + 6.5], [95, barY, up + 6.5], [95, barY - 3, up + 6.5], [5, barY - 3, up + 6.5]]); c.fillStyle = '#565b6b'; c.fill(); c.restore(); } });
  }
  items.sort((a, b) => a.d - b.d).forEach(i => i.draw());
  let more = ts >= 0 && ts < BOWL_SWEEP + 40;
  if (fx && fx.ball.gone != null && el < fx.ball.gone + 0.6) more = true;
  const r = bowlRep;
  if (r && (ph || r.sq !== state.zoom || o.now - r.at > 5000)) { if (ph) r.rolled = true; if (r.rolled || r.sq !== state.zoom || o.now - r.at > 5000) bowlRep = null; }   // their roll is playing (or the replay is gone): no streak
  else if (r) { drawFlick(c, G, r.aim, r.power, (o.now - r.at) * r.speed / STREAK_MS, r.p === 'O' ? P.O : P.X); more = true; }   // (held at its full length until the roll)
  drawFrames(c, G, mini, o.settled !== false, P);
  return more;
}

// ---- the miniature ----
// The rack as the last roll left it (ten little pins in their triangle, the ones it knocked faint) and a line each:
// the player's mark, their pins as a bar to the target, and the count.
const TPIN = 'M-2.3 0C-3.9-4.2-3.7-7.4-1.7-10.2C-1-11.2-1.3-12.2-1.6-13.2A2 2 0 1 1 1.6-13.2C1.3-12.2 1-11.2 1.7-10.2C3.7-7.4 3.9-4.2 2.3 0Z';
const TROWS = [[[50, 54, 1.25]], [[41, 43, 1.1], [59, 43, 1.1]], [[33, 33, 0.97], [50, 33, 0.97], [67, 33, 0.97]], [[26, 24, 0.85], [42, 24, 0.85], [58, 24, 0.85], [74, 24, 0.85]]];   // (the head pin nearest, as the bowler sees them)
export function miniature(mini, final) {
  const L = PHYSICS.lib;
  if (!L) return physThumb(mini);
  const l = mini.last, goal = bowlTarget(mini), spots = TROWS.flat();
  const pin = k => { const [x, y, s] = spots[k]; return `<g class="pin${l && l.down[k] ? ' down' : ''}" transform="translate(${x} ${y}) scale(${s})"><path d="${TPIN}"/><path class="ps" d="M-1.2-11.4H1.2"/></g>`; };
  return `<div class="tbowl" aria-label="Bowling: X has ${mini.pins.X} pins, O has ${mini.pins.O} of ${goal}"><svg viewBox="14 4 72 52" aria-hidden="true">
    ${[6, 7, 8, 9, 3, 4, 5, 1, 2, 0].map(pin).join('')}</svg>
    <div class="trun bscore">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, mini.pins[p] / goal)).toFixed(1)}%"></i><span>${Math.min(goal, mini.pins[p])}</span></div>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = physTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return physResult(f, true).text;
}
// The roll's own sounds, from its recording's events at their moments (ui/physics.js physEventSounds): the ball's
// rumble down the lane (played faster for a faster ball: its pitch and its length go with the speed), its crash into
// the rack (bowlHit: the result landing; a full rack going over adds bowlCrash), the pins clattering against each
// other after it (pinHit, the first few), what drops into the pit (bowlPit), and a ball into the gutter (bowlGutter).
export function bowlEventSounds(ph, add) {
  const ev = ph.events || [], first = ev.find(e => e.k === 'pin' || e.k === 'gutter' || e.k === 'end');
  const t1 = first ? Math.max(0.25, first.t) : Math.max(0.4, ph.ms / 1000);
  add('bowlRoll', 0, Math.max(0.7, Math.min(2.2, 1.15 / t1)));
  let pinsN = 0, pits = 0, lastPit = -1;
  for (const e of ev) {
    const t = e.t * 1000;
    if (e.k === 'pin') { if (!pinsN) { add('bowlHit', t); if ((ph.knocked || 0) >= 8) add('bowlCrash', t + 30); } else if (pinsN <= 7) add('pinHit', t); pinsN++; }
    else if (e.k === 'gutter' && e.id === 'ball') add(ph.gutter ? 'bowlGutter' : 'bowlPit', t);
    else if (e.k === 'end') add('bowlPit', t, 0.8);
    else if (e.k === 'pit' && pits < 3 && t - lastPit > 110) { add('bowlPit', t, 1.25); pits++; lastPit = t; }
  }
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  // A flick up from anywhere on the game area (the lane and the line under it), not only the ball. The swipe's
  // direction aims, its speed is the power; nothing is drawn while it is under way. Letting go rolls at once, as does
  // the finger leaving the lane's top; a short or sideways swipe is nothing.
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.phys.bowllive');
    if (!area || drag || state.screen !== 'mini' || state.flash || state.done || blocked() || !physicsReady() || physPendOn()) return;
    ownPress();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, area, pts: [[performance.now(), e.clientX, e.clientY]] };
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    e.preventDefault();
  });
  app.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag, now = performance.now();
    d.pts.push([now, e.clientX, e.clientY]);
    while (d.pts.length > 2 && now - d.pts[1][0] > 160) d.pts.shift();   // (the oldest sample kept is the last one at least 80 ms back: bowlRead)
    const cv = d.area.querySelector('canvas'), r = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
    if (r && (e.clientY < r.top || e.clientX < r.left - 8 || e.clientX > r.right + 8)) bowlRelease(e);   // the finger leaves the lane: the roll goes
  });
  app.addEventListener('pointerup', bowlRelease);
  app.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) drag = null; });
}
