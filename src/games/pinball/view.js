// Pinball: the screen, the miniature, the move's words and sounds, and the inputs.
import { fingAt } from '../shared/finger.js';
import { pinTableOf } from './rules.js';
import { PHYSICS } from '../shared/physics.js';
import { state } from '../../ui/app.js';
import { fingSounds, fingTable } from '../../ui/finger.js';
import { drawTimeBar, outlined, rr, runColours } from '../../ui/runner.js';
export { fingerMoveText as moveText } from '../../ui/finger.js';

// Pinball: the square's table in portrait, drawn with depth (reworked November 2026). What never moves is
// drawn once on a layer of its own and kept (the cabinet, the playfield and its printed art, the rails and
// the arch with their shadows, the slingshots' bodies): each frame copies it and draws only what changes
// over it (the lane lights, the targets, the bumpers, the slingshots' bands, the gate and the stop, the
// flippers, the plunger, the ball and its shadow), so the table holds 60 frames a second on a phone.
// v.table is the square's table (physics-sim.js pinTable); v.fx the moments things were last struck
// ({ bump: { i: at }, sling: { k: at }, shot: at, drain: at }, from the ball's own events: pinFx), v.vel the
// ball's speed (its streak), v.pull the plunger's pull (0..1).
const TAU = Math.PI * 2;
let pinLayer = null;                                              // { key, cv }: the still parts of the table last drawn
const pinGeo = (W, H, T) => { const k = Math.min(W / T.w, H / T.h), ox = (W - T.w * k) / 2, oy = (H - T.h * k) / 2; return { k, X: x => ox + x * k, Y: y => oy + y * k, ox, oy }; };
// What a ball's events did, kept by their moments for the drawing (a bumper's pop, a slingshot's kick, the launch).
export function pinFx(fx, events, now) {
  for (const e of events) {
    if (e.k === 'bump') fx.bump[e.i] = now;
    else if (e.k === 'sling') fx.sling[e.s] = now;
    else if (e.k === 'launch') { fx.shot = now; fx.power = e.p; }
    else if (e.k === 'save' || e.k === 'lane') fx.saved = e.k === 'save' ? now : fx.saved;
    else if (e.k === 'drain') fx.drain = now;
    else if (e.k === 'all') fx.all = now;
  }
  return fx;
}
export const pinFxNew = () => ({ bump: {}, sling: {}, shot: 0, power: 0, saved: 0, drain: 0, all: 0 });
function pinStill(c, W, H, TB, T, P) {
  const { k, X, Y, oy } = pinGeo(W, H, T), ink = Math.max(1.5, 1.1 * k), A = TB.arc, sh = 0.9 * k;
  c.fillStyle = '#1d1630'; c.fillRect(0, 0, W, H);
  const field = () => { c.beginPath(); c.moveTo(X(1), Y(T.h + 1.2)); c.lineTo(X(1), Y(A.cy)); c.arc(X(A.cx), Y(A.cy), A.r * k, Math.PI, TAU); c.lineTo(X(99), Y(T.h + 1.2)); c.closePath(); };
  field();
  const g = c.createLinearGradient(0, oy, 0, oy + T.h * k); g.addColorStop(0, '#43378a'); g.addColorStop(0.55, '#35508f'); g.addColorStop(1, '#2a7191');
  c.fillStyle = g; c.fill();
  c.save(); field(); c.clip();
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(X(TB.lane.wall), Y(A.cy - 12), (99 - TB.lane.wall) * k, (T.h - A.cy + 14) * k);   // the plunger lane, a shade darker
  c.fillStyle = 'rgba(8,6,20,.45)'; c.beginPath(); c.moveTo(X(1), Y(T.h + 2)); c.lineTo(X(1), Y(166)); c.lineTo(X(34), Y(T.h - 2)); c.lineTo(X(58), Y(T.h - 2)); c.lineTo(X(TB.lane.wall), Y(166)); c.lineTo(X(TB.lane.wall), Y(T.h + 2)); c.closePath(); c.fill();   // the apron round the drain
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = Math.max(1, 0.5 * k);
  for (const [x, y, r] of TB.bumpers) for (const m of [1.55, 2.0]) { c.beginPath(); c.arc(X(x), Y(y), r * m * k, 0, TAU); c.stroke(); }   // rings printed round the bumpers
  c.fillStyle = 'rgba(255,255,255,.09)';
  const chev = (x, y, up, s) => { const d = up ? -1 : 1; c.beginPath(); c.moveTo(X(x - s), Y(y - d * s * 0.6)); c.lineTo(X(x), Y(y + d * s * 0.6)); c.lineTo(X(x + s), Y(y - d * s * 0.6)); c.lineTo(X(x), Y(y + d * s * 0.1)); c.closePath(); c.fill(); };
  for (const y of [112, 118]) { chev(6, y - 14, true, 2.2); chev(2 * T.mid - 6, y - 14, true, 2.2); }   // arrows up the orbits
  for (const y of [118, 126, 134]) chev(T.mid, y, true, 2.6);                                      // and up the middle
  for (const s of [-1, 1]) { c.beginPath(); c.arc(X(T.mid + s * 14), Y(104), 1.3 * k, 0, TAU); c.fill(); c.beginPath(); c.arc(X(T.mid + s * 23), Y(110), 1.3 * k, 0, TAU); c.fill(); }
  c.restore();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const rails = (dx, dy, col, grow) => {                            // the arch and every rail (capsules: round ends)
    c.strokeStyle = col;
    c.lineWidth = A.t * k + grow; c.beginPath(); c.arc(X(A.cx) + dx, Y(A.cy) + dy, A.r * k, Math.PI, TAU); c.stroke();
    for (const [x1, y1, x2, y2, t] of TB.walls) { c.lineWidth = t * k + grow; c.beginPath(); c.moveTo(X(x1) + dx, Y(y1) + dy); c.lineTo(X(x2) + dx, Y(y2) + dy); c.stroke(); }
  };
  c.save(); field(); c.clip(); rails(sh, sh * 1.4, 'rgba(0,0,0,.28)', 2 * ink); c.restore();   // their shadows on the playfield
  rails(0, 0, P.ink, 2 * ink); rails(0, 0, P.paper, 0);
  c.strokeStyle = 'rgba(22,18,16,.16)'; c.lineWidth = Math.max(1, 0.45 * k);   // a groove down each rail
  for (const [x1, y1, x2, y2] of TB.walls.slice(TB.lower)) { c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); }
  for (const tri of TB.slings) {                                    // the slingshots' bodies (their bands are drawn each frame)
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); tri.forEach(([x, y], i) => (i ? c.lineTo(X(x) + sh, Y(y) + sh * 1.4) : c.moveTo(X(x) + sh, Y(y) + sh * 1.4))); c.closePath(); c.fill();
    c.beginPath(); tri.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath(); outlined(c, '#58a8cf', P.ink, ink * 1.4);
    const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    c.beginPath(); c.arc(X(mx), Y(my), 1.6 * k, 0, TAU); outlined(c, P.paper, P.ink, ink);
  }
  for (const tg of TB.targets) if (tg.spin) {                       // a sliding target's track
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(X(tg.spin.cx - tg.spin.r), Y(tg.spin.cy)); c.lineTo(X(tg.spin.cx + tg.spin.r), Y(tg.spin.cy)); c.stroke();
  }
  c.lineCap = 'butt'; c.lineJoin = 'miter';
}
function pinFlipper(c, x1, y1, x2, y2, rb, rt, fill, P, ink) {     // a flipper: tapered from its pivot to its tip
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.beginPath(); c.arc(x1, y1, rb, a + Math.PI / 2, a + Math.PI * 1.5); c.arc(x2, y2, rt, a - Math.PI / 2, a + Math.PI / 2); c.closePath();
  if (fill) outlined(c, fill, P.ink, ink * 1.4); else c.fill();
}
export function drawPin(c, W, H, v, now) {
  const P = runColours(), L = PHYSICS.lib, T = L.PIN, TB = v.table || L.pinTable(null), cfg = v.cfg || {}, F = TB.flip;
  const { k, X, Y } = pinGeo(W, H, T), fx = v.fx || pinFxNew();
  const col = v.p === 'O' ? P.O : P.X, ink = Math.max(1.5, 1.1 * k), ball = v.ball, bR = T.ballR, sh = 0.9 * k;
  const key = [W, H, TB.k, TB.size, TB.targets.map(t => t.name).join('|')].join(':');
  let drawn = false;
  try {                                                             // the still layer: drawn once for this table at this size, copied each frame
    const tr = c.getTransform ? c.getTransform() : null, dpr = tr ? tr.a : 1;
    if (!pinLayer || pinLayer.key !== key + ':' + dpr) {
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
      const lc = cv.getContext('2d'); lc.setTransform(dpr, 0, 0, dpr, 0, 0); pinStill(lc, W, H, TB, T, P);
      pinLayer = { key: key + ':' + dpr, cv };
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(pinLayer.cv, 0, 0); c.restore(); drawn = true;
  } catch (e) { /* no second canvas here: drawn straight on, below */ }
  if (!drawn) pinStill(c, W, H, TB, T, P);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const ln = TB.lane, pull = v.pull || 0, shotAge = fx.shot ? now - fx.shot : 1e9;
  for (let s = 0; s < 6; s++) {                                     // the lane's lights: they fill with the pull (the launch's strength), and run up the lane as the ball goes
    const y = 152 - s * 15, on = v.waiting ? pull > (s + 0.5) / 6.5 : shotAge < 420 && Math.abs(shotAge / 60 - s) < 1.2;
    c.fillStyle = on ? `hsl(${125 - s * 22} 85% 58%)` : 'rgba(255,255,255,.10)';
    c.beginPath(); c.moveTo(X(ln.serve[0] - 1.9), Y(y + 1.5)); c.lineTo(X(ln.serve[0]), Y(y - 1.5)); c.lineTo(X(ln.serve[0] + 1.9), Y(y + 1.5)); c.closePath(); c.fill();
  }
  if (fx.drain && now - fx.drain < 450) {                           // the ball lost: the apron round the drain flashes
    c.fillStyle = `rgba(229,67,42,${0.55 * (1 - (now - fx.drain) / 450)})`; c.beginPath(); c.moveTo(X(2.2), Y(T.h)); c.lineTo(X(2.2), Y(166)); c.lineTo(X(34), Y(T.h - 2)); c.lineTo(X(58), Y(T.h - 2)); c.lineTo(X(TB.lane.wall - 1.2), Y(166)); c.lineTo(X(TB.lane.wall - 1.2), Y(T.h)); c.closePath(); c.fill();
  }
  const allAge = fx.all ? now - fx.all : 1e9, party = allAge < 900 ? 0.5 + 0.5 * Math.sin(allAge / 45) : 0;   // every target lit: the lights dance
  const fresh = v.flash && now - v.flash.at < 600 ? v.flash : null;
  for (const tg of TB.targets) {                                    // the targets: a rollover is a light in the playfield, a standup a round post; lit ones in the player's colour, glowing
    const [x, y] = tg.spin ? L.pinSpinAt(tg, v.t || 0, cfg) : [tg.x, tg.y], lit = !!(v.lit && v.lit[tg.id]), isNew = fresh && fresh.id === tg.id, age = isNew ? (now - fresh.at) / 600 : 1;
    const r = (tg.kind === 'roll' ? Math.min(tg.r, 3.3) : tg.r) * k;
    if (lit) { c.fillStyle = v.p === 'O' ? `rgba(246,194,27,${0.28 + 0.4 * party})` : `rgba(255,120,90,${0.3 + 0.4 * party})`; c.beginPath(); c.arc(X(x), Y(y), r * (1.7 + 0.8 * party), 0, TAU); c.fill(); }
    if (isNew) { c.strokeStyle = `rgba(255,255,255,${(1 - age) * 0.9})`; c.lineWidth = Math.max(2, 0.9 * k); c.beginPath(); c.arc(X(x), Y(y), r * (1.2 + 2.2 * age), 0, TAU); c.stroke(); }
    if (tg.kind === 'roll') {
      c.beginPath(); c.arc(X(x), Y(y), r, 0, TAU); c.fillStyle = lit ? col : 'rgba(10,8,26,.55)'; c.fill();
      c.lineWidth = Math.max(1.5, 0.55 * k); c.strokeStyle = lit ? P.paper : 'rgba(255,255,255,.55)'; c.stroke();
      c.fillStyle = lit ? P.paper : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(X(x), Y(y), r * 0.32, 0, TAU); c.fill();
    } else {
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.arc(X(x) + sh, Y(y) + sh * 1.4, r, 0, TAU); c.fill();
      c.beginPath(); c.arc(X(x), Y(y), r, 0, TAU); outlined(c, lit ? col : P.paper, P.ink, ink * 1.4);
      c.beginPath(); c.arc(X(x), Y(y), r * (lit ? 0.3 : 0.5), 0, TAU); c.fillStyle = lit ? P.paper : '#58a8cf'; c.fill();
      if (!lit) { c.lineWidth = Math.max(1, ink * 0.8); c.strokeStyle = P.ink; c.stroke(); }
    }
  }
  TB.slings.forEach((tri, i) => {                                   // the slingshots' bands: the long face bows out as it kicks
    const age = fx.sling[i] ? now - fx.sling[i] : 1e9, kick = age < 150 ? 1 - age / 150 : 0, [a, , b] = tri, mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), sg = (dy * ((a[0] + b[0]) / 2 - mx)) > 0 ? 1 : -1, nx = (sg * dy) / l, ny = (-sg * dx) / l, bow = (0.5 + 2.6 * kick) * k;
    c.strokeStyle = kick ? '#fff' : '#f3ecff'; c.lineWidth = Math.max(2, (0.9 + 0.6 * kick) * k);
    c.beginPath(); c.moveTo(X(a[0]), Y(a[1])); c.quadraticCurveTo(X((a[0] + b[0]) / 2) + nx * bow * 2, Y((a[1] + b[1]) / 2) + ny * bow * 2, X(b[0]), Y(b[1])); c.stroke();
  });
  TB.bumpers.forEach(([x, y, r], i) => {                            // the pop bumpers: they jump and flash as they kick
    const age = fx.bump[i] != null ? now - fx.bump[i] : 1e9, pop = age < 170 ? 1 - age / 170 : 0, rr2 = r * k * (1 + 0.16 * pop);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(X(x) + sh * 1.3, Y(y) + sh * 1.9, r * k, 0, TAU); c.fill();
    if (pop) { c.fillStyle = `rgba(255,240,170,${0.5 * pop})`; c.beginPath(); c.arc(X(x), Y(y), r * k * 1.9, 0, TAU); c.fill(); }
    c.beginPath(); c.arc(X(x), Y(y), rr2, 0, TAU); outlined(c, pop ? '#ffd84a' : '#4e9d3a', P.ink, ink * 1.4);
    c.beginPath(); c.arc(X(x), Y(y), rr2 * 0.62, 0, TAU); outlined(c, P.paper, P.ink, ink);
    c.fillStyle = pop ? '#ff8a2a' : P.X; c.beginPath(); for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (s * Math.PI) / 5, rs = (s % 2 ? 0.2 : 0.46) * rr2; c.lineTo(X(x) + Math.cos(a) * rs, Y(y) + Math.sin(a) * rs); } c.closePath(); c.fill();
  });
  const flap = (seg, swing) => {                                    // the one-way gate and stop: thin steel flaps, hinged on the arch (the gate swings as the launch goes through it)
    const [x1, y1, x2, y2, t] = seg, len = Math.hypot(x2 - x1, y2 - y1), gate = seg === TB.gate, hx = gate ? x2 : x1, hy = gate ? y2 : y1, a = Math.atan2((gate ? y1 : y2) - hy, (gate ? x1 : x2) - hx) + swing;
    c.strokeStyle = P.ink; c.lineWidth = t * k * 0.7 + 2 * ink * 0.7; c.beginPath(); c.moveTo(X(hx), Y(hy)); c.lineTo(X(hx + Math.cos(a) * len), Y(hy + Math.sin(a) * len)); c.stroke();
    c.strokeStyle = '#d9d2e8'; c.lineWidth = t * k * 0.7; c.stroke();
    c.beginPath(); c.arc(X(hx), Y(hy), 0.9 * k, 0, TAU); c.fillStyle = '#d9d2e8'; c.fill(); c.lineWidth = ink * 0.8; c.strokeStyle = P.ink; c.stroke();
  };
  flap(TB.gate, shotAge > 300 && shotAge < 620 ? 0.7 * Math.sin(((shotAge - 300) / 320) * Math.PI) : 0);
  if (TB.stop) flap(TB.stop, 0);
  for (const side of ['L', 'R']) {                                  // the flippers, on their pivots, with their shadows
    const [x1, y1, x2, y2] = L.pinFlipLine(TB, side, v.flips[side === 'L' ? 0 : 1]);
    c.fillStyle = 'rgba(0,0,0,.32)'; pinFlipper(c, X(x1) + sh * 1.2, Y(y1) + sh * 2, X(x2) + sh * 1.2, Y(y2) + sh * 2, F.rb * k, F.rt * k, null, P, ink);
    pinFlipper(c, X(x1), Y(y1), X(x2), Y(y2), F.rb * k, F.rt * k, col, P, ink);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, 0.5 * k); c.beginPath(); c.moveTo(X(x1 + (x2 - x1) * 0.2), Y(y1 + (y2 - y1) * 0.2) - 0.5 * k); c.lineTo(X(x1 + (x2 - x1) * 0.8), Y(y1 + (y2 - y1) * 0.8) - 0.4 * k); c.stroke();
    c.beginPath(); c.arc(X(x1), Y(y1), 1.1 * k, 0, TAU); outlined(c, P.paper, P.ink, ink);
  }
  const spring = shotAge < 160 ? -3.2 * Math.sin((shotAge / 160) * Math.PI) : 0, py = ln.serve[1] + bR + 0.6 + pull * 8 + spring;   // the plunger: pulled down with the finger, sprung up through the launch
  c.fillStyle = '#b8b2c8'; c.fillRect(X(ln.serve[0] - 0.6), Y(py), 1.2 * k, Y(T.h) - Y(py));
  c.strokeStyle = P.ink; c.lineWidth = 1.5; c.beginPath(); for (let s = 0; s <= 6; s++) { const yy = py + 2 + s * ((T.h - py - 3) / 6); c.lineTo(X(ln.serve[0] + (s % 2 ? 1.7 : -1.7)), Y(yy)); } c.stroke();
  rr(c, X(ln.serve[0] - 2.4), Y(py), 4.8 * k, 2 * k, 0.8 * k); outlined(c, P.X, P.ink, ink);
  if (ball) {                                                       // the ball: steel, with a shine, a shadow under it and a streak behind it when it flies
    const bx = X(ball[0]), by = Y(ball[1]) + (v.waiting ? pull * 8 * k : 0), R = bR * k, vel = v.vel, sp = vel ? Math.hypot(vel[0], vel[1]) : 0;
    if (sp > 170) { const n = Math.min(1, (sp - 170) / 250), tx = (-vel[0] / sp) * R * (1.2 + 2.2 * n), ty = (-vel[1] / sp) * R * (1.2 + 2.2 * n); for (let s = 1; s <= 3; s++) { c.fillStyle = `rgba(255,255,255,${0.16 * n * (1 - s / 4)})`; c.beginPath(); c.arc(bx + (tx * s) / 3, by + (ty * s) / 3, R * (1 - s * 0.13), 0, TAU); c.fill(); } }
    c.fillStyle = 'rgba(0,0,0,.34)'; c.beginPath(); c.ellipse(bx + sh * 1.4, by + sh * 2.1, R * 1.02, R * 0.92, 0, 0, TAU); c.fill();
    const bg = c.createRadialGradient(bx - R * 0.35, by - R * 0.4, R * 0.08, bx, by, R); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.45, '#d3d7e0'); bg.addColorStop(1, '#7b8192');
    c.beginPath(); c.arc(bx, by, R, 0, TAU); c.fillStyle = bg; c.fill(); c.lineWidth = ink; c.strokeStyle = P.ink; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(bx - R * 0.38, by - R * 0.42, R * 0.26, R * 0.16, -0.6, 0, TAU); c.fill();
  }
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  const saved = v.saved || fx.saved;
  if (saved && now - saved < 1200) { c.font = `400 ${Math.max(16, Math.round(6 * k))}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 3; c.strokeText('Ball saved!', X(T.mid), Y(120)); c.fillText('Ball saved!', X(T.mid), Y(120)); }
  if (!v.still && !v.end && TB.maxSecs) drawTimeBar(c, W, H, 1 - (v.t || 0) / TB.maxSecs, P);   // the ball's time limit (the attempt's own clock: live, or the replay's)
}
// The miniature: the table small (its top arch, its bumpers, the flippers) with the square's targets on it, each
// in the colour of who has lit it (both halves when both have), and beside it each player's count (of the seven: the
// targets on the table show how many).
export function miniature(mini, final) {
  const n = mini.lit.X.length, TB = pinTableOf(mini);
  const spots = TB && Array.isArray(TB.targets) && TB.targets.length === n ? TB.targets.map(t => [t.x, t.y]) : Array.from({ length: n }, (_, k) => { const a = Math.PI * (0.15 + 0.7 * k / Math.max(1, n - 1)); return [50 + 34 * Math.cos(a), 78 - 44 * Math.sin(a)]; });   // (without the physics: an arc)
  const tg = spots.map(([x, y], k) => {
    const lx = !!mini.lit.X[k], lo = !!mini.lit.O[k], r = 6.5;
    if (lx && lo) return `<path class="tgX" d="M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}Z"/><path class="tgO" d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z"/><circle class="tgh" cx="${x}" cy="${y}" r="${r}" fill="none"/>`;
    return `<circle class="${lx ? 'tgX tgh' : lo ? 'tgO tgh' : 'tg0'}" cx="${x}" cy="${y}" r="${r}"/>`;
  }).join('');
  const bumps = (TB && TB.bumpers ? TB.bumpers : [[36, 45], [56, 45], [46, 59]]).map(([x, y]) => `<circle class="tbp" cx="${x}" cy="${y}" r="5"/>`).join('');
  const art = `<svg viewBox="-2 -2 104 184" aria-hidden="true"><path class="tbl" d="M2 51A48 48 0 0 1 98 51V178H2Z"/>${bumps}${tg}<path class="tfl" d="M22 165l18.6 9.7M70 165l-18.6 9.7"/></svg>`;
  const pts = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span>${fingAt(mini, p)}</span></div>`).join('');
  return `<div class="tart tall" aria-label="Pinball: X has lit ${fingAt(mini, 'X')}, O ${fingAt(mini, 'O')} of ${n}"><div class="tpic tpin">${art}</div><div class="tbpts">${pts}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = fingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function sounds(f, add, won, mini, last) {
  fingSounds(f, add); return;   // someone else's attempt as it replays (its bounces, catches, flips), then the result
}
