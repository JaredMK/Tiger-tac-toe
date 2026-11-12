// Bowling: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { PHYSICS, physicsReady } from '../shared/physics.js';
import { BOWLG, BLANE, BOWL_PHASES, bowlGeom, bowlMeter, bowlMeterU, bowlPath, bowlPeriods, bowlProject, bowlShot, bowlTarget, bowlWave } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, state } from '../../ui/app.js';
import { physPaint, physPendOn, physResult, physTable, physThumb } from '../../ui/physics.js';
import { rep, repDue, repNote } from '../../ui/replay.js';
import { rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

// Bowling (reworked November 2026, to Cup Pong's standard; the three sweeps from November 2026): the lane drawn on the
// canvas in perspective (rules.js bowlGeom: the camera behind the bowler, the pins small at the far end, the ball big in
// the hand). A roll is three taps anywhere on the game area, each stopping a meter that sweeps back and forth (rules.js
// bowlWave, the square's periods): the aim (a marker across the lane in front of the pins, on the line from the ball),
// then the curve (a meter under the ball, left to right: the guide line bends with it as the hook will), then the power
// (a meter beside the lane, filling up); each stops exactly where it was tapped, with a tick, and stays shown, and the
// ball leaves on the frame of the third tap. The active meter is in the mover's colour. The roll is the physics'
// recording (the same on both phones and the server), played from the move's event (ui/physics.js): the ball rolls away
// shrinking and hooks late, its finger holes turning with it, a shadow under it; a pin knocked off its spot topples over
// the way it was sent, a pin only nudged rocks and stands; what passes the end of the lane drops into the pit; a ball in
// the gutter runs on down it. Once everything has settled the sweep comes down (BOWL_SWEEP ms, inside the move's hold).
// Someone else's roll shows their three meters first, each sweeping and stopping exactly where they tapped (the shared
// replay's inputs: replay.input/synth), then the roll. The result's words go in the reserved line under the lane; each
// player's rolls are score boxes on the board over the pins.
export const BOWL_SWEEP = 420;                 // the sweep after a roll, ms (within BOWLG.hold and the result's hold)
const PIN_H = 13.5, METER_FADE = 0.45;        // a pin's height in lane units; the meters' fade as the roll begins (s)
let live = null;                               // this phone's three taps: { key, k (the meter sweeping: 0 aim, 1 curve, 2 power, 3 rolled), t0 (when it began), v: [values] }
let bowlRep = null;                            // someone else's taps replayed by the shared system's inputs stage (ui/replay.js): { sq, p, v: [values], at: [when each was pressed here], speed }
export const bowlRepOn = () => bowlRep;        // (the tests look)
export const bowlLiveOn = () => live;
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

// ---- the three taps ----
const liveKey = () => `${state.zoom}:${state.moves}:${state.turn}`;
const periodsOf = mini => bowlPeriods(tune(mini));
// A tap (the press itself, anywhere on the game area): stops the meter sweeping, and the third rolls.
function bowlTap() {
  const sq = state.squares && state.squares[state.zoom];
  if (state.screen !== 'mini' || !sq || sq.mini.type !== 'bowling' || sq.owner || state.flash || state.done || blocked() || !physicsReady() || physPendOn() || rep) return false;
  const now = performance.now(), key = liveKey();
  if (!live || live.key !== key) live = { key, k: 0, t0: now, v: [] };
  if (live.k > 2) return false;
  const k = live.k, val = bowlMeter(k, bowlWave(now - live.t0, periodsOf(sq.mini)[k], k));
  live.v[k] = val; live.k = k + 1; live.t0 = now;
  SND.play('mark'); haptic('tap');
  repNote('bowl', `${BOWL_PHASES[k]}=${val}`);
  if (live.k === 3) attemptMove(bowlShot({ aim: live.v[0], curve: live.v[1], power: live.v[2] }));   // the ball leaves on this frame (the move's flash here; online, the roll played at once: ui/physics.js physLaunch)
  physPaint();
  return true;
}

// ---- someone else's taps through the shared replay (ui/replay.js: its inputs stage, when it presses them) ----
// The log's inputs: `aim=..`, `curve=..`, `power=..`, at the moments they were tapped (an older client's flick,
// `aim=..|power=..`, is all three at once, no curve); the computer's are made from its move, each meter stopped on its
// first pass over the value after a human pause (BOWL_SYN).
const TAP = /^(aim|curve|power)=(-?[\d.]+)$/, FLICK = /^aim=(-?[\d.]+)\|power=(-?[\d.]+)$/;
function replayInput(act, val, r) {
  if (act !== 'bowl') return false;
  const f = FLICK.exec(val || ''), m = f ? null : TAP.exec(val || '');
  if (!f && !m) return false;
  if (!bowlRep || bowlRep.sq !== r.sq || bowlRep.r !== r) bowlRep = { sq: r.sq, p: r.by, r, v: [], at: [], speed: r.speed || 1 };
  const now = performance.now();
  if (f) { bowlRep.v = [Number(f[1]), 0, Number(f[2])]; bowlRep.at = [now, now, now]; }
  else { const k = BOWL_PHASES.indexOf(m[1]); bowlRep.v[k] = Number(m[2]); bowlRep.at[k] = now; SND.play('mark'); }
  physPaint();
  return true;
}
// When a meter's wave first stands at u, at least `after` ms into its sweep (the first pass over it on either leg).
function waveTime(u, per, k, after) {
  const st = [0.25, 0.25, 0][k], fs = [u / 2, 1 - u / 2];
  let best = Infinity;
  for (const f of fs) for (let n = 0; n < 4; n++) { const t = (((f - st) % 1 + 1) % 1 + n) * per; if (t >= after && t < best) best = t; }
  return best;
}
const BOWL_SYN = [700, 380, 320];   // the computer's least pause before each tap (ms)
function replaySynth(m, mini) {
  const s = m && typeof m === 'object' ? bowlShot(m) : null;
  if (!s) return null;
  const per = periodsOf(mini), v = [s.aim, s.curve, s.power], out = [];
  let t = 0;
  for (let k = 0; k < 3; k++) { t += k ? Math.round(waveTime(bowlMeterU(k, v[k]), per[k], k, BOWL_SYN[k])) : BOWL_SYN[0]; out.push([t, 'bowl', `${BOWL_PHASES[k]}=${v[k]}`]); }
  return out;
}
export const replay = { input: replayInput, synth: replaySynth };
// The meters as they are this instant: { k (the one sweeping, 3 once all are stopped), u: [0..1 each], by } for this
// phone's own taps (its turn, nothing playing), someone else's replayed ones, or null.
function metersNow(mini, now, mine) {
  const per = periodsOf(mini);
  const r = rep && rep.sq === state.zoom && rep.type === 'bowling' && rep.stage === 'inputs' ? rep : null;
  if (r) {
    const b = bowlRep && bowlRep.r === r ? bowlRep : null, list = (r.list || []).filter(e => e[1] === 'bowl'), u = [], v = b ? b.v : [];
    let k = 0;
    while (k < 3 && v[k] != null) { u[k] = bowlMeterU(k, v[k]); k++; }
    if (k < 3) {
      if (k === 0) {                                               // the first: timed back from its tap, so it stands on their value as it comes due
        const e = list[0], tv = e ? TAP.exec(e[2] || '') : null;
        if (tv && tv[1] === 'aim') { const uu = bowlMeterU(0, Number(tv[2])), due = repDue(r, e), lead = waveTime(uu, per[0], 0, 0); u[0] = bowlWave((now - due) * r.speed + lead, per[0], 0); }
        else u[0] = bowlWave((now - r.at) * r.speed, per[0], 0);
      } else u[k] = bowlWave((now - b.at[k - 1]) * b.speed, per[k], k);   // the next: from their last tap, as it swept for them
    }
    return { k, u, by: r.by };
  }
  if (!mine) { live = null; return null; }
  const key = liveKey();
  if (!live || live.key !== key) live = { key, k: 0, t0: now, v: [] };
  const u = live.v.map((x, k) => bowlMeterU(k, x));
  if (live.k < 3) u[live.k] = bowlWave(now - live.t0, per[live.k], live.k);
  return { k: live.k, u, by: state.turn };
}
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
// The three meters (M: metersNow, or the roll's own as it begins; a: their opacity). The guide line from the ball: straight
// along the aim while it sweeps, then bent as the curve will bend it (rules.js bowlPath), with the aim's marker where it
// comes to the head pin's row; the curve's meter under the ball (left to right, its middle straight); the power's beside
// the lane (filling up). The one sweeping is in the mover's colour and glows; a stopped one is white, held where it stopped.
const MLAB = ['AIM', 'CURVE', 'POWER'];
function drawMeters(c, G, M, mini, P, a) {
  if (!M || a <= 0) return;
  const col = M.by === 'O' ? P.O : P.X, R = PHYSICS.lib.BOWL.ballR, hook = Number.isFinite(tune(mini).hook) ? tune(mini).hook / 1000 : undefined;
  const on = k => M.k === k, val = k => (M.u[k] == null ? null : bowlMeter(k, M.u[k])), colOf = k => (on(k) ? col : k < M.k ? '#ffffff' : 'rgba(255,255,255,.35)');
  const B = bowlProject(G, BLANE.start[0], BLANE.start[1], R), rB = R * B.s, unit = Math.max(1, G.W / 360);
  c.save(); c.globalAlpha = a; c.lineCap = 'round'; c.lineJoin = 'round';
  // the guide line and the aim's marker
  const aim = val(0), curve = M.k >= 1 && M.u[1] != null ? val(1) : 0;
  if (aim != null) {
    const pts = bowlPath(aim, curve, hook).filter(([, y]) => y >= 52), proj = pts.map(([x, y]) => bowlProject(G, x, y, 0.2));
    c.setLineDash([]);
    for (let i = 4; i < proj.length - 1; i += 6) {                 // dots down the way, smaller with distance
      const q = proj[i]; c.beginPath(); c.arc(q.X, q.Y, Math.max(1.3, 0.75 * q.s), 0, Math.PI * 2);
      c.fillStyle = M.k <= 1 ? (on(0) ? col : on(1) ? col : '#fff') : 'rgba(255,255,255,.85)'; c.fill();
    }
    const end = pts[pts.length - 1] || BLANE.start, E = bowlProject(G, end[0], end[1], 0), rx = Math.max(7, 3.2 * E.s), ry = rx * 0.45;
    c.beginPath(); c.ellipse(E.X, E.Y, rx, ry, 0, 0, Math.PI * 2); c.lineWidth = 3 * unit; c.strokeStyle = P.ink; c.stroke();
    c.lineWidth = 2 * unit; c.strokeStyle = colOf(0); c.stroke();
    if (on(0)) { c.beginPath(); c.ellipse(E.X, E.Y, rx * 0.35, ry * 0.35, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
  }
  // the curve's meter, under the ball
  const cw = Math.min(G.W * 0.62, 260 * unit), ch = 10 * unit, cx0 = G.W / 2 - cw / 2, cy = Math.min(G.H - ch - 6 * unit, B.Y + rB + 8 * unit);
  meterBox(c, cx0, cy, cw, ch, on(1), col, P);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(G.W / 2 - 1, cy + 2, 2, ch - 4);   // (its middle: straight)
  for (const s of [-1, 1]) {                                        // a hooking arrow at each end
    const x = G.W / 2 + s * (cw / 2 + 11 * unit), y = cy + ch / 2;
    c.beginPath(); c.arc(x - s * 5 * unit, y + 4 * unit, 7 * unit, s < 0 ? -Math.PI / 2 : -Math.PI / 2, s < 0 ? -Math.PI : 0, s < 0); c.lineWidth = 2 * unit; c.strokeStyle = on(1) ? col : 'rgba(255,255,255,.45)'; c.stroke();
  }
  if (M.u[1] != null && M.k >= 1) needle(c, cx0 + M.u[1] * cw, cy, ch, on(1) ? col : '#fff', P, unit, 'h');
  label(c, MLAB[1], cx0, cy - 3 * unit, colOf(1), unit, 'left');
  // the power's meter, up the right side
  const pw = 11 * unit, ph = Math.min(G.H * 0.36, 190 * unit), px = G.W - pw - 7 * unit, py = cy - 14 * unit - ph;
  meterBox(c, px, py, pw, ph, on(2), col, P);
  if (M.u[2] != null && M.k >= 2) {
    const h = (ph - 4) * M.u[2];
    const gr = c.createLinearGradient(0, py + ph, 0, py); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, on(2) ? col : '#fff');
    c.fillStyle = gr; c.fillRect(px + 2, py + ph - 2 - h, pw - 4, h);
    needle(c, px, py + ph - 2 - h, pw, on(2) ? col : '#fff', P, unit, 'v');
  }
  label(c, MLAB[2], px + pw, py - 4 * unit, colOf(2), unit, 'right');
  label(c, MLAB[0], 8 * unit, py - 4 * unit, colOf(0), unit, 'left');
  c.restore();
}
function meterBox(c, x, y, w, h, active, col, P) {
  rr(c, x, y, w, h, Math.min(w, h) / 2); c.fillStyle = 'rgba(8,9,14,.62)'; c.fill();
  c.lineWidth = active ? 2.5 : 1.5; c.strokeStyle = active ? col : 'rgba(255,255,255,.3)'; c.stroke();
  if (active) { c.save(); c.shadowColor = col; c.shadowBlur = 10; c.stroke(); c.restore(); }
}
function needle(c, x, y, len, fill, P, unit, dir) {             // a marker across a meter at x (h: a meter lying down, len its height; v: standing, len its width)
  c.beginPath();
  if (dir === 'h') { const w = 4 * unit; c.moveTo(x - w, y - 5 * unit); c.lineTo(x + w, y - 5 * unit); c.lineTo(x + w * 0.6, y + len + 3 * unit); c.lineTo(x - w * 0.6, y + len + 3 * unit); c.closePath(); }
  else { const h = 3 * unit; c.rect(x - 4 * unit, y - h, len + 8 * unit, 2 * h); }
  c.fillStyle = fill; c.fill(); c.lineWidth = 1.5 * unit; c.strokeStyle = P.ink; c.stroke();
}
function label(c, t, x, y, fill, unit, align) {
  c.save(); c.font = `800 ${Math.round(10 * unit)}px Nunito, Arial, sans-serif`; c.textAlign = align; c.textBaseline = 'bottom';
  c.lineWidth = 3; c.strokeStyle = 'rgba(8,9,14,.8)'; c.strokeText(t, x, y); c.fillStyle = fill; c.fillText(t, x, y); c.restore();
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
  if (bowlRep && (ph || !rep || rep.sq !== state.zoom)) bowlRep = null;   // their roll is playing (or the replay is gone): its meters go with it
  const mine = !ph && !o.flash && !!(g.c.canvas && g.c.canvas.closest && g.c.canvas.closest('.phys.bowllive')) && !state.flash && !state.done;
  let M = ph ? null : metersNow(mini, o.now, mine), ma = 1;
  if (ph && el != null && el < METER_FADE && Number.isFinite(ph.aim) && !REDUCED) { M = { k: 3, u: [bowlMeterU(0, ph.aim), bowlMeterU(1, ph.curve || 0), bowlMeterU(2, ph.power)], by: o.by }; ma = 1 - el / METER_FADE; more = true; }   // the roll begins: its three stops, fading
  if (M) { drawMeters(c, G, M, mini, P, ma); if (M.k < 3) more = true; }
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
  // A tap anywhere on the game area (the lane and the line under it), from the press itself: the first stops the aim,
  // the second the curve, the third the power and rolls.
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.phys.bowllive');
    if (!area || state.screen !== 'mini') return;
    e.preventDefault(); ownPress();
    bowlTap();
  });
}
