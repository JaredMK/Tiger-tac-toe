// Door Drop: the screen, the miniature, the move's words and sounds.
// The picture is a canvas the size of its box (ui/stage.js): a comic cutaway of the tower (two towers side by side in
// the race, X's and O's, built the same): a shingled roof with an attic window and its owner's pennant, brick side
// walls cut open, and inside them the floors one under the other, each a papered room over a plank slab with its lamps
// and its doors, every door of a floor a design of its own (DES: a colour, a shape, an emblem: never red or yellow, the
// players'), and the ground floor at the bottom with the way out. The still parts are painted once into a layer
// (towerLayer) and the doors that have changed into sprites (doorSprite); a frame draws the sky, the layer(s), those
// doors, what is known of the links (a dotted arrow from a dead end to the door it comes out of) and whatever moves.
// The camera (DOORSV, rules.js DOORS): a turn opens on the whole tower(s), roof to ground with both runners, held
// DOORS.wide, then eased over DOORS.zoom into the mover's floor (introView). On this phone's own turn it plays once a
// turn as the square opens (introFor), in the interface's time; a touch cuts it short (the doors take taps only once
// the camera is there). Someone else's move opens on it inside the move's own time (flashMs counts it); this phone's
// own move never shows it (playOf: its picture ahead of its flash's clock, the flash ended as its picture ends), nor
// does a pick that goes on from a way down with Go again on (the camera just follows down). Reduced motion: none.
// A move (doorsPose, pure): the runner walks to the door on its own two feet, the door swings open on its hinge, the
// runner steps into the dark and the door swings to behind it (the picture dims, the door rattles); then a dead end:
// the door it is linked to bursts open and the runner tumbles out of it, seeing stars, while the door tried is boarded
// up (two planks and a no-way sign) and the link is drawn in; or the way down: the doorway lights up green in a comic
// burst, the trapdoor under it gives way and the runner drops through the floor (the camera following), landing with a
// squash, dust and sparkles; on the ground the way out swings open and the runner dances under confetti.
import { durRate, moveRate } from '../../core/timer.js';
import { DOORS, doorX, doorsCont, doorsDeadMs, doorsDownMs, doorsExits, doorsIn, doorsMoves, doorsPre, doorsSayAt } from './rules.js';
import { mmIntro } from '../../net/matchmaking.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, mv, state } from '../../ui/app.js';
import { explainT } from '../../ui/explainer.js';
import { fx, fxAt, zoomBusy } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt, tokSvg } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a way down with Go again on: the next pick at once
export const replay = { synth: () => [] };                         // the move is played from the flash (no door is pressed here first)
// The picture's own numbers, in the tower's units (its inside 100 across): the walls' thickness, a floor's height and
// its slab's, the roof's height and the room over it for the pole, the eaves, the gap between two towers, the ground
// under them, the margin beside them and the room over their poles in the wide shot; a door's height and its width at the most (and its share of
// its place); the runner's body; the close view's width; how long the camera takes to settle wherever it moves but
// for the intro's zoom (ms); the least zoom worth an intro, a share of the wide shot; `intro` null by the device (none
// with reduced motion), true or false to force it (the tests).
export const DOORSV = { tw: 100, wall: 7, fh: 62, slab: 7, roof: 36, top: 16, eave: 6, gap: 24, ground: 13, side: 15, head: 5, dh: 35, dw: 15.5, fill: 0.64, rr: 7.2, leg: 4.6, view: 124, ease: 200, minZoom: 0.08, intro: null };
const V = DOORSV, PRE = doorsPre(), TOWER = V.tw + 2 * V.wall, STRIDE = TOWER + V.gap, PAD = 9;
const INK = '#161210', CREAM = '#fff6df', DARK = '#231a35';
// The doors' designs (a floor's doors are all different: doorsLook): the leaf's colour and its shade, the shape of its
// top, its emblem. Never red or yellow.
export const DES = [
  { col: '#2aa39b', dk: '#1b7a74', top: 'sq', em: 'star' },       // teal, two panels
  { col: '#8b5fd0', dk: '#6540a3', top: 'arch', em: 'moon' },     // purple, planks under a round arch
  { col: '#3f82d8', dk: '#2a5fa8', top: 'round', em: 'ring' },    // blue, a porthole
  { col: '#b9773e', dk: '#8a5326', top: 'sq', em: 'diamond' },    // wood, braced
  { col: '#6d7f95', dk: '#4c5b6e', top: 'point', em: 'tri' },     // slate, iron bands under a pointed arch
  { col: '#e57ab6', dk: '#b9508c', top: 'low', em: 'heart' },     // pink, a letter slot under a low arch
];
const ROOMS = [                                                   // a room's wallpaper, its pattern and its panelling
  { bg: '#f6e6c8', pt: '#ecd3a6', wn: '#d8b98b' }, { bg: '#e7dbf4', pt: '#d7c5ec', wn: '#bea8dc' }, { bg: '#d9ebf5', pt: '#c0ddee', wn: '#a3c6dd' },
  { bg: '#e0f0da', pt: '#c9e4c0', wn: '#a8cf9c' }, { bg: '#e8eaf0', pt: '#d6dae5', wn: '#b8bfd1' },
];
let src = null, cam = null, seen = null, hooked = false, skipped = null, pend = null, layer = null;
const sprites = new Map(), INTROS = new Map(), PLAYS = new WeakMap();
const mix = n => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return n >>> 0; };
// How floor r of a square looks (whole numbers only, so every phone draws the same): its room, its pattern, and its
// doors' designs, all different.
export function doorsLook(mini, r) {
  const seed = (mini.look || 0) * 131 + r * 977 + 7, k = mini.d[r], order = DES.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = mix(seed + i * 53) % (i + 1), t = order[i]; order[i] = order[j]; order[j] = t; }
  return { room: ((mini.look || 0) + r) % ROOMS.length, pat: (mix((mini.look || 0) + 11) + r) % 4, doors: Array.from({ length: k }, (_, i) => order[i % order.length]) };
}
const doorW = k => Math.min(V.dw, (V.tw / k) * V.fill);
const floorY = r => (r + 1) * V.fh - V.slab;                      // where feet stand on floor r (r = the floors' count: the ground floor)
const towerX = (mini, p) => (mini.sep && p === 'O' ? STRIDE : 0);

// ---------- the move in time ----------
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const back = x => { const u = clamp01(x) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; };   // (out, a little past and back)
// The interface's easing (ui/fx.js ZOOM.ease), cubic-bezier(.4, 0, .2, 1): the curve's x solved for u by halving.
export function easeStd(u) {
  if (!(u > 0)) return 0;
  if (u >= 1) return 1;
  let lo = 0, hi = 1, t = u;
  for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (3 * (1 - t) * (1 - t) * t * 0.4 + 3 * (1 - t) * t * t * 0.2 + t * t * t < u) lo = t; else hi = t; }
  return 3 * (1 - t) * t * t + t * t * t;
}
// The mover and the doors at moment t of a move (ms from its walk's start; the camera's intro is before it). The runner:
// `x` (hundredths across), `y` (floors down from the top to its feet), `lift` (up into the doorway, units), `face`,
// `walk` (steps taken), `sc`, `al`, `rot`, `sq` (a squash), `arms` (up), `dizzy`, `air`. The doors: `open` (the one
// tried, 0 shut to 1 wide), `openOut` (the linked one), `mark` (what the door is has come out: its mark and its link
// are drawn), `board` (the planks going on, 0 to 1), `glow` (the way down lit), `hatch` (the trapdoor), `exit` (the
// way out). The rest: `dim` (the dark), `shake`, `cf` (the floor the camera is on) and the effects' own progress, -1
// while off: `bang` (the linked door's burst), `burst` (the way down's), `dust` (a landing's), `party` (the win's).
export function doorsPose(s, t, F) {
  const T = DOORS, tin = doorsIn(), tD = tin + T.dark, win = s.down && s.r + 1 >= F, dir = s.ix > s.from + 0.5 ? 1 : s.ix < s.from - 0.5 ? -1 : 0;
  const P = { x: s.from, y: s.r + 1, lift: 0, face: dir || 1, walk: 0, sc: 1, al: 1, rot: 0, sq: 0, arms: 0, dizzy: 0, air: false, open: 0, openOut: 0, mark: false, board: 0, glow: 0, hatch: 0, exit: 0, dim: 0, shake: 0, cf: s.r, bang: -1, burst: -1, dust: -1, party: -1 };
  const steps = Math.max(2, Math.round(Math.abs(s.ix - s.from) / 8));
  if (t < T.walk) { const u = Math.max(0, t) / T.walk; P.x = s.from + (s.ix - s.from) * ease(u); P.walk = dir ? ease(u) * steps : 0; if (!dir) P.lift = Math.sin(Math.PI * u) * 2.2; return P; }
  P.x = s.ix; P.walk = dir ? steps : 0;
  if (t < T.walk + T.open) { const u = (t - T.walk) / T.open; P.open = back(u); P.sq = -0.12 * Math.sin(Math.PI * u); return P; }
  if (t < tin) { const u = (t - T.walk - T.open) / T.step; P.open = 1; P.walk += u * 2; P.sc = 1 - 0.26 * ease(u); P.lift = 2.6 * ease(u); P.al = 1 - clamp01((u - 0.5) / 0.5); return P; }
  if (t < tD) { const u = (t - tin) / T.dark; P.al = 0; P.sc = 0.74; P.lift = 2.6; P.open = 1 - 0.82 * ease(u * 2.4); P.dim = u < 0.3 ? u / 0.3 : u > 0.8 ? (1 - u) / 0.2 : 1; P.shake = Math.sin(u * 38) * clamp01((u - 0.4) / 0.25) * (1 - clamp01((u - 0.86) / 0.14)); return P; }
  P.mark = true;
  if (!s.down) {
    P.x = s.ox; P.face = s.ox < 50 ? 1 : -1;
    const tP = tD + T.out, tB = tP + T.pop;
    if (t < tP) { const u = (t - tD) / T.out; P.mark = false; P.al = 0; P.open = 0.18; P.openOut = back(u * 1.25); P.bang = u; return P; }
    if (t < tB) {
      const v = (t - tP) / T.pop, a = clamp01(v / 0.74);          // (out of the doorway in an arc, heels over head, down on its feet at a: then a wobble)
      P.open = 0.18 * (1 - clamp01(v * 3)); P.openOut = 1 - ease((v - 0.5) / 0.45); P.bang = v < 0.4 ? 0.999 : -1;
      P.sc = 0.74 + 0.26 * ease(a * 1.6); P.lift = 2.6 * (1 - ease(a * 1.8)) + 0.26 * V.fh * Math.sin(Math.PI * a) * (a < 1 ? 1 : 0); P.rot = (1 - ease(a)) * Math.PI * 2 * -P.face; P.air = a < 1;
      P.sq = v > 0.74 ? Math.sin(Math.PI * (v - 0.74) / 0.26) : 0; P.dust = v > 0.74 ? (v - 0.74) / 0.26 : -1; P.dizzy = clamp01((v - 0.6) / 0.2); P.arms = 1 - clamp01((v - 0.74) / 0.2);
      return P;
    }
    const u = clamp01((t - tB) / T.board); P.board = u >= 1 ? 1 : u; P.dizzy = 1 - clamp01((u - 0.7) / 0.3);
    return P;
  }
  const tF = tD + T.beat, tL = tF + T.drop, tW = tL + T.land;
  P.glow = 1; P.open = 1; P.sc = 0.78; P.lift = 2.6; P.arms = 1;
  if (t < tF) { const u = (t - tD) / T.beat; P.glow = clamp01(u * 3.5); P.open = 0.18 + 0.82 * back(u * 2.2); P.burst = u; P.al = clamp01(u * 5); P.lift = 2.6 + 4 * Math.sin(Math.PI * clamp01(u * 1.3)); P.arms = clamp01(u * 4); return P; }
  if (t < tL) { const u = (t - tF) / T.drop, g = clamp01((u - 0.14) / 0.86); P.hatch = back(u / 0.2); P.y = s.r + 1 + g * g; P.lift = 2.6 * (1 - g); P.sc = 0.78 + 0.22 * g; P.rot = Math.sin(u * 9.5) * 0.2; P.air = true; P.cf = s.r + ease((u - 0.08) / 0.92); P.burst = u < 0.25 ? 0.999 : -1; return P; }
  P.y = s.r + 2; P.cf = s.r + 1; P.sc = 1; P.lift = 0; P.face = 1;
  if (t < tW) { const u = (t - tL) / T.land; P.sq = Math.sin(Math.PI * clamp01(u * 1.25)); P.dust = u; P.hatch = 1 - clamp01(u * 2.2); P.arms = win ? 1 : 1 - clamp01((u - 0.3) / 0.5); return P; }
  P.arms = win ? 1 : 0;
  if (!win) return P;
  const w = (t - tW) / T.win; P.exit = 1; P.party = w < 1 ? Math.max(0, w) : -1;
  if (w < 1) {                                                   // the dance: two hops, a twirl in the second, the pose
    const h1 = clamp01((w - 0.04) / 0.26), h2 = clamp01((w - 0.34) / 0.3);
    P.exit = ease(w * 2.4); P.lift = 0.2 * V.fh * (h1 < 1 ? Math.sin(Math.PI * h1) : 0) + 0.26 * V.fh * (h2 < 1 ? Math.sin(Math.PI * h2) : 0); P.air = (h1 > 0 && h1 < 1) || (h2 > 0 && h2 < 1);
    P.rot = h2 > 0 && h2 < 1 ? ease(h2) * Math.PI * 2 : 0; P.sq = w > 0.66 && w < 0.8 ? Math.sin(Math.PI * (w - 0.66) / 0.14) : 0; P.face = w > 0.5 ? -1 : 1;
  }
  return P;
}
// How a flash plays on this screen, worked out once as it first plays: `lead`, how far its picture is ahead of its
// flash's clock (ms), and whether it opens on the camera's intro. Someone else's move, the first of their turn, opens
// on it (unless this screen goes without: its picture then starts at the walk); this phone's own never does, and its
// walk has already begun as the door was tapped (`pend`).
function playOf(f) {
  if (!f || !f.dd) return { lead: 0, intro: false };
  let p = PLAYS.get(f);
  if (!p) {
    const own = ownMove(f), pre = f.dd.c ? 0 : PRE, intro = !!pre && !own && introOk() && zoomsHere();
    const walked = own && pend && pend.r === f.dd.r && pend.i === f.dd.i ? Math.min(DOORS.walk, Math.max(0, performance.now() - pend.t0) * moveRate('doors')) : 0;
    p = { lead: (intro ? 0 : pre) + walked, intro }; PLAYS.set(f, p);
  }
  return p;
}
const preOf = f => (f.dd.c ? 0 : PRE);

// ---------- the camera ----------
// A view of the scene: its middle (`cx`, `cy`, in the scene's units: X's tower's inside from 0, O's a stride on in the
// race; 0 down from the top floor's ceiling) and the width `w` it shows across the canvas. The wide shot: every tower
// whole, roof to ground, fitted to the canvas with the ground at its foot. The close view: a tower's width on the
// mover's floor, never past the roof's pole or the ground.
const sceneOf = mini => ({ x0: -V.wall - V.side, x1: (mini.sep ? STRIDE : 0) + V.tw + V.wall + V.side, y0: -V.roof - V.top - V.head, y1: (mini.f + 1) * V.fh + V.ground });
export function wideView(mini, W, H) {
  const s = sceneOf(mini), w = Math.max(s.x1 - s.x0, (s.y1 - s.y0) * W / Math.max(1, H));
  return { cx: (s.x0 + s.x1) / 2, cy: s.y1 - (w * H / W) / 2, w };
}
export function closeView(mini, p, fl, W, H) {
  const s = sceneOf(mini), w = V.view, vh = w * H / W, lo = s.y0 + vh / 2, hi = s.y1 - vh / 2;
  return { cx: towerX(mini, p) + V.tw / 2, cy: lo >= hi ? (s.y0 + s.y1) / 2 : Math.max(lo, Math.min(hi, (fl + 0.5) * V.fh)), w };
}
export const camZooms = (mini, W, H) => 1 - V.view / wideView(mini, W, H).w > V.minZoom;   // the two differ enough for an intro
// A view `u` of the way from one to another (0..1): the width by equal ratios (an even zoom), the middle as far along
// as the width.
export function viewAt(a, b, u) {
  const w = a.w * Math.pow(b.w / a.w, u), s = Math.abs(a.w - b.w) < 0.5 ? u : (a.w - w) / (a.w - b.w);
  return { cx: a.cx + (b.cx - a.cx) * s, cy: a.cy + (b.cy - a.cy) * s, w };
}
// The intro `t` ms in (its own time): the wide shot held DOORS.wide, then the zoom over DOORS.zoom into the mover's
// floor (from `from`, where the camera was as the zoom began: the wide shot unless it was still on its way there).
export function introView(mini, p, fl, W, H, t, from) {
  const wide = wideView(mini, W, H), close = closeView(mini, p, fl, W, H);
  return t < DOORS.wide ? wide : t < PRE ? viewAt(from || wide, close, easeStd((t - DOORS.wide) / DOORS.zoom)) : close;
}
const introOk = () => (V.intro != null ? V.intro : !REDUCED);
function zoomsHere() {                                              // (the canvas as this screen last drew it, else as it stands; unknown: a phone's)
  let W = seen ? seen.W : 0, H = seen ? seen.H : 0;
  if (!(W >= 2 && H >= 2)) { const cv = app && app.querySelector ? app.querySelector('canvas.ddcv') : null; W = cv ? Number(cv.offsetWidth) || 0 : 0; H = cv ? Number(cv.offsetHeight) || 0 : 0; }
  return !(W >= 2 && H >= 2) || !src || camZooms(src.mini, W, H);
}
// This phone's own turn: its intro, once a turn, as the square opens on it: keyed to the square, the side and the
// match's move count (its id online), so a redraw, or the square opened again the same turn, never starts it again.
// Its clock (`t0`) starts once the board's zoom into the square has landed and nothing covers the square (the side
// reveal, a "?" card); a touch on the square cuts it (`cut`).
function introFor(turn) {
  const key = `${state.id || ''}:${state.zoom}:${turn}:${state.moves}`;
  let r = INTROS.get(key);
  if (!r) { r = { key, t0: null, cut: false }; INTROS.set(key, r); if (INTROS.size > 40) INTROS.delete(INTROS.keys().next().value); }
  return r;
}
export const introNow = () => (src ? src.intro : null);          // (the tests and the browser checks: this phone's turn's intro as it stands)
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {                       // a touch during the turn's intro: straight to the floor (the doors take the next tap)
    if (state.screen !== 'mini' || !e.target || !e.target.closest || !e.target.closest('.g-dd')) return;
    const r = src && src.zoom === state.zoom ? src.intro : null;
    if (r && !r.cut && src.it != null && src.it < PRE) { r.cut = true; if (cam) cam.snap = true; go(); }
  }, { passive: true });
  app.addEventListener('click', e => {                             // a door tapped: the runner sets off for it at once (the move's own flash carries on from there)
    const b = e.target && e.target.closest ? e.target.closest('.ddgo') : null;
    if (!b || !src || !src.myTurn || state.flash || state.done) return;
    pend = { sq: state.zoom, by: src.turn, r: +b.dataset.r, i: +b.dataset.i, t0: performance.now(), till: performance.now() + 6000 }; go();
  }, true);
}

// ---------- the drawing: a door ----------
function topPath(c, kind, x, y, w, h) {                           // a door's outline, its top by its design, its foot at y + h
  c.beginPath();
  if (kind === 'arch') { c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); }
  else if (kind === 'point') { c.moveTo(x, y + h); c.lineTo(x, y + w * 0.62); c.quadraticCurveTo(x + w * 0.03, y + w * 0.2, x + w / 2, y); c.quadraticCurveTo(x + w * 0.97, y + w * 0.2, x + w, y + w * 0.62); c.lineTo(x + w, y + h); }
  else if (kind === 'low') { c.moveTo(x, y + h); c.lineTo(x, y + w * 0.3); c.ellipse(x + w / 2, y + w * 0.3, w / 2, w * 0.3, 0, Math.PI, 2 * Math.PI); c.lineTo(x + w, y + h); }
  else { const r = kind === 'round' ? w * 0.32 : 1.1; c.moveTo(x, y + h); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h); }
  c.closePath();
}
function emblem(c, kind, x, y, e) {                               // a door's emblem, cream, about (x, y), e across
  c.fillStyle = CREAM; c.strokeStyle = INK; c.lineWidth = 0.45; c.lineJoin = 'round'; c.beginPath();
  if (kind === 'star') for (let q = 0; q < 10; q++) { const r = q % 2 ? e * 0.22 : e * 0.52, a = q * Math.PI / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  else if (kind === 'moon') { c.arc(x - e * 0.06, y, e * 0.5, 0.908, 2 * Math.PI - 0.908); c.arc(x + e * 0.18, y, e * 0.4, 2 * Math.PI - 1.74, 1.74, true); }
  else if (kind === 'diamond') { c.moveTo(x, y - e * 0.56); c.lineTo(x + e * 0.4, y); c.lineTo(x, y + e * 0.56); c.lineTo(x - e * 0.4, y); }
  else if (kind === 'tri') { c.moveTo(x, y - e * 0.5); c.lineTo(x + e * 0.5, y + e * 0.4); c.lineTo(x - e * 0.5, y + e * 0.4); }
  else if (kind === 'heart') { c.moveTo(x, y + e * 0.48); c.bezierCurveTo(x - e * 0.75, y - e * 0.05, x - e * 0.38, y - e * 0.62, x, y - e * 0.2); c.bezierCurveTo(x + e * 0.38, y - e * 0.62, x + e * 0.75, y - e * 0.05, x, y + e * 0.48); }
  else { c.arc(x, y, e * 0.5, 0, 7); c.closePath(); c.fillStyle = '#cfeeff'; c.fill(); c.lineWidth = 1; c.stroke(); c.beginPath(); c.arc(x, y, e * 0.5 - 0.9, 3.5, 4.6); c.strokeStyle = '#fff'; c.lineWidth = 0.7; c.stroke(); return; }   // (the porthole)
  c.closePath(); c.fill(); c.stroke();
}
// A door's leaf in its own room (its top left at 0, 0), shut and face on.
function leafArt(c, n, w, h) {
  const d = DES[n], line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  c.strokeStyle = d.dk; c.lineWidth = 0.7; c.lineCap = 'round';
  if (n === 0) { c.strokeRect(w * 0.16, h * 0.1, w * 0.68, h * 0.34); c.strokeRect(w * 0.16, h * 0.54, w * 0.68, h * 0.36); emblem(c, d.em, w / 2, h * 0.27, w * 0.46); }
  else if (n === 1) { for (const q of [0.27, 0.5, 0.73]) line(w * q, h * (q === 0.5 ? 0.04 : 0.1), w * q, h); emblem(c, d.em, w / 2, h * 0.3, w * 0.5); }
  else if (n === 2) { c.strokeRect(w * 0.18, h * 0.52, w * 0.64, h * 0.38); emblem(c, d.em, w / 2, h * 0.27, w * 0.52); }
  else if (n === 3) { c.lineWidth = 1.5; line(w * 0.08, h * 0.16, w * 0.92, h * 0.16); line(w * 0.08, h * 0.86, w * 0.92, h * 0.86); line(w * 0.9, h * 0.18, w * 0.1, h * 0.84); c.lineWidth = 0.5; for (const q of [0.33, 0.66]) line(w * q, 0.8, w * q, h); emblem(c, d.em, w / 2, h * 0.5, w * 0.5); }
  else if (n === 4) { c.fillStyle = d.dk; for (const q of [0.3, 0.74]) { c.fillRect(0.4, h * q, w - 0.8, h * 0.07); c.fillStyle = '#dfe6ee'; for (const s of [0.18, 0.5, 0.82]) { c.beginPath(); c.arc(w * s, h * (q + 0.035), 0.55, 0, 7); c.fill(); } c.fillStyle = d.dk; } emblem(c, d.em, w / 2, h * 0.54, w * 0.44); }
  else { c.fillStyle = CREAM; c.strokeStyle = INK; c.lineWidth = 0.45; c.beginPath(); c.roundRect(w * 0.24, h * 0.6, w * 0.52, h * 0.07, 0.8); c.fill(); c.stroke(); emblem(c, d.em, w / 2, h * 0.3, w * 0.56); }
  c.fillStyle = '#e9edf2'; c.strokeStyle = INK; c.lineWidth = 0.45; c.beginPath(); c.arc(w * 0.85, h * 0.57, Math.max(0.8, w * 0.065), 0, 7); c.fill(); c.stroke();   // the knob
}
// A door whose foot's middle is at (x, y), in the tower's units: n its design, w its width; o: `st` (0 untried, 1 a dead
// end, 2 the way down), `open` (0 shut to 1 wide), `board` (the planks going on: 0 to 1, 1 or none: on), `glow` (the
// way down lit: 0 to 1).
function drawDoor(c, n, x, y, w, o) {
  const d = DES[n], h = V.dh, l = x - w / 2, top = y - h, st = o.st || 0, open = o.open || 0, glow = st === 2 ? (o.glow == null ? 1 : o.glow) : 0;
  topPath(c, d.top, l - 1.5, top - 1.5, w + 3, h + 1.5); c.fillStyle = '#f3e7cf'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.lineJoin = 'round'; c.stroke();   // the frame
  topPath(c, d.top, l, top, w, h); c.fillStyle = DARK; c.fill();                                                                                  // the dark beyond
  if (glow > 0) {                                                // the way down: lit green, an arrow in it
    c.save(); c.clip(); c.globalAlpha = glow; c.fillStyle = '#2f8f4c'; c.fillRect(l, top, w, h); c.fillStyle = '#58c06f'; c.beginPath(); c.ellipse(x, y, w * 0.62, h * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = CREAM; c.strokeStyle = INK; c.lineWidth = 0.7; c.lineJoin = 'round'; c.beginPath();
    const ax = x + w * 0.06, at = top + h * 0.3, ab = top + h * 0.8, aw = w * 0.13, hw = w * 0.3;
    c.moveTo(ax - aw, at); c.lineTo(ax + aw, at); c.lineTo(ax + aw, ab - hw); c.lineTo(ax + hw, ab - hw); c.lineTo(ax, ab); c.lineTo(ax - hw, ab - hw); c.lineTo(ax - aw, ab - hw); c.closePath(); c.fill(); c.stroke(); c.restore();
  } else if (open > 0.05) { c.save(); c.clip(); c.fillStyle = '#3a2b55'; c.beginPath(); c.moveTo(l, y); c.lineTo(l + w * 0.3, y - h * 0.16); c.lineTo(l + w * 0.7, y - h * 0.16); c.lineTo(l + w, y); c.fill(); c.restore(); }   // (a floor going off into the dark)
  topPath(c, d.top, l, top, w, h); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
  const th = Math.min(1.83, open * 1.83), cs = Math.cos(th);     // the leaf, swung about its hinge on the left: narrower as it comes round, its back once past square on
  c.save(); c.translate(l, top); c.scale(cs, 1); topPath(c, d.top, 0, 0, w, h); c.restore();
  c.fillStyle = cs < 0 ? d.dk : d.col; c.fill();
  if (cs > 0.3) { c.save(); c.translate(l, top); c.scale(cs, 1); topPath(c, d.top, 0, 0, w, h); c.clip(); leafArt(c, n, w, h); if (st === 1) { c.fillStyle = 'rgba(35,26,53,.42)'; c.fillRect(0, 0, w, h); } c.restore(); }
  if (th > 0.05) { c.save(); c.translate(l, top); c.scale(cs, 1); topPath(c, d.top, 0, 0, w, h); c.restore(); c.fillStyle = `rgba(22,18,16,${(0.3 * Math.sin(th)).toFixed(3)})`; c.fill(); }   // (in shade as it turns)
  c.save(); c.translate(l, top); c.scale(cs, 1); topPath(c, d.top, 0, 0, w, h); c.restore(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  if (th > 0.25) { const ex = l + w * cs, e = 1.1 * Math.sin(th); c.fillStyle = d.dk; c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.rect(ex - (cs < 0 ? 0 : e), top + (d.top === 'sq' ? 0.4 : w * 0.3), e, h - (d.top === 'sq' ? 0.4 : w * 0.3)); c.fill(); c.stroke(); }   // (its edge, towards us)
  if (st === 1) {                                                // a dead end: two planks nailed across and a no-way sign (swinging with the leaf, should a runner burst out of it)
    const b = o.board == null ? 1 : o.board, part = (t0, t1) => clamp01((b - t0) / (t1 - t0));
    c.save(); if (th > 0.02) { c.translate(l, 0); c.scale(Math.max(0.12, Math.abs(cs)) * (cs < 0 ? -1 : 1), 1); c.translate(-l, 0); }
    [[0.27, -0.13, part(0, 0.42)], [0.7, 0.11, part(0.3, 0.72)]].forEach(([q, rot, u], k) => {
      if (u <= 0) return;
      const f = 1 - back(u);
      c.save(); c.translate(x + f * (k ? -15 : 15), top + h * q - f * 12); c.rotate(rot + f * (k ? -0.9 : 0.9)); c.scale(1 + f * 0.3, 1 + f * 0.3);
      c.fillStyle = '#e8c998'; c.strokeStyle = INK; c.lineWidth = 0.7; c.beginPath(); c.rect(-w / 2 - 2.6, -2.2, w + 5.2, 4.4); c.fill(); c.stroke();
      c.strokeStyle = '#c9a36c'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-w / 2 - 1, -0.5); c.lineTo(w / 2, -0.7); c.moveTo(-w / 2, 0.9); c.lineTo(w / 2 + 1.4, 0.7); c.stroke();
      c.fillStyle = INK; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * (w / 2 + 0.9), 0, 0.55, 0, 7); c.fill(); }
      c.restore();
    });
    const u = part(0.62, 1);
    if (u > 0) { const g = back(u), r = Math.min(4.6, w * 0.3) * g; c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.arc(x, top + h * 0.485, r, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.roundRect(x - r * 0.62, top + h * 0.485 - r * 0.2, r * 1.24, r * 0.4, 0.3); c.fill(); }
    c.restore();
  }
}
// A door that stands still, as a picture: painted once at the layer's scale (its frame's margin with it).
function doorSprite(n, w, st, open, scale) {
  const key = `${n}:${w.toFixed(2)}:${st}:${open}:${scale.toFixed(3)}`;
  let s = sprites.get(key);
  if (!s) {
    const m = 8, sw = w + 2 * m, sh = V.dh + m + 1, cv = document.createElement('canvas');
    cv.width = Math.ceil(sw * scale); cv.height = Math.ceil(sh * scale);
    const c = cv.getContext('2d'); c.scale(scale, scale); drawDoor(c, n, m + w / 2, V.dh + m, w, { st, open });
    s = { cv, m, sw, sh }; sprites.set(key, s); if (sprites.size > 80) sprites.delete(sprites.keys().next().value);
  }
  return s;
}

// ---------- the drawing: the tower's still parts ----------
function bricks(c, x, y, w, h, teeth) {                           // a wall of bricks (teeth: -1 or 1, the side its cut edge is on)
  c.fillStyle = '#c9a27c'; c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(90,58,34,.55)'; c.lineWidth = 0.35; c.beginPath();
  for (let r = 0, yy = y; yy < y + h; r++, yy += 3.1) { c.moveTo(x, yy); c.lineTo(x + w, yy); const off = r % 2 ? w * 0.5 : w * 0.18; c.moveTo(x + off, yy); c.lineTo(x + off, Math.min(y + h, yy + 3.1)); }
  c.stroke();
  c.fillStyle = '#b98d66'; for (let r = 0, yy = y; yy < y + h - 3; r++, yy += 3.1) if (r % 2 === 0) { const tx = teeth > 0 ? x + w : x - 1.3; c.fillRect(tx, yy, 1.3, 3.1); c.strokeStyle = INK; c.lineWidth = 0.5; c.strokeRect(tx, yy, 1.3, 3.1); }   // (the cut: every other course stands proud)
  c.strokeStyle = INK; c.lineWidth = 1.1; c.strokeRect(x, y, w, h);
}
function room(c, mini, r) {                                    // floor r's room, its slab under it and its doors, all shut
  const L = doorsLook(mini, r), R = ROOMS[L.room], y0 = r * V.fh, fy = floorY(r), k = mini.d[r], w = doorW(k), wn = 15;
  c.save(); c.beginPath(); c.rect(0, y0, V.tw, V.fh - V.slab); c.clip();
  c.fillStyle = R.bg; c.fillRect(0, y0, V.tw, V.fh);
  c.fillStyle = R.pt; c.strokeStyle = R.pt; c.lineWidth = 0.7;
  if (L.pat === 0) for (let x = 3; x < V.tw; x += 7) c.fillRect(x, y0, 2.6, V.fh);
  else if (L.pat === 1) for (let j = 0, y = y0 + 3; y < fy - wn; j++, y += 5.5) for (let x = j % 2 ? 5.5 : 2; x < V.tw; x += 7) { c.beginPath(); c.arc(x, y, 1, 0, 7); c.fill(); }
  else if (L.pat === 2) { c.beginPath(); for (let x = -60; x < V.tw + 60; x += 9) { c.moveTo(x, y0); c.lineTo(x + 60, y0 + 60); c.moveTo(x + 60, y0); c.lineTo(x, y0 + 60); } c.stroke(); }
  else for (let j = 0, y = y0 + 4; y < fy - wn; j++, y += 8) for (let x = j % 2 ? 9 : 4; x < V.tw; x += 10) { c.beginPath(); c.moveTo(x, y - 1.6); c.lineTo(x + 1.4, y); c.lineTo(x, y + 1.6); c.lineTo(x - 1.4, y); c.fill(); }
  c.fillStyle = R.wn; c.fillRect(0, fy - wn, V.tw, wn);            // the panelling, its rail and its grooves
  c.strokeStyle = 'rgba(22,18,16,.22)'; c.lineWidth = 0.4; c.beginPath(); for (let x = 2.5; x < V.tw; x += 5) { c.moveTo(x, fy - wn + 1.6); c.lineTo(x, fy); } c.stroke();
  c.fillStyle = '#fffaf0'; c.fillRect(0, fy - wn - 0.9, V.tw, 1.5); c.strokeStyle = INK; c.lineWidth = 0.45; c.strokeRect(-1, fy - wn - 0.9, V.tw + 2, 1.5);
  c.fillStyle = 'rgba(22,18,16,.13)'; c.fillRect(0, y0, V.tw, 2.6); c.fillStyle = 'rgba(22,18,16,.07)'; c.fillRect(0, y0, 2.4, V.fh); c.fillRect(V.tw - 2.4, y0, 2.4, V.fh);   // (the ceiling's and the walls' shade)
  for (let i = 0; i + 1 < k; i += 2) {                             // lamps between the doors, and their light
    const x = (doorX(k, i) + doorX(k, i + 1)) / 2;
    c.fillStyle = 'rgba(255,246,205,.34)'; c.beginPath(); c.moveTo(x - 2.4, y0 + 9.5); c.lineTo(x + 2.4, y0 + 9.5); c.lineTo(x + 9, fy); c.lineTo(x - 9, fy); c.fill();
    c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + 6); c.stroke();
    c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(x, y0 + 9.6, 1.5, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#4c5b6e'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - 1.4, y0 + 6); c.lineTo(x + 1.4, y0 + 6); c.lineTo(x + 3.2, y0 + 9.6); c.lineTo(x - 3.2, y0 + 9.6); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
  slab(c, r);
  for (let i = 0; i < k; i++) drawDoor(c, L.doors[i], doorX(k, i), fy, w, {});
}
function slab(c, r) {                                             // the boards floor r stands on: their top, their ends towards us
  const fy = floorY(r);
  c.fillStyle = '#a8713d'; c.fillRect(0, fy, V.tw, V.slab); c.fillStyle = '#dcab70'; c.fillRect(0, fy, V.tw, 2);
  c.strokeStyle = 'rgba(22,18,16,.4)'; c.lineWidth = 0.35; c.beginPath(); for (let x = 6.25; x < V.tw; x += 12.5) { c.moveTo(x, fy + 2); c.lineTo(x, fy + V.slab); } c.stroke();
  c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, fy + 2); c.lineTo(V.tw, fy + 2); c.stroke(); c.lineWidth = 0.9; c.strokeRect(0, fy, V.tw, V.slab);
}
const EXIT = { w: 25, h: 39 };
function exitDoor(c, F, open) {                                   // the way out, on the ground floor: two leaves under an arch, daylight beyond
  const x = V.tw / 2, fy = floorY(F), l = x - EXIT.w / 2, top = fy - EXIT.h;
  topPath(c, 'arch', l - 2, top - 2, EXIT.w + 4, EXIT.h + 2); c.fillStyle = '#f3e7cf'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  topPath(c, 'arch', l, top, EXIT.w, EXIT.h); c.save(); c.clip();
  c.fillStyle = '#bfe6fa'; c.fillRect(l, top, EXIT.w, EXIT.h); c.fillStyle = '#fff7c9'; c.beginPath(); c.arc(x + 5, top + 12, 5, 0, 7); c.fill();   // the sky, the sun, a hill and the path
  c.fillStyle = '#8fce6f'; c.beginPath(); c.ellipse(x - 4, fy + 2, EXIT.w * 0.8, 16, 0, 0, 7); c.fill(); c.fillStyle = '#ecd9a8'; c.beginPath(); c.moveTo(x - 5, fy); c.lineTo(x + 5, fy); c.lineTo(x + 1.5, fy - 12); c.lineTo(x - 1, fy - 12); c.fill();
  const cs = Math.cos(Math.min(1.75, open * 1.75));
  for (const s of [-1, 1]) {                                     // the leaves, hinged at the jambs
    const hx = s < 0 ? l : l + EXIT.w, lw = (EXIT.w / 2) * cs;
    c.fillStyle = cs < 0 ? '#57708a' : '#7790ab'; c.fillRect(s < 0 ? hx : hx - lw, top, lw, EXIT.h); c.strokeStyle = INK; c.lineWidth = 0.7; c.strokeRect(s < 0 ? hx : hx - lw, top, lw, EXIT.h);
    if (cs > 0.4) { const gx = (s < 0 ? hx : hx - lw) + lw * 0.2; c.fillStyle = '#d6f0fb'; c.fillRect(gx, top + 9, lw * 0.6, 12); c.strokeRect(gx, top + 9, lw * 0.6, 12); c.strokeRect(gx, top + 25, lw * 0.6, 10); c.fillStyle = '#e9edf2'; c.beginPath(); c.arc(s < 0 ? hx + lw - 1.6 : hx - lw + 1.6, top + 23, 0.8, 0, 7); c.fill(); c.stroke(); }
  }
  c.restore();
  topPath(c, 'arch', l, top, EXIT.w, EXIT.h); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
}
function lobby(c, mini) {                                      // the ground floor: tiles, plants, the way out under a checkered pennant
  const F = mini.f, y0 = F * V.fh, fy = floorY(F);
  c.fillStyle = '#fbf3df'; c.fillRect(0, y0, V.tw, V.fh - V.slab);
  c.fillStyle = '#efe2c4'; for (let x = 4; x < V.tw; x += 12) c.fillRect(x, y0, 4, V.fh - V.slab);
  c.fillStyle = 'rgba(22,18,16,.13)'; c.fillRect(0, y0, V.tw, 2.6); c.fillStyle = 'rgba(22,18,16,.07)'; c.fillRect(0, y0, 2.4, V.fh); c.fillRect(V.tw - 2.4, y0, 2.4, V.fh);
  for (let i = 0, x = 0; x < V.tw; i++, x += 5) { c.fillStyle = i % 2 ? '#3b3350' : '#fff'; c.fillRect(x, fy - 2.6, 5, 2.6); }   // a tiled strip along the floor
  c.strokeStyle = INK; c.lineWidth = 0.5; c.strokeRect(-1, fy - 2.6, V.tw + 2, 2.6);
  c.fillStyle = '#b9b4ab'; c.fillRect(0, fy, V.tw, V.slab); c.fillStyle = '#d6d2c9'; c.fillRect(0, fy, V.tw, 2);   // the stone it stands on
  c.strokeStyle = 'rgba(22,18,16,.4)'; c.lineWidth = 0.35; c.beginPath(); for (let x = 10; x < V.tw; x += 20) { c.moveTo(x, fy + 2); c.lineTo(x, fy + V.slab); } c.stroke(); c.strokeStyle = INK; c.lineWidth = 0.9; c.strokeRect(0, fy, V.tw, V.slab);
  exitDoor(c, F, 0);
  const px = V.tw / 2, py = fy - EXIT.h - 4;                      // the pennant over the arch
  c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(px - 9, py - 5); c.lineTo(px + 9, py - 5); c.stroke();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : INK; c.fillRect(px - 9 + i * 3, py - 5 + j * 2.6, 3, 2.6); } c.strokeRect(px - 9, py - 5, 18, 5.2);
  for (const x of [22, V.tw - 22]) {                              // two hanging baskets (overhead: a runner lands anywhere along the floor)
    c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x - 3.4, y0 + 9); c.lineTo(x, y0); c.lineTo(x + 3.4, y0 + 9); c.stroke();
    c.fillStyle = '#4fa565'; c.lineWidth = 0.6; for (const [dx, dy, rr] of [[-3.6, 8, 3.2], [3.6, 8.4, 3.4], [0, 6, 4], [-2, 12.6, 2.2], [2.6, 13.4, 2]]) { c.beginPath(); c.arc(x + dx, y0 + dy, rr, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = '#8c6a9c'; c.beginPath(); c.moveTo(x - 4.6, y0 + 9); c.lineTo(x + 4.6, y0 + 9); c.lineTo(x + 3, y0 + 13.4); c.lineTo(x - 3, y0 + 13.4); c.closePath(); c.fill(); c.stroke();
  }
}
function roof(c) {                                                // the roof: a chimney behind it, shingles, the attic's window, the eaves, the pole
  const l = -V.wall - V.eave, rgt = V.tw + V.wall + V.eave, mid = V.tw / 2;
  bricks(c, 76, -30, 9, 20, 0); c.fillStyle = '#b9b4ab'; c.strokeStyle = INK; c.lineWidth = 0.8; c.fillRect(74.6, -32.4, 11.8, 3); c.strokeRect(74.6, -32.4, 11.8, 3);
  c.beginPath(); c.moveTo(l, 0); c.lineTo(mid, -V.roof); c.lineTo(rgt, 0); c.closePath(); c.fillStyle = '#5d6fa8'; c.fill();
  c.save(); c.clip(); c.strokeStyle = '#43528a'; c.lineWidth = 0.6; c.beginPath();
  for (let j = 0, y = -V.roof + 3; y < 2; j++, y += 5.4) for (let x = l + (j % 2 ? 4 : 0); x < rgt + 8; x += 8) { c.moveTo(x - 4, y); c.arc(x, y, 4, Math.PI, 0, true); }   // (rows of round-ended shingles)
  c.stroke(); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(l, 0); c.lineTo(mid, -V.roof); c.lineTo(mid, 0); c.fill(); c.restore();
  c.beginPath(); c.moveTo(l, 0); c.lineTo(mid, -V.roof); c.lineTo(rgt, 0); c.closePath(); c.strokeStyle = INK; c.lineWidth = 1.2; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = DARK; c.beginPath(); c.arc(mid, -12.5, 5.2, 0, 7); c.fill(); c.strokeStyle = '#f3e7cf'; c.lineWidth = 1.6; c.stroke(); c.lineWidth = 0.7; c.beginPath(); c.moveTo(mid - 5, -12.5); c.lineTo(mid + 5, -12.5); c.moveTo(mid, -17.5); c.lineTo(mid, -7.5); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 0.7; c.beginPath(); c.arc(mid, -12.5, 6, 0, 7); c.stroke();
  c.fillStyle = '#f3e7cf'; c.fillRect(l, -1.6, rgt - l, 3.2); c.lineWidth = 0.9; c.strokeRect(l, -1.6, rgt - l, 3.2);
  c.lineWidth = 1; c.lineCap = 'round'; c.beginPath(); c.moveTo(mid, -V.roof); c.lineTo(mid, -V.roof - V.top + 2.4); c.stroke(); c.fillStyle = '#e9edf2'; c.beginPath(); c.arc(mid, -V.roof - V.top + 2, 1.4, 0, 7); c.fill(); c.lineWidth = 0.6; c.stroke();
}
// The tower's still parts as one picture, painted once for a square at a scale (the towers of a race are built the
// same: one picture for both): from its top left at (-wall - PAD, -roof - top) in the tower's units.
function towerLayer(mini, scale) {
  const key = `${mini.look || 0}:${mini.f}:${mini.d.join('')}:${scale.toFixed(3)}`;
  if (layer && layer.key === key) return layer;
  const x0 = -V.wall - PAD, y0 = -V.roof - V.top, w = TOWER + 2 * PAD, h = (mini.f + 1) * V.fh - y0 + 2, cv = document.createElement('canvas');
  cv.width = Math.ceil(w * scale); cv.height = Math.ceil(h * scale);
  const c = cv.getContext('2d'), yG = (mini.f + 1) * V.fh;
  c.scale(scale, scale); c.translate(-x0, -y0);
  for (const [bx, s] of [[-V.wall - 5, 1], [V.tw + V.wall + 5, -1]]) { c.fillStyle = '#58b06a'; c.strokeStyle = INK; c.lineWidth = 0.7; for (const [dx, rr] of [[-2.4 * s, 3.4], [1.6 * s, 4.4]]) { c.beginPath(); c.arc(bx + dx, yG - rr * 0.7, rr, 0, 7); c.fill(); c.stroke(); } }   // bushes at its foot
  roof(c);
  for (let r = 0; r < mini.f; r++) room(c, mini, r);
  lobby(c, mini);
  bricks(c, -V.wall, 0, V.wall, yG, 1); bricks(c, V.tw, 0, V.wall, yG, -1);
  for (let r = 0; r < mini.f; r++) { const y = r * V.fh + 20;   // each floor's number (how many floors above the ground), on a plate on the wall
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.roundRect(-V.wall + 0.8, y, V.wall - 1.6, 7.4, 1.2); c.fill(); c.stroke(); c.fillStyle = INK; c.font = '400 6px Bangers, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(mini.f - r), -V.wall / 2, y + 4.1); }
  layer = { key, cv, x0, y0, w: cv.width / scale, h: cv.height / scale, scale };   // (its size as painted: drawn a pixel for a pixel in the close view)
  return layer;
}
// The sky behind it all is the page's own (the canvas is clear where nothing is drawn): the box's gradient and
// halftone (styles.css .ddsq) and three clouds.
const CLOUD = '<path d="M9 22a8 8 0 0 1-1-16 10 10 0 0 1 18-3 8.5 8.5 0 0 1 12 6 6.5 6.5 0 0 1-1 13z"/>';
const SKY = [1, 2, 3].map(n => `<svg class="ddcl c${n}" viewBox="-2 -9 46 34" aria-hidden="true">${CLOUD}</svg>`).join('');

// ---------- the drawing: what moves ----------
// A runner whose feet are at (x, y), in the tower's units: its player's disc with the drawn mark and a pair of eyes,
// on two legs that step (o.walk: the steps taken), leaning the way it goes (o.face).
function runner(c, C, p, x, y, o) {
  const r = V.rr, leg = V.leg, sc = o.sc == null ? 1 : o.sc, sq = o.sq || 0, face = o.face || 1, ph = (o.walk || 0) * Math.PI, air = !!o.air, lift = o.lift || 0;
  if (!(o.al == null || o.al > 0.01)) return;
  c.save(); c.globalAlpha = o.al == null ? 1 : o.al;
  if (!o.inside) { c.fillStyle = `rgba(22,18,16,${(0.2 * Math.max(0.3, 1 - lift / 20)).toFixed(3)})`; c.beginPath(); c.ellipse(x, y + 0.5, r * 0.95 * sc * Math.max(0.5, 1 - lift / 40), 1.5, 0, 0, 7); c.fill(); }   // its shadow, on the floor
  c.translate(x, y - lift); c.scale(sc * (1 + 0.24 * sq), sc * (1 - 0.24 * sq));
  const cy = -leg - r, sw = Math.sin(ph), col = p === 'O' ? C.O : C.X;
  c.save(); c.translate(0, cy); c.rotate((o.rot || 0) + (o.walk && !air ? face * 0.07 * Math.abs(Math.cos(ph)) : 0)); c.translate(0, -cy);
  c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = 1.5;
  for (const s of [-1, 1]) {                                     // the legs and the shoes
    const fx = air ? s * 2.8 : s * 1.9 + s * sw * 3.4 * face, fy = air ? -1.2 - (s > 0 ? 1.1 : 0) : -Math.max(0, s * Math.cos(ph)) * 2;   // (one foot forward as the other goes back, the one coming forward lifted)
    c.beginPath(); c.moveTo(s * 2, -leg - 1); c.lineTo(fx, fy - 1); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.ellipse(fx + face * 0.9, fy - 0.8, 2.3, 1.25, 0, 0, 7); c.fill();
  }
  if (o.arms > 0.02) for (const s of [-1, 1]) {                   // the arms, thrown up
    const a = -Math.PI / 2 + s * (1.35 - 0.75 * o.arms), hx = Math.cos(a) * (r + 3.4), hy = cy + Math.sin(a) * (r + 3.4);
    c.lineWidth = 1.3; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = col; c.lineWidth = 0.6; c.beginPath(); c.arc(hx, hy, 1.5, 0, 7); c.fill(); c.stroke();
  }
  c.fillStyle = col; c.lineWidth = 1; c.beginPath(); c.arc(0, cy, r, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, cy, r - 1.5, Math.PI * 1.08, Math.PI * 1.42); c.stroke(); c.strokeStyle = INK;   // (a glint)
  c.strokeStyle = p === 'O' ? INK : '#fff'; c.lineWidth = 1.7; c.beginPath();
  if (p === 'X') { c.moveTo(-r * 0.4, cy + r * 0.06); c.lineTo(r * 0.4, cy + r * 0.66); c.moveTo(r * 0.4, cy + r * 0.06); c.lineTo(-r * 0.4, cy + r * 0.66); } else c.arc(0, cy + r * 0.38, r * 0.3, 0, 7);
  c.stroke();
  for (const s of [-1, 1]) {                                     // the eyes, looking the way it goes
    const ex = s * 2.5 + face * 0.9, ey = cy - r * 0.3;
    if (o.dizzy > 0.4) { c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.arc(ex, ey, 1.5, 0, 5); c.arc(ex, ey, 0.6, 5, 9); c.stroke(); continue; }
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.ellipse(ex, ey, 1.75, sq > 0.3 ? 0.9 : 2.2, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.ellipse(ex + face * 0.6, ey + 0.2, 0.8, sq > 0.3 ? 0.6 : 1.2, 0, 0, 7); c.fill();
  }
  c.restore(); c.restore();
}
function star(c, x, y, r, rot, col) { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col || '#fff'; c.strokeStyle = INK; c.lineWidth = 0.5; c.lineJoin = 'round'; c.beginPath(); for (let q = 0; q < 10; q++) { const rr = q % 2 ? r * 0.45 : r, an = q * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
function burst(c, x, y, u, r, col) {                              // a comic burst about (x, y): out fast, then fading
  const n = 11, g = r * (0.45 + 0.55 * Math.min(1, u * 3.2));
  c.save(); c.translate(x, y); c.rotate(0.2); c.globalAlpha = u < 0.6 ? 1 : Math.max(0, (1 - u) / 0.4);
  for (const [k, f] of [[1, '#fff'], [0.62, col]]) { c.beginPath(); for (let q = 0; q < n * 2; q++) { const a = q * Math.PI / n + (k < 1 ? 0.18 : 0), d = g * k * (q % 2 ? 0.6 : 0.9 + (q % 3) * 0.06); c.lineTo(Math.cos(a) * d, Math.sin(a) * d); } c.closePath(); c.fillStyle = f; c.fill(); if (k === 1) { c.strokeStyle = INK; c.lineWidth = 0.9; c.lineJoin = 'round'; c.stroke(); } }
  c.restore();
}
function puffs(c, x, y, u, spread) { c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 0.5; c.globalAlpha = Math.max(0, 1 - u); for (const s of [-1, 1]) for (const [d, h, r] of [[1, 0.6, 2.4], [1.7, 1.8, 1.7]]) { c.beginPath(); c.arc(x + s * (V.rr * 0.7 + spread * d * u), y - h - 2.4 * u * h, r * (0.6 + 0.7 * u), 0, 7); c.fill(); c.stroke(); } c.globalAlpha = 1; }
function pennant(c, C, p, y, dir) {                               // a tower's pennant on its pole, in its owner's colour with their mark
  const x = V.tw / 2, s = dir || 1;
  c.fillStyle = p === 'O' ? C.O : C.X; c.strokeStyle = INK; c.lineWidth = 0.7; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + s * 13, y + 3.4); c.lineTo(x, y + 6.8); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = p === 'O' ? INK : '#fff'; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath();
  if (p === 'X') { c.moveTo(x + s * 2.4, y + 2); c.lineTo(x + s * 5.2, y + 4.8); c.moveTo(x + s * 5.2, y + 2); c.lineTo(x + s * 2.4, y + 4.8); } else c.arc(x + s * 3.9, y + 3.4, 1.5, 0, 7);
  c.stroke();
}
// What is known of floor r's links: a dotted arrow over the doors, from each dead end tried to the door it came out of.
function links(c, mini, r, skip) {
  const row = mini.seen ? mini.seen[r] : null; if (!row) return;
  const k = mini.d[r], w = doorW(k), top = floorY(r) - V.dh - 2.4;
  for (let i = 0; i < k; i++) {
    const j = row[i]; if (!(j >= 0) || skip === i) continue;
    const x0 = doorX(k, i), x1 = doorX(k, j), s = x1 > x0 ? 1 : -1, hgt = Math.min(15, 5 + Math.abs(x1 - x0) * 0.2), a = x0 + s * w * 0.18, b = x1 - s * w * 0.18;
    const curve = () => { c.beginPath(); c.moveTo(a, top); c.quadraticCurveTo((a + b) / 2, top - hgt * 2, b, top - 0.6); };
    c.lineCap = 'round'; c.setLineDash([]); curve(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.3; c.stroke();
    c.setLineDash([0.1, 2.5]); curve(); c.strokeStyle = INK; c.lineWidth = 1.15; c.stroke(); c.setLineDash([]);
    const ang = Math.atan2(hgt * 2, (b - a) / 2);                // the arrow's head, at the door it comes out of
    c.save(); c.translate(b, top - 0.4); c.rotate(ang); c.fillStyle = INK; c.strokeStyle = '#fff'; c.lineWidth = 0.5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(1.2, 0); c.lineTo(-3.4, -2.3); c.lineTo(-2.3, 0); c.lineTo(-3.4, 2.3); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
}

const go = stage('canvas.ddcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a } = src, C = runColours(), F = mini.f, dpr = c.getTransform().a || 1;
  seen = { W, H };
  if (pend && (now > pend.till || pend.sq !== src.zoom || a)) pend = null;
  // the move on show: T ms into its picture (the intro, then the move: someone else's from the intro, this phone's own
  // from the walk), tm into the move itself
  const s0 = a ? a.dd : null, pl = a ? playOf(a) : null, pre = a ? preOf(a) : 0;
  let T = 0;
  if (a) { const at = fxAt('move', a); T = at == null || REDUCED ? Infinity : now - at + pl.lead; }   // (reduced motion: the move's end at once)
  const tm = a ? T - pre : pend ? Math.min(DOORS.walk - 1, (now - pend.t0) * moveRate('doors')) : -1;
  const sm = a ? s0 : pend && pend.r === mini.at[pend.by] ? { r: pend.r, i: pend.i, down: false, out: pend.i, from: mini.pos[pend.by] } : null, by = a ? a.by : pend ? pend.by : null;
  const s = sm ? Object.assign({}, sm, { ix: doorX(mini.d[sm.r], sm.i), ox: sm.down ? 0 : doorX(mini.d[sm.r], sm.out) }) : null;
  const total = a ? (s.down ? doorsDownMs() + (s.r + 1 >= F ? DOORS.win : 0) : doorsDeadMs()) : 0;
  const pose = s ? doorsPose(s, Math.max(0, a ? Math.min(tm, total) : tm), F) : null;
  // the camera: the mover's floor; the intro first (someone else's move: in its picture; this phone's own turn: from
  // the moment the square is in place, in the interface's time); the wide shot while someone else's turn is to come
  const wide = wideView(mini, W, H), zooms = camZooms(mini, W, H), who = by || src.focus, fl = pose && a ? pose.cf : Math.min(F, mini.at[who]);
  const close = closeView(mini, who, fl, W, H);
  let it = null, iid = null;
  if (a && pl.intro) { if (T < PRE) { it = T; iid = a; } }
  else if (!a && src.intro) {
    const r = src.intro;
    if (r.t0 == null && !mmIntro && !explainT) r.t0 = now + zoomBusy();
    it = r.cut || !introOk() || !zooms ? Infinity : r.t0 == null ? -1 : (now - r.t0) * durRate('ui'); iid = r;
  }
  src.it = it;
  const zooming = it != null && it >= DOORS.wide && it < PRE;
  const goal = it != null ? (it < DOORS.wide ? wide : close) : !a && !pend && ((src.wait && introOk() && zooms) || src.view) ? wide : close;
  if (!cam || cam.sq !== src.zoom || cam.vis !== src.vis || cam.W !== W || cam.H !== H) cam = { cx: goal.cx, cy: goal.cy, w: goal.w, t: now, sq: src.zoom, vis: src.vis, W, H, zid: null, zf: null, snap: false, fresh: true };
  if (zooming) {                                                    // the intro's zoom: an exact curve, from where the camera was as it began
    if (cam.zid !== iid) { cam.zid = iid; cam.zf = cam.fresh ? wide : { cx: cam.cx, cy: cam.cy, w: cam.w }; }
    const v = viewAt(cam.zf, close, easeStd((it - DOORS.wide) / DOORS.zoom)); cam.cx = v.cx; cam.cy = v.cy; cam.w = v.w;
  } else {                                                          // anything else: eased there (at once with reduced motion, or a touch that cut the intro)
    const u = REDUCED || cam.snap ? 1 : Math.min(1, (now - cam.t) / V.ease);
    cam.cx += (goal.cx - cam.cx) * u; cam.cy += (goal.cy - cam.cy) * u; cam.w += (goal.w - cam.w) * u;
    if (Math.abs(goal.cx - cam.cx) < 0.15 && Math.abs(goal.cy - cam.cy) < 0.15 && Math.abs(goal.w - cam.w) < 0.15) { cam.cx = goal.cx; cam.cy = goal.cy; cam.w = goal.w; }
  }
  cam.t = now; cam.snap = false; cam.fresh = false;
  const settled = cam.cx === goal.cx && cam.cy === goal.cy && cam.w === goal.w;
  const k = W / cam.w, X = x => (x - cam.cx) * k + W / 2, Y = y => (y - cam.cy) * k + H / 2;
  // the sky, the ground
  c.clearRect(0, 0, W, H);
  const gy = Y((F + 1) * V.fh);
  if (gy < H) { c.fillStyle = '#8fce6f'; c.fillRect(0, gy, W, H - gy + 1); c.fillStyle = '#7dbb5e'; c.fillRect(0, gy + 4 * k, W, H); c.strokeStyle = INK; c.lineWidth = Math.max(1.5, 1.1 * k); c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }
  // the towers
  const L = towerLayer(mini, (W / V.view) * dpr), towers = mini.sep ? ['X', 'O'] : ['S'];
  let more = false;
  for (const tw of towers) {
    const ox = tw === 'O' ? STRIDE : 0, left = X(ox + L.x0), right = X(ox + L.x0 + L.w);
    if (right < 0 || left > W) continue;
    if (Math.abs(k * dpr - L.scale) < 1e-4) c.drawImage(L.cv, Math.round(left * dpr) / dpr, Math.round(Y(L.y0) * dpr) / dpr, L.cv.width / dpr, L.cv.height / dpr);   // (the close view: a pixel for a pixel)
    else c.drawImage(L.cv, left, Y(L.y0), L.w * k, L.h * k);
    c.save(); c.translate(X(ox), Y(0)); c.scale(k, k);
    const mover = !!s && (tw === 'S' || by === tw), tr = tw === 'S' ? mini.tried : mini.tried[tw], y0v = (0 - Y(0)) / k, y1v = (H - Y(0)) / k;
    if (tw === 'S') { pennant(c, C, 'X', -V.roof - V.top + 3.4, 1); pennant(c, C, 'O', -V.roof - V.top + 3.4, -1); } else pennant(c, C, tw, -V.roof - V.top + 3.4, tw === 'X' ? 1 : -1);
    for (let r = 0; r < F; r++) {
      if ((r + 1) * V.fh < y0v || r * V.fh - 4 > y1v) continue;
      const kk = mini.d[r], w = doorW(kk), look = doorsLook(mini, r), fy = floorY(r), ex = doorsExits(mini, r), act = mover && s.r === r;
      const tap = src.myTurn && !a && !pend && (tw === 'S' || tw === src.turn) && mini.at[src.turn] === r && settled && (it == null || it >= PRE);
      for (let i = 0; i < kk; i++) {
        let st = tr[r][i] || 0, open = st === 2 ? 1 : 0, o = null;
        const x = doorX(kk, i);
        if (act && i === s.i && a) { const m = pose.mark; o = { st: m ? st : 0, open: s.down && m ? Math.max(pose.open, 0.2) : pose.open, board: s.down ? 1 : pose.board, glow: pose.glow }; if (!s.down && m && pose.board <= 0) o.st = 0; }
        else if (act && !s.down && i === s.out && a) o = { st, open: Math.max(pose.openOut, st === 2 ? 1 : 0, pose.mark && tm >= total ? 0.1 : 0) };
        else if (!st && ex[i] && !(act && a && !pose.mark && mini.seen && mini.seen[r][s.i] === i)) open = 0.1;   // (a door a runner came out of stands ajar)
        if (o) { c.save(); if (i === s.i && pose.shake) c.translate(pose.shake * 0.7, 0); drawDoor(c, look.doors[i], x, fy, w, o); c.restore(); }
        else if (st || open) { const sp = doorSprite(look.doors[i], w, st, open, L.cv.width / L.w); c.drawImage(sp.cv, x - w / 2 - sp.m, fy - V.dh - sp.m, sp.sw, sp.sh); }
        if (tap && st !== 1) { const d = DES[look.doors[i]], g = Math.min(3.2, (V.tw / kk - w) / 2 - 0.5); topPath(c, d.top, x - w / 2 - g, fy - V.dh - g, w + 2 * g, V.dh + g); c.strokeStyle = INK; c.lineWidth = 2.6; c.lineJoin = 'round'; c.stroke(); c.strokeStyle = src.turn === 'O' ? C.O : C.X; c.lineWidth = 1.5; c.stroke(); }   // (a door this phone can tap: ringed in its player's colour)
      }
      links(c, mini, r, act && a && !pose.mark ? s.i : -1);
      if (act && s.down && pose.hatch > 0.01) {                    // the trapdoor under the way down, giving way
        const hw = w * 0.56, hx = s.ix, hy = fy, g = Math.min(1.12, pose.hatch);
        c.fillStyle = DARK; c.fillRect(hx - hw, hy, hw * 2, V.slab); c.strokeStyle = INK; c.lineWidth = 0.7; c.strokeRect(hx - hw, hy, hw * 2, V.slab);
        for (const sd of [-1, 1]) { c.save(); c.translate(hx + sd * hw, hy + V.slab - 0.8); c.rotate(sd * -g * 1.45); c.fillStyle = '#a8713d'; c.beginPath(); c.rect(sd > 0 ? -hw : 0, -0.9, hw, 1.8); c.fill(); c.stroke(); c.restore(); }
      }
    }
    const downs = tw === 'S' ? ['X', 'O'] : [tw];                 // the way out: open once a runner is down
    const exit = mover && a && s.down && s.r + 1 >= F ? pose.exit : downs.some(p => mini.at[p] >= F) ? 1 : 0;
    if (exit > 0.01) exitDoor(c, F, exit);
    // the runners
    const same = tw === 'S' && mini.at.X === mini.at.O && Math.abs(mini.pos.X - mini.pos.O) < 16;
    for (const p of tw === 'S' ? ['X', 'O'] : [tw]) {
      if (s && by === p) continue;
      const f = Math.min(F, mini.at[p]), off = same ? (p === 'X' ? -V.rr * 0.95 : V.rr * 0.95) : 0;
      runner(c, C, p, mini.pos[p] + off, floorY(f), { arms: f >= F ? 1 : 0, face: p === 'X' ? 1 : -1 });
    }
    if (mover) {
      const fy = pose.y * V.fh - V.slab, w = doorW(mini.d[s.r]), dx = s.ix, dy = floorY(s.r);
      if (pose.burst >= 0) burst(c, dx, dy - V.dh * 0.55, pose.burst, V.dh * 0.95, '#bff0c8');
      if (pose.bang >= 0) { const bx = s.ox, u = pose.bang; burst(c, bx, dy - V.dh * 0.5, 0.25 + u * 0.75, V.dh * 0.78, '#ffe9a8'); }
      if (pose.party >= 0 && pose.party < 0.4) burst(c, pose.x, fy - V.leg - V.rr, pose.party / 0.4 * 0.95, V.fh * 0.5, '#ffe9a8');   // the win: a burst behind the dancer
      runner(c, C, by, pose.x, fy, pose);
      if (pose.party >= 0) {                                       // and confetti raining through the lobby
        const u = pose.party;
        for (let q = 0; q < 30; q++) { const hx = mix(q * 7 + 3) % 1000 / 1000, hv = mix(q * 13 + 5) % 1000 / 1000, cx = 2 + hx * (V.tw - 4), cyy = F * V.fh - 4 + (u * 1.7 - hv * 0.7) * V.fh; if (cyy < F * V.fh + 1 || cyy > fy) continue; c.save(); c.translate(cx + Math.sin(u * 9 + q) * 2.5, cyy); c.rotate(u * 8 + q); c.fillStyle = ['#2aa39b', '#8b5fd0', '#3f82d8', '#e57ab6', '#fff'][q % 5]; c.strokeStyle = INK; c.lineWidth = 0.4; c.fillRect(-1.9, -1.1, 3.8, 2.2); c.strokeRect(-1.9, -1.1, 3.8, 2.2); c.restore(); }
      }
      if (pose.dizzy > 0.05) for (let q = 0; q < 3; q++) { const an = now / 190 + q * 2.09; star(c, pose.x + Math.cos(an) * V.rr * 1.25, fy - V.leg - V.rr * 2.25 + Math.sin(an) * 1.6, 2.1 * pose.dizzy, an, '#fff'); }
      if (pose.dust >= 0 && pose.dust < 1) { puffs(c, pose.x, fy, pose.dust, 9); if (s.down) for (let q = 0; q < 5; q++) { const an = -Math.PI / 2 + (q - 2) * 0.5, d = 8 + 16 * pose.dust; star(c, pose.x + Math.cos(an) * d, fy - V.leg - V.rr + Math.sin(an) * d, 2.6 * (1 - pose.dust * 0.7), pose.dust * 3 + q, q % 2 ? '#bff0c8' : '#fff'); } }
      if (!s.down && pose.board > 0.3 && pose.board < 1) puffs(c, dx, dy - V.dh * (pose.board < 0.62 ? 0.7 : 0.3), clamp01((pose.board < 0.62 ? pose.board - 0.3 : pose.board - 0.62) / 0.3), 5);
    }
    c.restore();
  }
  if (pose && pose.dim > 0) { c.fillStyle = `rgba(24,14,36,${(0.3 * pose.dim).toFixed(3)})`; c.fillRect(0, 0, W, H); }   // the dark: the picture dims while the runner is inside
  if (a && Number.isFinite(T) && T < pre + total + 60) more = true;
  // a picture ahead of its flash's clock (this phone's own move: no intro; someone else's without it): the flash ends
  // as its picture does
  if (a && pl.lead > 0 && skipped !== a && Number.isFinite(T) && T >= pre + total + 40 && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }
  // where the door buttons sit: on the doors of the mover's floor once the camera is there; none before
  const box = c.canvas.parentElement, live = settled && (it == null || it >= PRE) && !pend;
  if (box) for (const b of box.querySelectorAll('.ddgo')) {
    if (!live) { if (b.style.visibility !== 'hidden') b.style.visibility = 'hidden'; continue; }
    const r = +b.dataset.r, kk = mini.d[r], w = doorW(kk), ox = towerX(mini, src.turn);
    b.style.left = `${X(ox + doorX(kk, +b.dataset.i) - w / 2 - 3).toFixed(1)}px`; b.style.top = `${Y(floorY(r) - V.dh - 3).toFixed(1)}px`;
    b.style.width = `${((w + 6) * k).toFixed(1)}px`; b.style.height = `${((V.dh + 3) * k).toFixed(1)}px`; b.style.visibility = 'visible';
  }
  return more || !!pend || zooming || (it != null && it < PRE) || !settled;
});

// ---------- the screen ----------
// A little map of a tower (a tally's, the miniature's): a row a floor, a block a door coloured by its mark, the
// runners as dots, the ground under it.
function mapSvg(mini, p, cls, all) {
  const tr = mini.sep ? mini.tried[p] : mini.tried, F = mini.f, who = all ? ['X', 'O'] : [p], RH = 3, R0 = 2.2, G = R0 + F * RH;
  let out = `<path class="ddmr" d="M-.2 ${R0}L5 .2L10.2 ${R0}Z"/><rect class="ddmf" x="0" y="${R0}" width="10" height="${F * RH + 1.6}"/>`;
  for (let r = 0; r < F; r++) {
    const k = mini.d[r], w = 9 / k;
    for (let i = 0; i < k; i++) out += `<rect class="ddmd s${tr[r][i] || 0}" x="${(0.5 + i * w + w * 0.14).toFixed(2)}" y="${(R0 + r * RH + 0.5).toFixed(2)}" width="${(w * 0.72).toFixed(2)}" height="2.3" rx=".35"/>`;
  }
  out += `<rect class="ddmg" x="0" y="${G}" width="10" height="1.6"/>`;
  who.forEach((q, n) => { const fl = Math.min(F, mini.at[q]), y = fl >= F ? G + 0.4 : R0 + fl * RH + 1.9, x = 0.5 + 9 * mini.pos[q] / 100 + (all && mini.at.X === mini.at.O && Math.abs(mini.pos.X - mini.pos.O) < 20 ? (n ? 0.9 : -0.9) : 0); out += tokSvg(q, x.toFixed(2), y.toFixed(2), 1.2); });
  return `<svg class="ddmap${cls ? ' ' + cls : ''}" viewBox="-0.6 -0.2 11.2 ${(G + 2).toFixed(1)}" aria-hidden="true">${out}</svg>`;
}
const WORD = ['Dead end!', 'Down a floor!', 'Ground floor!'];
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const s = a && a.dd ? a.dd : null, o = { view, locked, turn }, lead = s ? playOf(a).lead : 0, base = s ? preOf(a) - lead : 0;
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn;                        // whose tower the camera is on (the race)
  const myTurn = !s && !view && !locked && !d && !blocked() && mini.at[turn] < mini.f;          // this phone's own pick to make
  const tal = p => arcTally(p, o, mini.sep ? mapSvg(mini, p, 'sm') : pips(p, Math.min(mini.at[p], mini.f), mini.f, !!(s && s.down && a.by === p), Math.max(0, base + doorsDownMs())));
  const k = s ? (s.down ? (s.r + 1 >= mini.f ? 2 : 1) : 0) : -1;
  const line = s ? `<p ${lateAt('ddline ' + (k ? 'ok' : 'no'), Math.max(0, base + doorsSayAt(s)))} role="status">${WORD[k]}</p>` : '<p class="ddline"></p>';
  const btns = myTurn ? doorsMoves(mini, turn).map(i => `<button class="ddgo ${turn}" data-act="move" ${mv(i)} data-r="${mini.at[turn]}" data-i="${i}" aria-label="Door ${i + 1}"></button>`).join('') : '';
  src = { mini, a: s ? a : null, turn, focus: who, myTurn, view: !!view && !d, zoom: state.zoom, it: null, vis: fx.enter ? fx.enter.at : 0,
    intro: myTurn && !doorsCont(mini, turn) ? introFor(turn) : null,                             // (a pick going on from a way down: no intro again)
    wait: !s && !view && !d && !myTurn && mini.at[turn] < mini.f && !doorsCont(mini, turn) };   // (someone else's turn to come, or this one's held up: the wide shot)
  go();
  const at = p => (mini.at[p] >= mini.f ? 'on the ground' : `${mini.f - mini.at[p]} floor${mini.f - mini.at[p] === 1 ? '' : 's'} up`);
  return `<div class="g-dd pc-${who}${mini.sep ? ' sep' : ''}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="ddbox"><div class="ddsq">${SKY}<canvas class="ddcv" role="img" aria-label="${mini.sep ? 'Two towers' : 'A tower'} of ${mini.f} floor${mini.f === 1 ? '' : 's'} of doors. X ${at('X')}, O ${at('O')}."></canvas>${btns}</div></div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> picks again`; }
// The miniature: the tower (a map each, side by side, when each has their own) beside each player's floors gone down.
export function miniature(mini, final) {
  const art = mini.sep ? `<span class="tdd2">${mapSvg(mini, 'X', 'X')}${mapSvg(mini, 'O', 'O')}</span>` : `<span class="tdd1">${mapSvg(mini, 'X', '', true)}</span>`;
  return thumbArt(art, pipRows({ X: Math.min(mini.f, mini.at.X), O: Math.min(mini.f, mini.at.O) }, mini.f), 'tddw', `Door Drop: X ${mini.at.X} and O ${mini.at.O} of ${mini.f} floors down`);
}
export function moveText(f, who) { const s = f.dd; return !s ? `${who} tried a door` : s.down ? `${who} found the way down` : `${who} hit a dead end`; }
// The move's sounds, each once at its moment (after the camera's intro where the flash opens on it): the steps to the
// door, its creak, a step in, a rumble in the dark; then a dead end: the linked door banging open, the tumble's
// whistle, the bonk as the runner lands, two nails as the planks go on; or the way down: a bright chord as the doorway
// lights, the trapdoor's clunk, the falling whistle, the landing's thump and a rising run; on the ground a fanfare and
// the dance's hops.
export function sounds(f, add, won, mini, last) {
  const s = f.dd; if (!s) return;
  const T = DOORS, base = preOf(f) - playOf(f).lead, put = (n, ms, rate) => { if (base + ms >= -40) add(n, Math.max(0, Math.round(base + ms)), rate); };
  for (let k = 0; k < 3; k++) put('ddStep', 30 + k * (T.walk - 60) / 3, 0.92 + (k % 2) * 0.14);
  put('ddCreak', T.walk); put('ddStep', T.walk + T.open + T.step * 0.4, 0.8); put('ddDark', doorsIn());
  const tD = doorsIn() + T.dark;
  if (!s.down) { put('ddBang', tD); put('ddTumble', tD + T.out * 0.6); put('ddBonk', tD + T.out + T.pop * 0.74); put('ddNail', tD + T.out + T.pop + T.board * 0.3); put('ddNail', tD + T.out + T.pop + T.board * 0.62, 1.12); return; }
  put('ddAha', tD); put('ddHatch', tD + T.beat); put('ddFall', tD + T.beat + T.drop * 0.14); put('ddLand', tD + T.beat + T.drop); put('ddRise', tD + T.beat + T.drop + 60);
  if (won) { const tW = doorsDownMs(); put('ding', tW); put('ddHop', tW + T.win * 0.04, 1); put('ddHop', tW + T.win * 0.34, 1.2); put('sparkle', tW + T.win * 0.66); }
}
export const wonAt = (f, total) => (f.dd && f.dd.down ? Math.max(0, preOf(f) - playOf(f).lead + doorsDownMs()) : total - 600);
