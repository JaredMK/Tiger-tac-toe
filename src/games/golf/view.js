// Mini Golf: the screen, the miniature, the move's words and sounds, and the inputs.
import { randInt } from '../../core/random.js';
import { PHYSICS, physOpt } from '../shared/physics.js';
import { golfPhase, setGolfPick } from './rules.js';
import { REDUCED, state } from '../../ui/app.js';
import { physResult, physTable, physThumb } from '../../ui/physics.js';
export { physReplay as replay } from '../../ui/physics.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

// Mini Golf in a local game: a hole whose layout this device has not had lately (either way round), until
// most of them have come up; then it starts again (bar the last few). Online the server deals any hole.
const GOLF_SEEN = 'ttt-golf-seen';
setGolfPick((rng, holes) => {
  try { if (state && state.online) return null; } catch (e) { return null; }   // (the page's own first deal, while ui/app.js is still loading and its state is not there yet: any hole)
  const bases = [...new Set(holes.map(h => h.of))];
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(GOLF_SEEN) || '[]').filter(b => bases.includes(b)); } catch (e) { /* none kept */ }
  if (bases.length - new Set(seen).size <= Math.max(1, Math.floor(bases.length / 5))) seen = seen.slice(-3);   // most of them seen: round again
  const open = bases.filter(b => !seen.includes(b)), b = open[randInt(rng, open.length)];
  const forms = holes.map((h, i) => (h.of === b ? i : -1)).filter(i => i >= 0);
  seen.push(b);
  try { localStorage.setItem(GOLF_SEEN, JSON.stringify(seen)); } catch (e) { /* no storage: any hole */ }
  return forms[randInt(rng, forms.length)];
});

// The course (November 2026, the polish sweep; Pool's table is the pattern): seen from straight above, as a putt is
// lined up (the walls and the lines off them are true), its depth in the light: one lamp up and to the left, so the
// kerb shades the turf along the top and the left, every wall, post and ball has a soft shadow down and to the right.
// The course itself (the ground, the wooden kerb, the mown turf, the tee mat, the walls, the posts at rest, the cup) is
// painted once into a layer per hole and copied each frame; what moves (the balls, a post that kicks, the flag, the
// putter, the sight line) is drawn over it 60 times a second from the move's event (ui/physics.js physDrawNow).
// Red and yellow are the balls' alone: the posts and the flag are blue, the walls wood.
export const GOLF_KERB = 4;                                             // the kerb round the green, in course units (ui/physics.js keeps its room on every side)
export const GOLFV = {
  light: [0.26, 0.34],          // where a shadow falls, in ball radii across and down
  stroke: 0.05, follow: 0.13, fade: 0.2,   // the putter's stroke at the shot: up to the ball, on through it, gone (s)
  stick: 17, grip: 7, head: [7.4, 2.4], pull: 9,   // the putter: its shaft and grip as they lie seen from above, its head (across, deep), and how far a full pull draws it back (course units)
  bump: 0.3,                    // a post's pop as it kicks a ball off (s)
  knock: 0.18, knockMin: 9,     // a wall's knock: a ring off the ball (s), for a knock at this speed or more (units/s)
  hop: 0.3,                     // a lip-out: the ball hops over the rim and the rim flashes (s)
  drop: 0.26, burst: 0.55,      // a holed ball's roll down into the cup, then the sparks round it (s)
  near: 17, far: 7,             // the flag lifts out of the cup as a ball comes within near of it, clear by far (course units)
  flag: [15, 9, 6.4],           // the flag: its pole's height, the pennant's length and depth (course units)
  arrow: 10,                    // the aim: a short arrow off the ball, always this long (course units): where it points, never how far it goes
  splash: 0.55, back: 0.4,      // a ball into the water: the splash (s), then the ball back where its shot began, a ring as it reappears (s)
  puff: 0.35,                   // a ball into sand: a puff of grains (s)
};
const TERRV = { chev: 2.2 };    // a slope's chevrons, half their width (course units)
const COL = { ground: '#2c6e37', shrub: '#3b8d48', shrubHi: '#4fa659', wood: '#d09a58', woodLo: '#a56f38', turf: '#5fbf5a', mat: '#4ba24c', rim: '#eaf7df', hole: '#0e2413', post: '#58a8cf', postLo: '#3f8fbf', cap: '#fff8e8', hit: '#fff3b8', flag: '#3f8fbf', steel: '#dfe3e8', shaft: '#ecd29c', sand: '#efd99c', sandLo: '#c9a95e', water: '#1f6f9a', waterHi: '#4fb3cf', bank: '#b9b2a2', bankLo: '#9a9282', bankHi: '#d8d2c4', blade: '#f6efe0', bladeLo: '#d9534f' };
// The course's sizes before the physics library has loaded (nothing is drawn of a hole until then: its walls are the library's).
const GOLF_SIZE = { w: 100, h: 160, ballR: 2.4, cupR: 3.6, vMax: 95, air: 0.004, roll: 12 };
const sizes = () => (PHYSICS.lib && PHYSICS.lib.GOLF) || GOLF_SIZE;
const clamp01 = u => Math.max(0, Math.min(1, u));
const smooth = u => { u = clamp01(u); return u * u * (3 - 2 * u); };

// ---- the terrain (December 2026: a square dealt with it, its switches on; physics-sim.js golfTerrain) ----
// A hole's terrain as this square has it: { slopes, sand, water, mills, phase } (null: none).
export function golfTerrainOf(mini) {
  const L = PHYSICS.lib, o = mini && mini.type === 'golf' ? physOpt(mini) : null;
  return L && L.golfTerrainOn && o && o.terrain ? L.golfTerrainOn(mini.hole, o.terrain) : null;
}
function paintTerrain(c, g, ter, P) {                             // under the tee, the walls and their shadows: the slopes, the sand, the water
  const k = g.k, X = g.X, Y = g.Y, ink = Math.max(1.5, 0.45 * k);
  for (const [x, y, r, gx, gy] of ter.slopes) {                    // a slope: lighter up its high side, darker down its low side, soft at its edge, chevrons down the fall
    const n = Math.hypot(gx, gy) || 1, ux = gx / n, uy = gy / n;
    c.save(); c.beginPath(); c.arc(X(x), Y(y), r * k, 0, Math.PI * 2); c.clip();
    const lg = c.createLinearGradient(X(x - ux * r), Y(y - uy * r), X(x + ux * r), Y(y + uy * r));
    lg.addColorStop(0, 'rgba(255,255,230,.26)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(10,40,10,.24)');
    c.fillStyle = lg; c.fillRect(X(x - r), Y(y - r), 2 * r * k, 2 * r * k);
    const edge = c.createRadialGradient(X(x), Y(y), r * k * 0.6, X(x), Y(y), r * k);
    edge.addColorStop(0, 'rgba(95,191,90,0)'); edge.addColorStop(1, 'rgba(95,191,90,.85)');
    c.fillStyle = edge; c.fillRect(X(x - r), Y(y - r), 2 * r * k, 2 * r * k);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(1.4, 0.42 * k); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [ax, ay] of [[0, 0], [-uy * r * 0.48, ux * r * 0.48], [uy * r * 0.48, -ux * r * 0.48]]) {
      const cx = x + ax, cy = y + ay, h = TERRV.chev;
      c.beginPath(); c.moveTo(X(cx - ux * h - uy * h), Y(cy - uy * h + ux * h)); c.lineTo(X(cx), Y(cy)); c.lineTo(X(cx - ux * h + uy * h), Y(cy - uy * h - ux * h)); c.stroke();
    }
    c.restore();
  }
  for (const [x, y, r] of ter.sand) {                              // sand: a bunker, its lip, raked grains
    c.beginPath(); c.arc(X(x), Y(y), r * k, 0, Math.PI * 2); outlined(c, COL.sand, P.ink, ink);
    c.beginPath(); c.arc(X(x) + 0.5 * k, Y(y) + 0.7 * k, r * k * 0.8, Math.PI * 1.05, Math.PI * 1.75); c.strokeStyle = COL.sandLo; c.lineWidth = Math.max(1, 0.5 * k); c.stroke();
    c.fillStyle = COL.sandLo;
    for (let i = 0; i < 14; i++) { const a = i * 2.39996, q = Math.sqrt((i + 0.5) / 14) * r * 0.82; c.beginPath(); c.arc(X(x + Math.cos(a) * q), Y(y + Math.sin(a) * q), Math.max(0.8, 0.28 * k), 0, Math.PI * 2); c.fill(); }
  }
  for (const [x, y, r] of ter.water) {                             // water: a pond, its stone bank, deeper in the middle, ripples
    c.beginPath(); c.arc(X(x), Y(y), (r + 1.7) * k, 0, Math.PI * 2); outlined(c, COL.bank, P.ink, ink);
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + (i % 2) * 0.12; c.beginPath(); c.ellipse(X(x + Math.cos(a) * (r + 0.85)), Y(y + Math.sin(a) * (r + 0.85)), 0.75 * k, 0.6 * k, a, 0, Math.PI * 2); c.fillStyle = i % 3 ? COL.bankLo : COL.bankHi; c.fill(); }   // the bank's stones
    const wg = c.createRadialGradient(X(x - r * 0.3), Y(y - r * 0.3), r * k * 0.1, X(x), Y(y), r * k);
    wg.addColorStop(0, COL.waterHi); wg.addColorStop(1, COL.water);
    c.beginPath(); c.arc(X(x), Y(y), r * k, 0, Math.PI * 2); c.fillStyle = wg; c.fill(); c.strokeStyle = P.ink; c.lineWidth = Math.max(1, 0.32 * k); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, 0.35 * k); c.lineCap = 'round';
    for (const [dx, dy, w] of [[-0.25, -0.2, 0.42], [0.2, 0.25, 0.3]]) { c.beginPath(); c.arc(X(x + dx * r), Y(y + dy * r), w * r * k, Math.PI * 1.15, Math.PI * 1.75); c.stroke(); }
  }
}
// A splash: rings out from where the ball went in, drops thrown up and falling back (u: 0..1 through it).
function splash(c, g, x, y, u, P) {
  const k = g.k, X = g.X(x), Y = g.Y(y), e = 1 - Math.pow(1 - u, 3);
  for (const [d, w] of [[0, 1], [0.18, 0.7]]) { const v = clamp01((u - d) / (1 - d)); if (v <= 0) continue; c.beginPath(); c.arc(X, Y, (2 + 7 * (1 - Math.pow(1 - v, 2))) * k, 0, Math.PI * 2); c.strokeStyle = `rgba(255,255,255,${(0.85 * (1 - v) * w).toFixed(3)})`; c.lineWidth = Math.max(1.5, 0.7 * k) * (1 - 0.5 * v); c.stroke(); }
  c.fillStyle = `rgba(200,235,255,${(0.95 * (1 - u)).toFixed(3)})`;
  for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + 0.2, q = (1.5 + 5.5 * e) * (j % 2 ? 1 : 0.75), hop = Math.sin(Math.PI * u) * 3 * (j % 2 ? 1 : 0.6); c.beginPath(); c.arc(X + Math.cos(a) * q * k, Y + (Math.sin(a) * q - hop) * k, Math.max(1.2, 0.55 * k), 0, Math.PI * 2); c.fill(); }
}
// A windmill at its angle: the shadow, its two sails (one bar) and its post. ang: radians.
function windmill(c, g, [x, y, L], ang, P, [sx, sy]) {
  const k = g.k, X = g.X(x), Y = g.Y(y), T = (PHYSICS.lib && PHYSICS.lib.TERR ? PHYSICS.lib.TERR.millT : 2.2) * k, H = (PHYSICS.lib && PHYSICS.lib.TERR ? PHYSICS.lib.TERR.hubR : 2) * k;
  const bars = off => { for (const a of [ang]) { c.save(); c.translate(X + off[0], Y + off[1]); c.rotate(a); rr(c, -L * k, -T / 2, 2 * L * k, T, T / 2); c.restore(); } };
  c.fillStyle = 'rgba(0,0,0,.24)'; bars([sx, sy]); c.fill();
  for (const a of [ang]) {
    c.save(); c.translate(X, Y); c.rotate(a); rr(c, -L * k, -T / 2, 2 * L * k, T, T / 2); outlined(c, COL.woodLo, P.ink, Math.max(1.5, 0.45 * k));   // the arm
    for (const s of [-1, 1]) {                                     // a sail at each end: cream, a red stripe, a little wider than the arm
      const x0 = s > 0 ? L * k * 0.36 : -L * k, w = L * k * 0.64, sw = T * 1.5;
      rr(c, x0, -sw / 2, w, sw, Math.min(2, sw / 3)); outlined(c, COL.blade, P.ink, Math.max(1.2, 0.38 * k));
      c.fillStyle = COL.bladeLo; c.fillRect(x0 + w * 0.15, -sw * 0.12, w * 0.7, sw * 0.24);
    }
    c.restore();
  }
  c.beginPath(); c.arc(X, Y, H, 0, Math.PI * 2); outlined(c, COL.wood, P.ink, Math.max(1.5, 0.45 * k));
  c.beginPath(); c.arc(X, Y, H * 0.35, 0, Math.PI * 2); c.fillStyle = P.ink; c.fill();
}

// ---- the course, painted once a hole ----
let layer = null;                                                 // { key, cv }: the course as painted for this hole on a canvas of this size
const shadowOff = k => [0.9 * k, 1.3 * k];                        // a wall's or a post's shadow on the turf (screen px)
function wallShape(c, g, [x, y, w, h, a], grow) {                 // a wall's outline (grow: this much bigger or smaller all round, in course units)
  const k = g.k, ca = Math.cos(a || 0), sa = Math.sin(a || 0), hw = w / 2 + grow, hh = h / 2 + grow, r = Math.max(0.2, 1 + grow), cx = g.X(x), cy = g.Y(y);
  const pt = (lx, ly) => [cx + (lx * ca - ly * sa) * k, cy + (lx * sa + ly * ca) * k];
  const P = [[-hw + r, -hh], [hw - r, -hh], [hw, -hh + r], [hw, hh - r], [hw - r, hh], [-hw + r, hh], [-hw, hh - r], [-hw, -hh + r]].map(q => pt(q[0], q[1]));
  const C = [[hw, -hh], [hw, hh], [-hw, hh], [-hw, -hh]].map(q => pt(q[0], q[1]));
  c.beginPath(); c.moveTo(P[0][0], P[0][1]);
  for (let i = 0; i < 4; i++) { const a1 = P[2 * i + 1], b1 = P[(2 * i + 2) % 8]; c.lineTo(a1[0], a1[1]); c.quadraticCurveTo(C[i][0], C[i][1], b1[0], b1[1]); }
  c.closePath();
}
function post(c, g, [x, y, r], P, s, hit) {                       // a post: a rubber ring, its cap, a stud (s: its size as it pops; hit: 0..1 its flash)
  const k = g.k, X = g.X(x), Y = g.Y(y), R = r * k * s;
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); outlined(c, COL.post, P.ink, Math.max(2, 0.55 * k));
  c.beginPath(); c.arc(X, Y, R * 0.82, Math.PI * 0.1, Math.PI * 0.9); c.strokeStyle = COL.postLo; c.lineWidth = Math.max(1, R * 0.16); c.stroke();   // the ring's shaded side
  c.beginPath(); c.arc(X, Y, R * 0.58, 0, Math.PI * 2); outlined(c, hit > 0 ? COL.hit : COL.cap, P.ink, Math.max(1.2, 0.35 * k));
  c.beginPath(); c.arc(X, Y, R * 0.2, 0, Math.PI * 2); c.fillStyle = P.ink; c.fill();
  c.beginPath(); c.arc(X - R * 0.26, Y - R * 0.28, R * 0.12, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
}
function paintCourse(g, hole, seed, ter) {
  const c = g.c, P = runColours(), S = sizes(), k = g.k, M = GOLF_KERB, X = g.X, Y = g.Y, ink = Math.max(2, 0.7 * k), [sx, sy] = shadowOff(k);
  const outer = () => rr(c, X(-M), Y(-M), (S.w + 2 * M) * k, (S.h + 2 * M) * k, M * k * 0.7);
  c.fillStyle = COL.ground; c.fillRect(0, 0, g.W, g.H);                                  // the ground round the course: shrubs where there is room beside it, and the course's shadow on it
  const rnd = i => { const v = Math.sin(i * 12.9898 + (seed || 0) * 78.233) * 43758.5453; return v - Math.floor(v); };
  const shrub = (x, y, r, i) => {
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x + r * 0.2, y + r * 0.3, r, 0, Math.PI * 2); c.fill();
    for (const [dx, dy, q] of [[0, 0, 1], [-0.55, 0.3, 0.62], [0.5, 0.36, 0.56]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, r * q, 0, Math.PI * 2); c.fillStyle = COL.shrub; c.fill(); }
    c.fillStyle = COL.shrubHi; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.42, 0, Math.PI * 2); c.fill();
    if (rnd(i + 50) < 0.5) { c.fillStyle = COL.cap; for (const [dx, dy] of [[0.3, 0.1], [-0.35, 0.45], [0.05, -0.5]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, Math.max(1, r * 0.11), 0, Math.PI * 2); c.fill(); } }
  };
  const side = X(-M), ends = Y(-M);
  if (side >= 20) for (let y = 26, i = 0; y < g.H - 16; y += 44 + rnd(i) * 34, i++) for (const s of [0, 1]) if (rnd(i * 2 + s + 9) < 0.72) shrub((s ? g.W - side / 2 : side / 2) + (rnd(i + s * 7) - 0.5) * side * 0.3, y + rnd(i + s) * 16, Math.min(13, side * (0.26 + 0.1 * rnd(i + s * 3))), i * 2 + s);
  if (ends >= 20) for (let x = 26, i = 0; x < g.W - 16; x += 44 + rnd(i) * 34, i++) for (const s of [0, 1]) if (rnd(i * 2 + s + 9) < 0.72) shrub(x + rnd(i + s) * 16, (s ? g.H - ends / 2 : ends / 2) + (rnd(i + s * 7) - 0.5) * ends * 0.3, Math.min(13, ends * (0.26 + 0.1 * rnd(i + s * 3))), i * 2 + s);
  c.fillStyle = 'rgba(0,0,0,.26)'; rr(c, X(-M) + 0.8 * k, Y(-M) + 1.2 * k, (S.w + 2 * M) * k, (S.h + 2 * M) * k, M * k * 0.7); c.fill();
  outer(); outlined(c, COL.wood, P.ink, ink);                                           // the kerb: wood, outlined like the rest of the game
  c.strokeStyle = COL.woodLo; c.lineWidth = Math.max(1, 0.45 * k);                      // a groove round it
  rr(c, X(-M + 1.5), Y(-M + 1.5), (S.w + 2 * M - 3) * k, (S.h + 2 * M - 3) * k, (M - 1.5) * k * 0.7); c.stroke();
  c.save(); c.beginPath(); c.rect(X(0), Y(0), S.w * k, S.h * k); c.clip();
  c.fillStyle = COL.turf; c.fillRect(X(0), Y(0), S.w * k, S.h * k);                     // the turf, mown in bands
  for (let y = 0; y < S.h; y += 10) { c.fillStyle = (y / 10) % 2 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.035)'; c.fillRect(X(0), Y(y), S.w * k, 10 * k); }
  const lamp = c.createRadialGradient(X(S.w * 0.42), Y(S.h * 0.4), 10 * k, X(S.w / 2), Y(S.h / 2), 112 * k);   // lighter under the lamp, darker towards the kerb
  lamp.addColorStop(0, 'rgba(255,255,255,.1)'); lamp.addColorStop(0.55, 'rgba(255,255,255,0)'); lamp.addColorStop(1, 'rgba(0,0,0,.14)');
  c.fillStyle = lamp; c.fillRect(X(0), Y(0), S.w * k, S.h * k);
  const shade = (x1, y1, x, y, w, h) => { const sg = c.createLinearGradient(X(0), Y(0), X(x1), Y(y1)); sg.addColorStop(0, 'rgba(0,0,0,.28)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(X(x), Y(y), w * k, h * k); };
  shade(0, 3, 0, 0, S.w, 3); shade(2.4, 0, 0, 0, 2.4, S.h);                            // the top and left kerbs' shadows on the turf
  if (ter) paintTerrain(c, g, ter, P);                                                    // the terrain, on the turf under everything else
  const [tx, ty] = hole.tee;                                                             // the tee: a mat with its two marks
  rr(c, X(tx - 10), Y(ty - 4.6), 20 * k, 9.2 * k, 1.6 * k); c.fillStyle = COL.mat; c.fill(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = Math.max(1, 0.4 * k); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; for (const d of [-7.4, 7.4]) { c.beginPath(); c.arc(X(tx + d), Y(ty), 0.8 * k, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.24)';                                                      // every shadow before any wall: none lies over one
  for (const w of hole.walls) { c.save(); c.translate(sx, sy); wallShape(c, g, w, 0); c.fill(); c.restore(); }
  for (const [x, y, r] of hole.bumpers) { c.beginPath(); c.arc(X(x) + sx, Y(y) + sy, r * k, 0, Math.PI * 2); c.fill(); }
  const [cx, cy] = hole.cup, CR = S.cupR;                                                // the cup: its rim, the hole and the dark of it
  c.beginPath(); c.arc(X(cx), Y(cy), (CR + 1) * k, 0, Math.PI * 2); outlined(c, COL.rim, P.ink, Math.max(1.5, 0.45 * k));
  const hg = c.createRadialGradient(X(cx) + 0.9 * k, Y(cy) + 1.2 * k, CR * k * 0.15, X(cx), Y(cy), CR * k);
  hg.addColorStop(0, '#2a5a35'); hg.addColorStop(0.65, COL.hole); hg.addColorStop(1, '#06120a');
  c.beginPath(); c.arc(X(cx), Y(cy), CR * k * 0.94, 0, Math.PI * 2); c.fillStyle = hg; c.fill(); c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, 0.45 * k); c.stroke();
  for (const w of hole.walls) {                                                          // the walls: a darker edge, a lighter top, the ink round them
    wallShape(c, g, w, 0); outlined(c, COL.woodLo, P.ink, Math.max(2, 0.6 * k));
    wallShape(c, g, w, -Math.min(1.1, Math.min(w[2], w[3]) * 0.24)); c.fillStyle = COL.wood; c.fill();
  }
  c.restore();
  c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, 0.5 * k); c.strokeRect(X(0), Y(0), S.w * k, S.h * k);   // the kerb's inner edge
  for (const b of hole.bumpers) post(c, g, b, P, 1, 0);                                 // the posts at rest
}
function courseLayer(g, mini, hole) {
  const t = g.c.getTransform ? g.c.getTransform() : null, dpr = t && typeof t.a === 'number' && t.a > 0 ? t.a : 1;
  const ter = golfTerrainOf(mini), key = [mini.hole, g.W, g.H, typeof g.k === 'number' ? g.k.toFixed(4) : '', dpr, ter ? [ter.slopes.length, ter.sand.length, ter.water.length].join() : '-'].join('|');
  if (layer && layer.key === key) return layer.cv;
  layer = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(g.W * dpr)); cv.height = Math.max(1, Math.round(g.H * dpr));
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCourse(Object.assign({}, g, { c }), hole, mini.hole, ter);
    layer = { key, cv };
  } catch (e) { layer = null; }                                   // (no canvas to keep it in: painted straight on, below)
  return layer ? layer.cv : null;
}

// ---- the balls ----
// A ball rolls, as Pool's do (pool/view.js rollOf: the same sums): its mark (the drawn X or O) is carried round by the
// way the ball travels, a full turn for every circumference rolled, the same mark on its other side; it starts straight
// up and must end straight up (a ball at rest can always be read), so the mark is rolled forwards from the start and
// backwards from the end and shown between the two by how far along its way the ball is. m: where the mark's centre
// points, a unit vector (z towards the eye).
const ROLLS = new WeakMap(), UP = [0, 0, 1];
function turn(m, dx, dy, R) {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return m;
  const ux = dx / d, uy = dy / d, a = d / R, ca = Math.cos(a), sa = Math.sin(a), along = m[0] * ux + m[1] * uy, al = along * ca + m[2] * sa;
  return [m[0] + (al - along) * ux, m[1] + (al - along) * uy, m[2] * ca - along * sa];
}
function mix(a, b, u) {
  const s = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0 ? -1 : 1, x = a[0] + (s * b[0] - a[0]) * u, y = a[1] + (s * b[1] - a[1]) * u, z = a[2] + (s * b[2] - a[2]) * u, d = Math.hypot(x, y, z);
  return d < 1e-6 ? a : [x / d, y / d, z / d];
}
function rollOf(rec, R) {
  let r = ROLLS.get(rec);
  if (r) return r;
  r = {};
  const F = rec.frames, n = F.length;
  rec.ids.forEach((id, i) => {
    const at = new Array(n), fwd = new Array(n), far = new Array(n), step = k => [F[k + 1][2 * i] - F[k][2 * i], F[k + 1][2 * i + 1] - F[k][2 * i + 1]];
    let last = n - 1;
    while (last > 0 && F[last][2 * i] == null) last--;
    let m = UP, s = 0;
    for (let k = 0; k < n; k++) { fwd[k] = m; far[k] = s; if (k < last && F[k][2 * i] != null) { const [dx, dy] = step(k); m = turn(m, dx, dy, R); s += Math.hypot(dx, dy); } }
    m = UP;
    for (let k = n - 1; k >= 0; k--) {
      if (k < last && F[k][2 * i] != null) { const [dx, dy] = step(k); m = turn(m, -dx, -dy, R); }
      const u = s > 0 ? far[k] / s : 1;
      at[k] = mix(fwd[k], m, u * u * (3 - 2 * u));
    }
    r[id] = { at, last };
  });
  ROLLS.set(rec, r);
  return r;
}
function markNow(roll, rec, id, f, pos, R) {                      // the mark at frame f (a fraction: between two frames, as the ball is drawn)
  const r = roll[id], i = rec.ids.indexOf(id);
  if (!r || i < 0 || !pos) return UP;
  const k = Math.max(0, Math.min(rec.frames.length - 1, Math.floor(f)));
  if (k >= r.last) return r.at[Math.min(k, r.at.length - 1)];
  const a = rec.frames[k], b = rec.frames[k + 1];
  return mix(turn(r.at[k], pos[0] - a[2 * i], pos[1] - a[2 * i + 1], R), turn(r.at[k + 1], pos[0] - b[2 * i], pos[1] - b[2 * i + 1], R), f - k);
}
// One ball (its shadow is drawn before any ball): its player's colour, the shade away from the lamp, its drawn mark
// where the roll has carried it, the ink outline, the shine. dim: down in the cup, in its dark.
function ball(c, X, Y, R, p, P, m, dim) {
  if (R <= 0.5) return;
  c.save();
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = p === 'X' ? P.X : P.O; c.fill(); c.clip();
  c.beginPath(); c.rect(X - R * 2, Y - R * 2, R * 4, R * 4); c.arc(X - R * 0.3, Y - R * 0.38, R * 1.04, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.16)'; c.fill('evenodd');
  const n = m && m[2] < 0 ? [-m[0], -m[1], -m[2]] : m || UP;      // (the mark on the side that shows)
  if (n[2] > 0.06) {
    const a = Math.atan2(n[1], n[0]), s = R * 0.4;
    c.translate(X + n[0] * R, Y + n[1] * R); c.rotate(a); c.scale(n[2], 1); c.rotate(-a);   // (squashed towards the rim as it turns away)
    c.strokeStyle = P.ink; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, R * 0.27);
    c.beginPath(); if (p === 'X') { c.moveTo(-s, -s); c.lineTo(s, s); c.moveTo(s, -s); c.lineTo(-s, s); } else c.arc(0, 0, s, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
  if (dim > 0) { c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`; c.fill(); }
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.lineWidth = Math.max(1.5, R * 0.22); c.strokeStyle = P.ink; c.stroke();
  if (!(dim > 0.3)) { c.beginPath(); c.arc(X - R * 0.4, Y - R * 0.42, R * 0.19, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill(); }
}
// The flag: its pole up from the cup with the pennant on its top, over its own shadow. lift (0..1): drawn out of the
// cup and held up, see-through, so a ball at the cup is never hidden; wave: the pennant's tip thrown about.
function flag(c, g, cup, lift, wave, P) {
  const k = g.k, [ph, fl, fd] = GOLFV.flag, X = g.X(cup[0]), Y = g.Y(cup[1]) - lift * 5 * k, top = Y - ph * k, a = 1 - 0.62 * lift;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = a;
  const sx = X + (4.6 + 3 * lift) * k, sy = g.Y(cup[1]) + (6.2 + 4 * lift) * k;        // its shadow, lying down and to the right
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = Math.max(1.5, 0.7 * k); c.beginPath(); c.moveTo(g.X(cup[0]) + lift * 3 * k, g.Y(cup[1]) + lift * 4 * k); c.lineTo(sx, sy); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5.5 * k, sy - 1.2 * k); c.lineTo(sx + 1.4 * k, sy - 3.6 * k); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(X, Y); c.lineTo(X, top); c.lineWidth = Math.max(4, 1.5 * k); c.strokeStyle = P.ink; c.stroke();   // the pole
  c.lineWidth = Math.max(1.6, 0.6 * k); c.strokeStyle = COL.cap; c.stroke();
  const tip = wave * 1.6 * k;
  c.beginPath(); c.moveTo(X + 0.6 * k, top + 0.3 * k); c.quadraticCurveTo(X + fl * 0.5 * k, top + fd * 0.2 * k - tip, X + fl * k, top + fd * 0.5 * k + tip); c.quadraticCurveTo(X + fl * 0.5 * k, top + fd * 0.8 * k + tip * 0.5, X + 0.6 * k, top + fd * k); c.closePath();
  outlined(c, COL.flag, P.ink, Math.max(1.6, 0.5 * k));
  c.beginPath(); c.arc(X, top, Math.max(2, 0.9 * k), 0, Math.PI * 2); outlined(c, COL.cap, P.ink, Math.max(1.2, 0.35 * k));   // its knob
  c.restore();
}
// The putter, from above: its head behind the ball, `gap` course units back from the ball's edge (less than nothing:
// through where the ball stood), square to the aim; the shaft comes up from the head's heel to the hands of whoever
// stands beside the line (the side with more of the course), so it lies off to that side, its grip the shooter's
// colour; all over its shadow.
function drawPutter(g, from, aim, gap, alpha, P, p) {
  const c = g.c, S = sizes(), k = g.k, ux = Math.sin(aim), uy = -Math.cos(aim), [hw, hd] = GOLFV.head, L = GOLFV.stick, d0 = S.ballR + gap;
  let px = -uy, py = ux;
  if (px * (S.w / 2 - from[0]) + py * (S.h / 2 - from[1]) < 0) { px = -px; py = -py; }   // (the side the course's middle is on)
  const at = (d, s) => [g.X(from[0] - ux * d + px * s), g.Y(from[1] - uy * d + py * s)];
  const head = () => { const A1 = at(d0, hw / 2), B1 = at(d0 + hd, hw / 2), B2 = at(d0 + hd, -hw / 2), A2 = at(d0, -hw / 2); c.beginPath(); c.moveTo(A1[0], A1[1]); c.lineTo(B1[0], B1[1]); c.lineTo(B2[0], B2[1]); c.lineTo(A2[0], A2[1]); c.closePath(); };
  const h0 = at(d0 + hd * 0.55, hw / 2 - 1.2), sdx = (px * 0.99 - ux * 0.14) * k, sdy = (py * 0.99 - uy * 0.14) * k;   // the shaft: from the heel, off to the side and a little back
  const shaft = (a, b) => { c.beginPath(); c.moveTo(h0[0] + sdx * a, h0[1] + sdy * a); c.lineTo(h0[0] + sdx * b, h0[1] + sdy * b); };
  const inkW = Math.max(3, 1.1 * k), w = Math.max(2, 1.25 * k);
  c.save(); c.globalAlpha = alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  c.save(); c.translate(1.3 * k, 1.9 * k); c.fillStyle = c.strokeStyle = 'rgba(0,0,0,.2)'; head(); c.fill(); shaft(0, L); c.lineWidth = w + inkW; c.stroke(); c.restore();   // its shadow
  shaft(0, L); c.strokeStyle = P.ink; c.lineWidth = w + inkW; c.stroke(); c.strokeStyle = COL.shaft; c.lineWidth = w; c.stroke();
  shaft(L - GOLFV.grip, L); c.strokeStyle = P.ink; c.lineWidth = w * 1.5 + inkW; c.stroke(); c.strokeStyle = p === 'O' ? P.O : P.X; c.lineWidth = w * 1.5; c.stroke();   // the grip: whose shot it is
  head(); c.strokeStyle = P.ink; c.lineWidth = inkW; c.stroke(); c.fillStyle = COL.steel; c.fill();
  const f1 = at(d0 + hd * 0.5, hw / 2 - 0.9), f2 = at(d0 + hd * 0.5, -hw / 2 + 0.9);
  c.beginPath(); c.moveTo(f1[0], f1[1]); c.lineTo(f2[0], f2[1]); c.strokeStyle = 'rgba(22,18,16,.35)'; c.lineWidth = Math.max(1, 0.3 * k); c.stroke();
  c.restore();
}
// The recording at a moment: every ball's place (as ui/physics.js reads it), for what the events mark (a knock, a pop).
function placeAt(rec, id, t) {
  const i = rec.ids.indexOf(id), n = rec.frames.length;
  if (i < 0 || !n) return null;
  const f = Math.max(0, Math.min(n - 1, t * rec.fps)), k = Math.floor(f), u = f - k, a = rec.frames[k], b = rec.frames[Math.min(n - 1, k + 1)];
  if (a[2 * i] == null) return null;
  return b[2 * i] == null ? [a[2 * i], a[2 * i + 1]] : [a[2 * i] + (b[2 * i] - a[2 * i]) * u, a[2 * i + 1] + (b[2 * i + 1] - a[2 * i + 1]) * u];
}
// How fast a ball is going at a moment of the recording (course units a second, as it plays).
export function golfSpeedAt(rec, id, t) {
  const i = rec && rec.ids ? rec.ids.indexOf(id) : -1, n = rec && rec.frames ? rec.frames.length : 0;
  if (i < 0 || n < 2) return 0;
  const k = Math.max(1, Math.min(n - 1, Math.round(t * rec.fps))), a = rec.frames[k - 1], b = rec.frames[k];
  return a[2 * i] == null || b[2 * i] == null ? 0 : Math.hypot(b[2 * i] - a[2 * i], b[2 * i + 1] - a[2 * i + 1]) * rec.fps;
}
// The course and everything on it. pos: where each ball is now (null: in the cup); play: { ph, el } the shot being
// played, el seconds into it (the marks' roll, a post's pop, a wall's knock, the lip's hop, a holed ball's drop and its
// sparks, the putter's stroke); o.ring: the player whose ball is to be played (a ring round it). Returns true while
// something of its own is still moving after the recording's last frame (a drop, the sparks).
export function drawGolf(g, mini, pos, play, o) {
  const c = g.c, P = runColours(), L = PHYSICS.lib, S = sizes(), hole = L.HOLES[mini.hole], k = g.k, R = S.ballR, cup = hole.cup;
  const cv = courseLayer(g, mini, hole);
  if (cv) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cv, 0, 0); c.restore(); } else paintCourse(g, hole, mini.hole, golfTerrainOf(mini));
  const ph = play && play.ph, rec = ph && ph.rec && Array.isArray(ph.rec.frames) && ph.rec.frames.length && !REDUCED ? ph.rec : null;
  const el = rec ? Math.max(0, play.el) : 0, f = rec ? Math.min(rec.frames.length - 1, el * rec.fps) : 0, roll = rec ? rollOf(rec, R) : null, evs = rec ? ph.events || [] : [];
  const since = (e, len) => (el >= e.t && el < e.t + len ? (el - e.t) / len : -1);
  let busy = false;
  for (const e of evs) {                                           // a post that has just kicked a ball off: it pops, and a ring goes out from it
    const u = e.k === 'bump' ? since(e, GOLFV.bump) : -1, b = u >= 0 ? hole.bumpers[e.b] : null;
    if (!b) continue;
    busy = true;
    c.beginPath(); c.arc(g.X(b[0]), g.Y(b[1]), b[2] * k * (1.15 + 1.1 * u), 0, Math.PI * 2); c.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - u)).toFixed(3)})`; c.lineWidth = Math.max(2, 1 * k) * (1 - 0.5 * u); c.stroke();
    post(c, g, b, P, 1 + 0.36 * Math.pow(1 - u, 2) * Math.min(1, u * 8), 1 - u);
  }
  for (const e of evs) {                                           // a wall's knock: a ring off the ball that struck it
    const u = (e.k === 'wall' || e.k === 'mill') && e.v >= GOLFV.knockMin ? since(e, GOLFV.knock) : -1;
    if (u < 0) continue;
    busy = true;
    const id = rec.ids.reduce((a, b) => (golfSpeedAt(rec, b, e.t) > golfSpeedAt(rec, a, e.t) ? b : a)), at = placeAt(rec, id, e.t);
    if (!at) continue;
    c.beginPath(); c.arc(g.X(at[0]), g.Y(at[1]), R * k * (1.1 + 1.3 * u), 0, Math.PI * 2); c.strokeStyle = `rgba(255,255,255,${(0.75 * (1 - u) * Math.min(1, e.v / 30 + 0.4)).toFixed(3)})`; c.lineWidth = Math.max(1.5, 0.6 * k); c.stroke();
  }
  const hops = {}, drops = [];                                     // a lip-out's hop (by ball); the balls on their way down the cup
  let lipU = -1, spark = null, flagUp = 0, wave = 0;
  for (const e of evs) {
    if (e.k === 'lip') { const u = since(e, GOLFV.hop); if (u >= 0) { busy = true; hops[e.id] = Math.sin(Math.PI * u); lipU = u; wave = Math.max(wave, Math.sin(u * Math.PI * 3) * (1 - u)); } }
    if (e.k !== 'hole' || el < e.t) continue;
    const t = el - e.t, i = rec.ids.indexOf(e.id), r = roll[e.id];
    if (t < GOLFV.drop && r && i >= 0) {
      busy = true;
      const from = [rec.frames[r.last][2 * i], rec.frames[r.last][2 * i + 1]], u = t / GOLFV.drop, q = 1 - (1 - u) * (1 - u);
      drops.push({ id: e.id, x: from[0] + (cup[0] - from[0]) * q, y: from[1] + (cup[1] - from[1]) * q, s: 1 - 0.36 * u * u, dim: 0.8 * u, m: r.at[r.last] });
    }
    if (t < GOLFV.drop + GOLFV.burst) { busy = true; flagUp = Math.max(flagUp, 1 - smooth((t - GOLFV.drop) / 0.3)); if (t >= GOLFV.drop) { const u = (t - GOLFV.drop) / GOLFV.burst; spark = { u, id: e.id }; wave = Math.max(wave, Math.sin(u * Math.PI * 5) * (1 - u)); } }
  }
  if (lipU >= 0) { c.beginPath(); c.arc(g.X(cup[0]), g.Y(cup[1]), (S.cupR + 1 + 2.4 * lipU) * k, 0, Math.PI * 2); c.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - lipU)).toFixed(3)})`; c.lineWidth = Math.max(2, 0.9 * k); c.stroke(); }
  const ter = golfTerrainOf(mini);
  if (ter) {
    for (const e of evs) {                                         // into the water: a splash where it went in, and a ring where it is back
      if (e.k === 'water') {
        const u = since(e, GOLFV.splash), v = since(e, GOLFV.back), i = rec.ids.indexOf(e.id), home = i >= 0 ? [rec.frames[0][2 * i], rec.frames[0][2 * i + 1]] : null;
        if (u >= 0) { busy = true; splash(c, g, e.x, e.y, u, P); }
        if (v >= 0 && home && home[0] != null) { busy = true; c.beginPath(); c.arc(g.X(home[0]), g.Y(home[1]), R * k * (1.2 + 1.6 * v), 0, Math.PI * 2); c.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - v)).toFixed(3)})`; c.lineWidth = Math.max(2, 0.8 * k); c.stroke(); }
      } else if (e.k === 'sand') {
        const u = since(e, GOLFV.puff), at = u >= 0 ? placeAt(rec, e.id, e.t) : null;
        if (!at) continue;
        busy = true; c.fillStyle = `rgba(214,184,110,${(0.9 * (1 - u)).toFixed(3)})`;
        for (let j = 0; j < 7; j++) { const a = j * 0.9 + 0.4, q = R * (1 + 2.4 * smooth(u)) * (0.7 + 0.3 * (j % 3)); c.beginPath(); c.arc(g.X(at[0] + Math.cos(a) * q), g.Y(at[1] + Math.sin(a) * q), Math.max(1, 0.45 * k) * (1 - 0.5 * u), 0, Math.PI * 2); c.fill(); }
      }
    }
    const L0 = PHYSICS.lib, phase = ph && Number.isFinite(ph.mill) ? ph.mill : golfPhase(mini), simT = rec ? Math.min(el, (rec.frames.length - 1) / rec.fps) * (L0.TS || 1) : 0;   // the windmills: still at where the next shot finds them, turning as a shot plays (its own clock: physics-sim.js millAngle)
    for (const m of ter.mills) windmill(c, g, m, L0.millAngle(m, simT, phase), P, shadowOff(k));
    if (rec && ter.mills.length && el * rec.fps < rec.frames.length + 2) busy = true;
  }
  const ids = ['X', 'O'].filter(p => pos[p]), [lx, ly] = GOLFV.light, up = p => (hops[p] || 0);
  c.fillStyle = 'rgba(0,0,0,.26)';                                 // every shadow first: no shadow ever lies over a ball (a hopping ball's falls further off)
  for (const p of ids) { const h = up(p); c.beginPath(); c.ellipse(g.X(pos[p][0]) + R * k * (lx + 0.9 * h), g.Y(pos[p][1]) + R * k * (ly + 1.2 * h), R * k * 1.04, R * k, 0, 0, Math.PI * 2); c.fill(); }
  if (o && o.ring && pos[o.ring] && !ph) {                         // whose ball is to be played: a ring round it
    const X = g.X(pos[o.ring][0]), Y = g.Y(pos[o.ring][1]), rr2 = R * k + Math.max(4, 1.5 * k);
    c.beginPath(); c.arc(X, Y, rr2, 0, Math.PI * 2); c.strokeStyle = 'rgba(22,18,16,.45)'; c.lineWidth = 4.5; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2.2; c.stroke();
  }
  for (const d of drops) ball(c, g.X(d.x), g.Y(d.y), R * k * d.s, d.id, P, d.m, d.dim);
  for (const p of ids) { const h = up(p); ball(c, g.X(pos[p][0]), g.Y(pos[p][1]) - h * R * k * 0.5, R * k * (1 + 0.28 * h), p, P, roll ? markNow(roll, rec, p, f, pos[p], R) : UP, 0); }
  const near = ids.reduce((m, p) => Math.min(m, Math.hypot(pos[p][0] - cup[0], pos[p][1] - cup[1])), Infinity);
  flag(c, g, cup, Math.max(flagUp, smooth((GOLFV.near - near) / (GOLFV.near - GOLFV.far))), wave, P);
  if (spark) {                                                     // in the cup: sparks round it, in the colour of the ball that went down
    const u = spark.u, e = 1 - Math.pow(1 - u, 3), a = Math.max(0, 1 - u * u), X = g.X(cup[0]), Y = g.Y(cup[1]), col = spark.id === 'O' ? P.O : P.X;
    c.save(); c.lineCap = 'round'; c.globalAlpha = a;
    c.beginPath(); c.arc(X, Y, (S.cupR + 1.5 + 9 * e) * k, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = Math.max(1.5, 0.8 * k) * (1 - 0.6 * u); c.stroke();
    for (let j = 0; j < 10; j++) {
      const an = j * Math.PI / 5 + 0.3, r0 = (S.cupR + 2.5 + 7 * e) * k, r1 = r0 + (2.2 + 2.6 * (1 - u)) * k * (j % 2 ? 1 : 0.6);
      c.beginPath(); c.moveTo(X + Math.cos(an) * r0, Y + Math.sin(an) * r0); c.lineTo(X + Math.cos(an) * r1, Y + Math.sin(an) * r1);
      c.strokeStyle = P.ink; c.lineWidth = Math.max(3.5, 1.5 * k); c.stroke(); c.strokeStyle = j % 2 ? col : '#fff'; c.lineWidth = Math.max(1.8, 0.8 * k); c.stroke();
    }
    c.restore();
  }
  if (rec && !ph.both && Number.isFinite(ph.aim) && rec.ids.includes(ph.by)) {   // the putter's stroke: drawn back as it was let go, up to the ball, on through where it stood, and away
    const T = GOLFV.stroke + GOLFV.follow + GOLFV.fade, i = rec.ids.indexOf(ph.by);
    if (el < T && rec.frames[0][2 * i] != null) {
      busy = true;
      const pw = clamp01(Number(ph.power) || 0), back = 0.8 + pw * GOLFV.pull, thru = -(1.2 + 4.5 * pw);
      const gap = el < GOLFV.stroke ? back * (1 - Math.pow(el / GOLFV.stroke, 2)) : thru * (1 - Math.pow(1 - Math.min(1, (el - GOLFV.stroke) / GOLFV.follow), 2));
      const alpha = el < GOLFV.stroke + GOLFV.follow ? 1 : Math.max(0, 1 - (el - GOLFV.stroke - GOLFV.follow) / GOLFV.fade);
      drawPutter(g, [rec.frames[0][2 * i], rec.frames[0][2 * i + 1]], ph.aim, gap, alpha, P, ph.by);
    }
  }
  return busy;
}
// A putt being lined up (this phone's pull, or someone else's in their replay): the putter behind the ball, drawn back
// with the power, and a short arrow off the ball the way it is aimed, always the same length (December 2026: no sight
// line, no landing, no reach: the course and its terrain are read by eye). The power is the bar at the side: its level
// alone, no marks along it.
export function drawGolfAim(g, mini, pos, shot, p) {
  const c = g.c, P = runColours(), S = sizes(), k = g.k, R = S.ballR, from = pos[p], X = g.X, Y = g.Y;
  if (!from) return;
  if (shot.power < 0.02) { drawPutter(g, from, shot.aim, 0.8, 1, P, p); return; }   // (a replayed pull not yet begun, or let go of: the putter at the ball, nothing to show)
  const ux = Math.sin(shot.aim), uy = -Math.cos(shot.aim), a0 = R + 1.6, a1 = a0 + GOLFV.arrow, h = 2.6;
  const tip = [from[0] + ux * a1, from[1] + uy * a1], base = [from[0] + ux * (a1 - h * 1.3), from[1] + uy * (a1 - h * 1.3)];
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [col, lw] of [['rgba(0,0,0,.42)', 6.2], ['rgba(255,255,255,.97)', 3.6]]) {   // the arrow: white over a dark edge, so it reads on turf, sand and water
    c.beginPath(); c.moveTo(X(from[0] + ux * a0), Y(from[1] + uy * a0)); c.lineTo(X(base[0]), Y(base[1])); c.strokeStyle = col; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.moveTo(X(tip[0]), Y(tip[1])); c.lineTo(X(base[0] - uy * h), Y(base[1] + ux * h)); c.lineTo(X(base[0] + uy * h), Y(base[1] - ux * h)); c.closePath();
    c.fillStyle = col; c.fill(); if (lw > 4) { c.strokeStyle = col; c.lineWidth = 2.6; c.stroke(); }
  }
  drawPutter(g, from, shot.aim, 0.8 + shot.power * GOLFV.pull, 1, P, p);
  // the power: a bar beside the course where there is room, else over its edge on the side away from the ball; its level in the player's colour
  const M = g.M || 0, right = X(S.w + M), room = g.W - right, mw = 14, mh = Math.min(S.h * k * 0.46, 170), my = Y(S.h / 2) - mh / 2;
  const mx = room >= mw + 10 ? right + (room - mw) / 2 : from[0] > S.w / 2 ? X(0) + 5 : X(S.w) - mw - 5;
  rr(c, mx, my, mw, mh, mw / 2); outlined(c, 'rgba(255,248,232,.95)', P.ink, 2.5);
  const fill = (mh - 6) * clamp01(shot.power);
  if (fill > 2) { rr(c, mx + 3, my + mh - 3 - fill, mw - 6, fill, Math.min(4, (mw - 6) / 2)); c.fillStyle = p === 'O' ? P.O : P.X; c.fill(); }
  c.restore();
}
// Mini Golf's sounds, each from its event in the recording, once: the putter on the ball as the shot starts (soft or
// full by the power), a wall or the kerb (a knock, soft or full by the speed it was struck at: e.v), a post's boing
// (higher the faster the ball came), two balls meeting, the lip's rattle, the ball dropping into the cup; the terrain's:
// a splash into the water (its error buzz: haptics BAD_SOUNDS), the hiss of sand, a windmill's blade (a knock).
export function golfEventSounds(ph, add) {
  const rec = ph.rec, pw = clamp01(Number(ph.power) || 0);
  if (ph.both) add('golfPutt', 0); else add(pw < 0.3 ? 'golfPuttSoft' : 'golfPutt', 0, 0.94 + 0.2 * pw);
  for (const e of ph.events || []) {
    const t = e.t * 1000;
    if (e.k === 'wall') add(e.v <= 14 ? 'golfKnockSoft' : 'golfKnock', t, e.v <= 14 ? 1 : 0.92 + Math.min(0.24, e.v / 300));
    else if (e.k === 'bump') add('golfBoing', t, 0.9 + Math.min(0.32, golfSpeedAt(rec, e.id, e.t - 0.03) / 260));
    else if (e.k === 'balls') add(e.v <= 14 ? 'poolTick' : 'poolClack', t);
    else if (e.k === 'lip') add('golfLip', t);
    else if (e.k === 'water') add('golfSplash', t);
    else if (e.k === 'sand') add('golfSand', t);
    else if (e.k === 'mill') add(e.v <= 14 ? 'golfKnockSoft' : 'golfKnock', t, 0.8);
    else if (e.k === 'hole') add('golfCup', t);
  }
}
// The miniature: the hole as it stands (its kerb, walls, posts, tee and cup with its flag) and both balls still out,
// each a disc in its player's colour (no letter: too small to read at this size). Red and yellow are the balls' alone.
export function miniature(mini, final) {
  const L = PHYSICS.lib;
  if (!L) return physThumb(mini);
  const S = L.GOLF, h = L.HOLES[mini.hole], K = GOLF_KERB, [cx, cy] = h.cup, ter = golfTerrainOf(mini);
  return `<svg class="tphys tgolf" viewBox="${-K} ${-K} ${S.w + 2 * K} ${S.h + 2 * K}" aria-label="Mini golf: ${h.name}${['X', 'O'].map(p => (mini.holed[p] ? `, ${p} in the cup` : '')).join('')}">
      <rect x="${-K + 1.5}" y="${-K + 1.5}" width="${S.w + 2 * K - 3}" height="${S.h + 2 * K - 3}" rx="${K}" class="gkerb"/><rect x="0" y="0" width="${S.w}" height="${S.h}" class="gturf"/>
      ${[1, 3, 5, 7, 9, 11, 13, 15].map(i => `<rect x="0" y="${i * 10}" width="${S.w}" height="10" class="gmow"/>`).join('')}
      <rect x="${h.tee[0] - 10}" y="${h.tee[1] - 4.6}" width="20" height="9.2" rx="1.6" class="gmat"/>
      ${h.walls.map(([x, y, w, hh, a]) => `<rect x="${x - w / 2}" y="${y - hh / 2}" width="${w}" height="${hh}" rx="1.5" transform="rotate(${((a || 0) * 180 / Math.PI).toFixed(1)} ${x} ${y})" class="gwall"/>`).join('')}
      ${ter ? ter.slopes.map(([x, y, r, gx, gy]) => `<circle cx="${x}" cy="${y}" r="${r}" class="gslope"/><path d="M${(x - gx * 0.5).toFixed(1)} ${(y - gy * 0.5).toFixed(1)}L${(x + gx * 0.5).toFixed(1)} ${(y + gy * 0.5).toFixed(1)}" class="gfall"/>`).join('') + ter.sand.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="gsand"/>`).join('') + ter.water.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="gwater"/>`).join('') : ''}
      ${h.bumpers.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="gpost"/>`).join('')}
      ${ter ? ter.mills.map(m => { const a = L.millAngle(m, 0, ter.phase), dx = Math.cos(a) * m[2], dy = Math.sin(a) * m[2]; return `<path d="M${(m[0] - dx).toFixed(1)} ${(m[1] - dy).toFixed(1)}L${(m[0] + dx).toFixed(1)} ${(m[1] + dy).toFixed(1)}" class="gmill"/>`; }).join('') : ''}
      <circle cx="${cx}" cy="${cy}" r="${S.cupR + 1.2}" class="gcup"/><path d="M${cx} ${cy}V${cy - 17}" class="gpole"/><path d="M${cx} ${cy - 17}l12 4.5l-12 4.5z" class="gflag"/>
      ${['X', 'O'].map(p => (mini.holed[p] ? '' : `<circle cx="${mini.balls[p][0]}" cy="${mini.balls[p][1]}" r="${S.ballR * 2.3}" class="${p}"/>`)).join('')}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = physTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return physResult(f, true).text;
}
