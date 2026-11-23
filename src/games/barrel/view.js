// Barrel Launch: the screen, the miniature, the move's words and sounds, and this phone's tap.
// THE SCENE is one canvas (ui/stage.js), BRV.span units across, its height from its box: the column of whoever is on
// the move (the deal is the same column for both, rules.js `xs`, `ph`; each player's barrels swing on their own clock),
// followed by one camera that keeps the mover's barrel BRV.focus up the scene and climbs with every catch. The other
// player's place shows as their small mark hung on the mast at their barrel's height (a chip at the scene's edge when
// that is out of sight). Every barrel is an original wooden launcher on an iron arm from the mast: staves, two riveted
// hoops, a dark mouth with its rim, a bolt it swings on; the top one green-hooped with a star. The player's character
// peeks out of the barrel they are in and rides its swing, and one short bold arrow in their colour runs from the
// barrel's mouth along its aim: nothing else shows where a shot will go (November 2026: the lane, the dotted sight and
// the catch ring are gone). Behind it all the climb: grass, a town, hills and far peaks at the foot, each falling away
// at its own pace, clouds in three depths, birds, a balloon and a paper plane on the way, and a sky that deepens from
// cream to blue to a dark blue with stars and a moon at the top.
// A SHOT (this phone's: a tap on the scene or on Fire, taken on the press, at the aim of that moment; the move is the
// moment, `{ t }`): the barrel kicks back with a flash, a smoke ring, puffs and a few stars at its mouth (and the scene
// a short kick); the character flies, stretched along its way, speed lines behind it, rounds off at the top and drops
// into the barrel above, which dips and springs back as it pops out with a ring (and the next arrow grows in) while
// the camera climbs; a miss sails on past (a near one knocks the barrel), hangs, tumbles back into the barrel it came
// from with a bump and a few stars round its head; the top barrel reached: rays, a fountain of stars and a hop on top.
// Someone else's shot shows their swing up to their tap first (BARREL.pre).
// ONE CLOCK A COLUMN, ONE CAMERA, kept here and never by a render (the jank of the first version: its swing's clock
// was started again at every redraw, so every barrel stepped as a result cleared; its canvas was made anew by every
// redraw; and every frame drew some 1,300 paths): `sc` holds each column's running clock, the camera and what was last
// shown, so a redraw of the page changes nothing on the canvas; the scene's elements stay through a redraw
// (ui/render.js KEEP_BOARDS). A FRAME IS CHEAP: the backdrop is three layers painted once (`backdrop`: the sky, a tall
// gradient; the far layer, stars, moon, peaks and far clouds; the middle layer, hills, town, clouds and fliers), each
// moved by its transform alone as the camera climbs (the compositor's work, no drawing), and the canvas in front draws
// only the mast, the barrels, the player, the arrow and a shot's effects, from sprites made once per size (`artFor`).
// This phone's own shot is worked out here as it is fired (the same rules) and plays from the tap. A CATCH NEVER
// REDRAWS THE PAGE while it plays: its flash is let go in the tap itself (`settle`, ui/turns.js dismissFlash: the
// page's redraws for the move all happen there, under the launch's flash), the flight, the landing, the camera's
// climb and the next shot's readiness are this view's alone (`shot`, `finish`: the button and the scene are switched
// back on in place), so the next shot is ready the moment the rules' clock says. Someone else's column is joined to their true clock over their lead-in
// (`slip`: the swing a little quicker or slower for that moment, never a step).
import { BARREL, barrelAim, barrelCfg, barrelJudge, barrelMs, barrelPeriod, barrelTarget } from './rules.js';
import { durRate } from '../../core/timer.js';
import { other } from '../../core/util.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, state } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { fx, fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows } from '../../ui/tok.js';
import { dismissFlash, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the tap's moment: shown from the flash
// The scene's numbers (units; ms): how many units it shows across; a barrel's width and length; the character's radius
// and how far its middle sits beyond the barrel's lip; where the camera keeps the mover's barrel (a share of the height
// up; the top barrel's own); the arrow (its foot's distance from the barrel's middle, its length, its shaft and head); the camera's climb
// after a catch and its move when the column on show changes; then how long each effect lasts.
export const BRV = {
  span: 118, bw: 15, bl: 19, tok: 5.2, peek: 2.2, focus: 0.21, focusTop: 0.4, ground: -16,
  arrow: { from: 18.6, len: 10.6, w: 2.5, head: 6.4, tip: 5.6, grow: 140 },
  rise: BARREL.land, pan: 380,
  kick: 320, blast: 170, smoke: 460, bits: 560, shake: 150, pop: 340, sink: 110, up: 280, clonk: 320, bump: 380, dizzy: 760, hop: 640, missHold: 560, stuck: 3000,
};
const HL = BRV.bl / 2, DEG = Math.PI / 180;
const clamp = v => (v <= 0 ? 0 : v >= 1 ? 1 : v), easeOut = v => { const k = clamp(v); return 1 - (1 - k) * (1 - k); }, easeIn = v => { const k = clamp(v); return k * k; }, easeIO = v => { const k = clamp(v); return k * k * (3 - 2 * k); };
const dirOf = deg => ({ x: Math.sin(deg * DEG), y: Math.cos(deg * DEG) });
const pvt = (mini, c, i) => ({ x: mini.xs[i] || 0, y: i * c.gap });
const wrap = (d, P) => ((d + P / 2) % P + P) % P - P / 2;
const cubic = (a, b, c, d, t) => { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d; };
const spring = (k, w) => Math.exp(-5.2 * k) * Math.cos(w * k);       // a jolt dying away (k 0..1)

let aim = null;                                                    // this phone's turn to fire: { sq, p, n, phase 0 ready, 4 fired; at }
let shot = null;                                                   // this phone's shot under way, worked out here as it was fired: { sq, p, at, rate, s, due }
let src = null, hooked = false, ended = null;
// What the canvas keeps from frame to frame (never a render): each column's clock (its value `tau` at this page's time
// `at`, running on from there), the camera, the clock last shown and the join under way.
const sc = { key: '', last: -1e9, X: { tau: 0, at: 0 }, O: { tau: 0, at: 0 }, cam: null, shown: null, join: '', slip: null };
const tauOf = (p, now) => sc[p].tau + (now - sc[p].at);
const live = () => {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  return aim && m && m.type === 'barrel' && aim.sq === state.zoom && !state.flash && !state.done && !blocked() && src && src.mine ? m : null;
};
function label() {                                                 // the button follows the shot without a redraw of the screen
  const b = app && app.querySelector ? app.querySelector('.brlbtn') : null; if (!b || !aim) return;
  b.disabled = aim.phase >= 4;
}
// This phone's shot: the moment on its column's clock, the aim and the catch worked out here by the rules, the picture
// from the tap; the move goes in at once.
function fire() {
  const m = live(); if (!m || aim.phase !== 0) return false;
  const now = performance.now(), p = aim.p, c = barrelCfg(m), i = m.at[p];
  if (i >= c.top) return false;
  const t = Math.max(0, Math.round(tauOf(p, now) - m.c[p])), th = barrelAim(m, c, i, m.c[p] + t), j = barrelJudge(m, c, i, th);
  aim.phase = 4; aim.at = now;
  sc[p] = { tau: m.c[p] + t, at: now };
  const sh = shot = { sq: aim.sq, p, at: now, rate: durRate('move', 'barrel', 1), due: false, ok: false, s: { by: p, n: m.n[p], from: i, t, c: m.c[p], th, phi: j.phi, off: Number.isFinite(j.off) ? j.off : 999, hit: j.hit } };
  SND.play('blFire'); haptic('tap'); label();
  setTimeout(() => finish(sh), (BARREL.fly + (j.hit ? BARREL.land + (j.hit && i + 1 >= c.top ? BARREL.top : 0) : BARREL.fall + BRV.missHold)) / sh.rate);
  const r = attemptMove({ t });                                    // (the move may redraw the screen at once: nothing of the aim is read after)
  if (r && r.ok === false) { shot = null; aim.phase = 0; label(); return true; }   // (never expected: refused, the shot is not shown)
  settle(sh);
  go();
  return true;
}
const flashOf = sh => { const f = state.flash; return f && f.br && f.type === 'barrel' && f.br.by === sh.p && f.br.n === sh.s.n ? f : null; };
// A catch's result is let go the moment it is known (in the tap itself where the phone plays its own moves; as the
// record lands online): the shot's picture is this view's own from there (`shot`), so nothing of the page is drawn
// again while the player flies, lands and the camera climbs. A miss and the top barrel keep theirs to their end.
function settle(sh) {
  const f = shot === sh ? flashOf(sh) : null;
  if (!f || ended === f) return;
  sh.ok = true;
  if (f.kind === 'again') { ended = f; dismissFlash(); }
}
// This phone's shot has played. A catch: the next shot is ready, with no redraw (the scene takes taps again, the
// button comes back); a miss: its result is let go (the board follows); the top: its picture is over, its hold to come.
function finish(sh) {
  if (shot !== sh) return;
  sh.due = true;
  const f = flashOf(sh);
  if (f) { if (ended !== f) { ended = f; if (f.kind === 'claim' || f.kind === 'match') skipFlash(); else dismissFlash(); } return; }
  if (!sh.ok) return;                                              // (a record still on its way: screen, when it lands)
  shot = null;
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!m || m.type !== 'barrel' || state.screen !== 'mini' || state.zoom !== sh.sq || state.flash || state.done || state.winner || sq.owner || state.turn !== sh.p || blocked() || !src || src.view) return;   // (anything else: the next redraw has it right)
  aim = { sq: sh.sq, p: sh.p, n: m.n[sh.p], phase: 0, at: 0 }; src.mine = true;
  const fd = app && app.querySelector ? app.querySelector('.brlfield') : null, b = app && app.querySelector ? app.querySelector('.brlbtn') : null;
  if (fd && fd.classList) fd.classList.add('live'); if (b) b.disabled = false;
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !(e.target.closest && e.target.closest('.brlfield.live, .brlbtn:not(:disabled)'))) return;
    if (fire()) { e.preventDefault(); ownPress(); }
  }, { passive: false });
  app.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('.brlbtn')) { e.preventDefault(); if (!e.repeat) fire(); } });
}
export const actions = { 'brl-fire': () => {} };                   // (the shot is the press itself, above: the click that ends it does nothing)

// ---- a shot's picture (pure: the tests read it) ----
// Where the player is, T ms into the shot `s` (someone else's lead-in first: BARREL.pre). tAt(T2): the column's clock
// at that moment of the picture (the barrels swing on). Sitting in a barrel: { sit, since } (ms since it got there);
// in the air: { x, y, vx, vy (its way, a unit), sp (its speed, 0 to 1), spin (turns), in (the barrel whose mouth it is
// coming out of or dropping into: drawn behind that barrel's near side) }.
export function brlPose(mini, c, s, T, tAt) {
  const pre = BARREL.pre, fly = BARREL.fly, i = s.from, a0 = pvt(mini, c, i), d0 = dirOf(s.th);
  if (T < pre) return { sit: i, since: 1e6 };
  const M0 = { x: a0.x + d0.x * (HL + BRV.peek), y: a0.y + d0.y * (HL + BRV.peek) }, tg = barrelTarget(mini, c, i), kf = (T - pre) / fly;
  const air = (at, k, e, o) => { const p = at(k), q = at(Math.min(1, k + e)), dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1; return Object.assign({ x: p.x, y: p.y, vx: dx / l, vy: dy / l }, o); };
  if (s.hit) {                                                     // up beside the barrel above, on its mouth's side, over its rim and down into it
    if (kf >= 1) return { sit: i + 1, since: T - pre - fly };
    const b = pvt(mini, c, i + 1), d1 = dirOf(barrelAim(mini, c, i + 1, tAt(pre + fly))), sg = Math.abs(d1.x) > 0.08 ? Math.sign(d1.x) : (b.x >= a0.x ? -1 : 1);
    const M1 = { x: b.x + d1.x * (HL + 1), y: b.y + d1.y * (HL + 1) }, V = { x: b.x + sg * 13.5, y: b.y - 1 }, LA = Math.hypot(V.x - M0.x, V.y - M0.y) * 1.5, LB = 34;
    const at = k => {
      const x = k < 0.5 ? k / 0.5 : (k - 0.5) / 0.5, u = k < 0.5 ? 1.6 * x - 0.6 * x * x : 0.45 * x + 0.55 * x * x;   // (fast off the barrel, slowing as it rises beside the next; over the rim and quicker down into it)
      return k < 0.5 ? { x: cubic(M0.x, M0.x + d0.x * LA / 3, V.x, V.x, u), y: cubic(M0.y, M0.y + d0.y * LA / 3, V.y - LA * 0.2, V.y, u) }
        : { x: cubic(V.x, V.x + sg * 1.5, M1.x + d1.x * LB / 3, M1.x, u), y: cubic(V.y, V.y + LB / 3, M1.y + d1.y * LB / 3, M1.y, u) };
    };
    const p = at(kf), q = at(Math.min(1, kf + 0.02)), dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: p.x, y: p.y, vx: dx / l, vy: dy / l, sp: clamp(l / (0.02 * fly) / 0.3), spin: 0, in: kf < 0.07 ? i : kf > 0.9 ? i + 1 : null };
  }
  const R = tg.dist * 1.14 + 4, Q = { x: a0.x + d0.x * R, y: a0.y + d0.y * R };
  if (kf < 1) { const k = easeOut(kf); return { x: M0.x + (Q.x - M0.x) * k, y: M0.y + (Q.y - M0.y) * k, vx: d0.x, vy: d0.y, sp: 1 - kf, spin: 0, in: kf < 0.1 ? i : null }; }
  const kd = (T - pre - fly) / BARREL.fall;
  if (kd >= 1) return { sit: i, since: T - pre - fly - BARREL.fall, back: true };
  const d2 = dirOf(barrelAim(mini, c, i, tAt(pre + fly + BARREL.fall))), M2 = { x: a0.x + d2.x * (HL + 1), y: a0.y + d2.y * (HL + 1) };
  const k = kd < 0.18 ? 0 : easeIn((kd - 0.18) / 0.82), C1 = { x: Q.x + d0.x * 3, y: Q.y + 1 }, C2 = { x: M2.x + d2.x * 20, y: M2.y + d2.y * 20 };
  return air(q => ({ x: cubic(Q.x, C1.x, C2.x, M2.x, q), y: cubic(Q.y, C1.y, C2.y, M2.y, q) }), k, 0.02, { sp: 0.75 * k, spin: kd < 0.18 ? 0 : 1.25 * easeIn((kd - 0.18) / 0.82), fall: true, in: k > 0.9 ? i : null });
}
// The one aid: the arrow from barrel i's mouth along its aim at the column's clock tau: its foot and its tip (units).
export function brlArrow(mini, c, i, tau) {
  const a = pvt(mini, c, i), d = dirOf(barrelAim(mini, c, i, tau)), A = BRV.arrow;
  return { from: { x: a.x + d.x * A.from, y: a.y + d.y * A.from }, to: { x: a.x + d.x * (A.from + A.len), y: a.y + d.y * (A.from + A.len) }, d };
}

// ---- the art: every piece drawn once per size into its own little canvas (units; y down, a barrel's mouth up) ----
const COL = {
  w1: '#a8642a', w2: '#cf8e47', w3: '#e8b56b', w4: '#d9a055', w5: '#9c5a25', seam: 'rgba(70,32,8,.55)', rim: '#f1cb8f', hole: '#2a160b', hole2: '#4b2a12',
  iron: '#4b5262', iron2: '#8d96aa', rivet: '#b4bccc', prize: '#2fb38a', prize2: '#92e6c8',
  mast: '#d2b188', mast2: '#b4905f', beam: '#c39a68', sign: '#fff8e8',
  grass: '#6fc05c', grass2: '#57a548', meadow: '#8ccf72', hill: '#a2d98c', hill2: '#86cb74', peak: '#c5d4ee', peak2: '#aebfe2', haze: '#d5e2f3',
  wall: '#fbeed3', roof: '#3f8fbf', roof2: '#7b6bb5', tree: '#3f9a52', tree2: '#2f7f45', trunk: '#8a5a30',
  cloud: '#ffffff', cloud2: '#d7ebfa', flash: '#fff2c9', flash2: '#ffb46b', smoke: '#f4f1ea',
};
function mk(w, h, s, draw) {
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * s)); cv.height = Math.max(1, Math.ceil(h * s));
  const g = cv.getContext('2d'); g.scale(cv.width / w, cv.height / h); g.translate(w / 2, h / 2); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return { cv, w, h };
}
const put = (g, sp, x, y, u, k) => { const w = sp.w * u * (k || 1), h = sp.h * u * (k || 1); g.drawImage(sp.cv, x - w / 2, y - h / 2, w, h); };
const bwAt = y => 7.6 - 0.0123 * (y - 0.8) * (y - 0.8);            // a barrel's half width at y along it (the belly a little below the middle)
const RIN = 5.1, RY = 2.1, RYI = 1.35;                             // the mouth: its inner radius, how deep its ellipses look
function star(g, x, y, r, n, rot, inner) {
  g.beginPath(); for (let s = 0; s < 2 * n; s++) { const a = (rot || 0) - Math.PI / 2 + s * Math.PI / n, q = s % 2 ? r * (inner || 0.45) : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath();
}
function barrelArt(g, ink, top) {
  const n = 12, side = sg => { for (let k = 0; k <= n; k++) { const y = sg < 0 ? -HL + (2 * HL - 0.9) * k / n : HL - 0.9 - (2 * HL - 0.9) * k / n; g.lineTo(sg * bwAt(y), y); } };
  const body = () => { g.beginPath(); g.moveTo(RIN, -HL); g.ellipse(0, -HL, RIN, RYI, 0, 0, Math.PI); side(-1); g.quadraticCurveTo(0, HL + 1.5, bwAt(HL - 0.9), HL - 0.9); side(1); g.closePath(); };
  body(); g.fillStyle = COL.w2; g.fill();
  g.save(); body(); g.clip();
  const fs = [-1.05, -0.62, -0.22, 0.22, 0.62, 1.05], tone = [COL.w1, COL.w4, COL.w3, COL.w2, COL.w5];
  for (let k = 0; k < 5; k++) {                                    // the staves, lit from the upper left
    g.beginPath(); for (let j = 0; j <= n; j++) { const y = -HL - 1 + (2 * HL + 3) * j / n; g.lineTo(fs[k] * bwAt(y), y); } for (let j = n; j >= 0; j--) { const y = -HL - 1 + (2 * HL + 3) * j / n; g.lineTo(fs[k + 1] * bwAt(y), y); }
    g.closePath(); g.fillStyle = tone[k]; g.fill();
  }
  g.strokeStyle = COL.seam; g.lineWidth = 0.34;
  for (let k = 1; k < 5; k++) { g.beginPath(); for (let j = 0; j <= n; j++) { const y = -HL - 1 + (2 * HL + 3) * j / n; g.lineTo(fs[k] * bwAt(y), y); } g.stroke(); }
  g.lineWidth = 0.26; g.strokeStyle = 'rgba(90,44,12,.4)';        // the grain
  for (const [x, y, l] of [[-4.6, -2.6, 2.6], [-1.2, 1.6, 3.2], [1.5, -3, 2.2], [4.4, 1.2, 2.8], [-3.1, 7.2, 1.6], [3.2, -7.4, 1.4], [0.3, 7.6, 1.4]]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 0.35, y + l / 2, x, y + l); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(-3.3, 0.4, 0.8, 6.6, 0.03, 0, 7); g.fill();   // a streak of light
  g.fillStyle = 'rgba(60,24,4,.16)'; g.fillRect(-9, HL - 2.6, 18, 4);                                         // the foot in shade
  g.beginPath(); g.moveTo(bwAt(-HL), -HL); g.ellipse(0, -HL, bwAt(-HL), RY, 0, 0, Math.PI); g.lineTo(-RIN, -HL); g.ellipse(0, -HL, RIN, RYI, 0, Math.PI, 0, true); g.closePath();   // the rim's near side
  g.fillStyle = COL.rim; g.fill();
  g.restore();
  g.strokeStyle = ink; g.lineWidth = 0.42; g.beginPath(); g.ellipse(0, -HL, bwAt(-HL), RY, 0, 0.12, Math.PI - 0.12); g.stroke();
  for (const yc of [-5, 5.2]) {                                    // two iron hoops, riveted
    const w = bwAt(yc) + 0.55, edge = dy => { g.moveTo(-w, yc + dy); g.quadraticCurveTo(0, yc + dy + 1.9, w, yc + dy); };
    g.beginPath(); edge(-1.3); g.lineTo(w, yc + 1.3); g.quadraticCurveTo(0, yc + 1.3 + 1.9, -w, yc + 1.3); g.closePath();
    g.fillStyle = top ? COL.prize : COL.iron; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.6; g.stroke();
    g.beginPath(); g.moveTo(-w + 0.9, yc - 0.62); g.quadraticCurveTo(0, yc - 0.62 + 1.9, w - 0.9, yc - 0.62); g.strokeStyle = top ? COL.prize2 : COL.iron2; g.lineWidth = 0.5; g.stroke();
    for (const f of [-0.62, 0, 0.62]) { const x = f * w, y = yc + 0.3 + 0.95 * (1 - f * f); g.beginPath(); g.arc(x, y, 0.5, 0, 7); g.fillStyle = top ? '#fff' : COL.rivet; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.22; g.stroke(); }
  }
  body(); g.strokeStyle = ink; g.lineWidth = 0.78; g.stroke();
}
function mouthArt(g, ink) {
  g.beginPath(); g.ellipse(0, 0, bwAt(-HL), RY, 0, 0, 7); g.fillStyle = COL.rim; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.78; g.stroke();
  const gr = g.createLinearGradient(0, -RYI, 0, RYI); gr.addColorStop(0, COL.hole2); gr.addColorStop(0.7, COL.hole);
  g.beginPath(); g.ellipse(0, 0, RIN, RYI, 0, 0, 7); g.fillStyle = gr; g.fill(); g.lineWidth = 0.42; g.stroke();
}
function toonArt(g, p, P, wow) {                                   // the game's own X and O (ui/art.js toonG), drawn here for the canvas
  const k = 0.124; g.scale(k, k); g.translate(-50, -50); g.lineCap = 'round';
  for (const [w, col] of [[p === 'X' ? 26 : 25, P.ink], [15, p === 'X' ? P.X : P.O]]) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    if (p === 'X') { g.moveTo(22, 20); g.lineTo(78, 80); g.moveTo(78, 20); g.lineTo(22, 80); } else g.arc(50, 50, 32, 0, 7);
    g.stroke();
  }
  const y = p === 'X' ? 44 : 46, mx = p === 'X' ? 8 : 7;
  for (const sx of [-1, 1]) {
    g.beginPath(); g.ellipse(50 + sx * mx, y, 6.5, 9, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.ellipse(51.5 + sx * mx, y + (wow ? -1.5 : 2), 3.4, 5.6, 0, 0, 7); g.fillStyle = P.ink; g.fill();
  }
  g.strokeStyle = P.ink; g.lineWidth = 3.5; g.beginPath();
  if (wow) { g.ellipse(50, p === 'X' ? 63 : 61.5, 4, 5, 0, 0, 7); g.fillStyle = P.ink; g.fill(); } else { if (p === 'X') { g.moveTo(42, 60); g.quadraticCurveTo(50, 67, 58, 60); } else { g.moveTo(43, 59); g.quadraticCurveTo(50, 65, 57, 59); } g.stroke(); }
}
function cloudArt(g, w, ink, lw) {
  const B = [[-0.3, 0.05, 0.17], [-0.1, -0.07, 0.24], [0.14, -0.03, 0.21], [0.32, 0.06, 0.15], [0.02, 0.09, 0.2]], base = 0.2 * w;
  const each = (f, dy) => { g.beginPath(); for (const [x, y, r] of B) { g.moveTo(x * w + r * w, y * w + dy); g.arc(x * w, y * w + dy, r * w, 0, 7); } f(); };
  g.save(); g.beginPath(); g.rect(-w, -w, 2 * w, w + base); g.clip();
  if (lw) { g.strokeStyle = ink; g.lineWidth = lw * 2; each(() => g.stroke(), 0); }
  g.fillStyle = COL.cloud2; each(() => g.fill(), 0); g.fillStyle = COL.cloud; each(() => g.fill(), -0.045 * w);
  g.restore();
  if (lw) { g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.moveTo(-0.44 * w, base); g.lineTo(0.44 * w, base); g.stroke(); }
}
// The strips at the foot of the climb, each `span` units across with its line (the ground's level) at y = 0.
function peaksArt(g, S) {
  const pk = [[-58, 24], [-36, 38], [-12, 27], [10, 42], [34, 30], [56, 36]];
  g.fillStyle = COL.peak; g.beginPath(); g.moveTo(-S, 2); for (const [x, h] of pk) { g.lineTo(x - h * 0.75, 2); g.lineTo(x, -h); g.lineTo(x + h * 0.75, 2); } g.lineTo(S, 2); g.closePath(); g.fill();
  g.fillStyle = '#fff'; for (const [x, h] of pk) { g.beginPath(); g.moveTo(x, -h); g.lineTo(x - h * 0.2, -h * 0.72); g.lineTo(x - h * 0.07, -h * 0.79); g.lineTo(x + h * 0.04, -h * 0.68); g.lineTo(x + h * 0.2, -h * 0.72); g.closePath(); g.fill(); }
  g.fillStyle = COL.peak2; for (const [x, h] of pk) { g.beginPath(); g.moveTo(x, -h); g.lineTo(x + h * 0.75, 2); g.lineTo(x + h * 0.18, 2); g.closePath(); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1; }
}
function hillsArt(g, S, ink) {
  const hump = (x, r, h, col) => { g.beginPath(); g.moveTo(x - r, 2); g.quadraticCurveTo(x - r * 0.5, -h * 1.9, x, -h); g.quadraticCurveTo(x + r * 0.55, -h * 0.1, x + r, 2); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.5; g.stroke(); };
  hump(-34, 44, 15, COL.hill); hump(30, 52, 19, COL.hill); hump(-62, 30, 9, COL.hill2); hump(2, 40, 10, COL.hill2); hump(60, 34, 12, COL.hill2);
  g.fillStyle = COL.hill2; g.fillRect(-S, 0, 2 * S, 3);
}
function townArt(g, S, ink) {
  g.lineWidth = 0.5; g.strokeStyle = ink;
  const tree = (x, h, r, col) => { g.fillStyle = COL.trunk; g.fillRect(x - 0.7, -h, 1.4, h); g.strokeRect(x - 0.7, -h, 1.4, h); g.beginPath(); g.arc(x, -h - r * 0.7, r, 0, 7); g.arc(x - r * 0.8, -h, r * 0.75, 0, 7); g.arc(x + r * 0.8, -h, r * 0.75, 0, 7); g.fillStyle = col; g.strokeStyle = ink; g.stroke(); g.fill(); };
  const house = (x, w, h, roof) => {
    g.fillStyle = COL.wall; g.fillRect(x - w / 2, -h, w, h); g.strokeRect(x - w / 2, -h, w, h);
    g.beginPath(); g.moveTo(x - w / 2 - 1.2, -h); g.lineTo(x, -h - w * 0.55); g.lineTo(x + w / 2 + 1.2, -h); g.closePath(); g.fillStyle = roof; g.fill(); g.stroke();
    g.fillStyle = '#9fd3ee'; g.fillRect(x - w * 0.28, -h * 0.72, w * 0.2, h * 0.3); g.strokeRect(x - w * 0.28, -h * 0.72, w * 0.2, h * 0.3);
    g.fillStyle = COL.trunk; g.fillRect(x + w * 0.1, -h * 0.5, w * 0.2, h * 0.5); g.strokeRect(x + w * 0.1, -h * 0.5, w * 0.2, h * 0.5);
  };
  tree(-52, 5, 3.6, COL.tree2); house(-42, 9, 6.5, COL.roof); tree(-33, 4, 3, COL.tree); house(-24, 7, 5, COL.roof2); tree(-15, 6, 4, COL.tree2);
  tree(17, 5, 3.4, COL.tree); house(27, 8, 6, COL.roof2); house(36, 10, 7.5, COL.roof); tree(45, 4.5, 3.4, COL.tree2); tree(53, 6, 4, COL.tree);
  g.fillStyle = COL.meadow; g.fillRect(-S, -0.2, 2 * S, 3); g.beginPath(); g.moveTo(-S, 0); g.lineTo(S, 0); g.stroke();
}
function groundArt(g, S, ink) {
  g.fillStyle = COL.grass; g.fillRect(-S, 0, 2 * S, 40);
  g.fillStyle = COL.grass2; for (let k = 0; k < 14; k++) { const x = -S + (k + hash01(k + 5)) * (2 * S / 14), y = 4 + hash01(k + 40) * 14; g.fillRect(x, y, 5 + hash01(k) * 4, 1.1); }
  g.strokeStyle = ink; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-S, 0);                       // the turf's edge, with tufts
  for (let k = 0; k < 30; k++) { const x = -S + k * (2 * S / 30); g.lineTo(x + 1.4, k % 3 ? 0 : -1.2); g.lineTo(x + 2.4, 0); }
  g.lineTo(S, 0); g.stroke();
  for (let k = 0; k < 9; k++) { const x = -S * 0.9 + (k + hash01(k + 9) * 0.6) * (1.8 * S / 9), y = 3 + hash01(k + 70) * 9; if (Math.abs(x) < 14) continue; g.beginPath(); g.arc(x, y, 0.95, 0, 7); g.fillStyle = ['#fff', '#f7b6d6', '#bfe0ff'][k % 3]; g.fill(); g.lineWidth = 0.3; g.stroke(); }
  g.fillStyle = COL.mast2; g.lineWidth = 0.7; g.beginPath(); g.rect(-11, -1.6, 22, 3.6); g.fill(); g.stroke();   // the deck the mast stands on
  g.fillStyle = COL.beam; g.beginPath(); g.rect(-6, -3.4, 12, 2.4); g.fill(); g.stroke();
}
function mastArt(g, ink) {                                         // one length of the mast (26 units): a band, two pegs
  g.fillStyle = COL.mast; g.fillRect(-2.6, -13.2, 5.2, 26.4);
  g.fillStyle = COL.mast2; g.fillRect(0.9, -13.2, 1.7, 26.4);
  g.strokeStyle = ink; g.globalAlpha = 0.85; g.lineWidth = 0.55; g.beginPath(); g.moveTo(-2.6, -13.2); g.lineTo(-2.6, 13.2); g.moveTo(2.6, -13.2); g.lineTo(2.6, 13.2); g.stroke();
  g.lineWidth = 0.3; g.beginPath(); g.moveTo(-0.9, -11); g.lineTo(-0.9, -5); g.moveTo(-0.2, 4); g.lineTo(-0.2, 10); g.stroke();
  for (const [y, sg] of [[-6.5, -1], [6.5, 1]]) { g.lineWidth = 2; g.strokeStyle = ink; g.beginPath(); g.moveTo(sg * 2.6, y); g.lineTo(sg * 5.6, y); g.stroke(); g.lineWidth = 1; g.strokeStyle = COL.mast2; g.beginPath(); g.moveTo(sg * 2.6, y); g.lineTo(sg * 5.5, y); g.stroke(); }
  g.fillStyle = COL.iron; g.strokeStyle = ink; g.lineWidth = 0.5; g.beginPath(); g.rect(-3, -0.9, 6, 1.8); g.fill(); g.stroke();
  g.globalAlpha = 1;
}
function signArt(g, ink, n, top) {                                 // a level's number nailed to the mast (the top's: a star)
  g.fillStyle = COL.sign; g.strokeStyle = ink; g.lineWidth = 0.6; g.beginPath(); g.roundRect ? g.roundRect(-4.3, -3.8, 8.6, 7.6, 1.2) : g.rect(-4.3, -3.8, 8.6, 7.6); g.fill(); g.stroke();
  if (top) { star(g, 0, 0.1, 2.9, 5); g.fillStyle = COL.prize; g.fill(); g.lineWidth = 0.45; g.stroke(); return; }
  g.fillStyle = ink; g.font = '5.6px Bangers, "Luckiest Guy", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 0, 0.5);
}
function flagArt(g, ink) {                                         // the pennant at the mast's top
  g.strokeStyle = ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -8); g.stroke(); g.strokeStyle = COL.mast; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -8); g.stroke();
  g.beginPath(); g.moveTo(0.4, -8); g.lineTo(13, -4.6); g.lineTo(0.4, -1); g.closePath(); g.fillStyle = COL.prize; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.6; g.stroke();
  star(g, 4.3, -4.6, 1.9, 5); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.arc(0, -8.6, 1.2, 0, 7); g.fillStyle = COL.rivet; g.fill(); g.stroke();
}
function balloonArt(g, ink) {
  g.lineWidth = 0.5; g.strokeStyle = ink;
  g.beginPath(); g.moveTo(-3.4, 4.2); g.lineTo(-1.5, 8.6); g.moveTo(3.4, 4.2); g.lineTo(1.5, 8.6); g.stroke();
  g.fillStyle = COL.trunk; g.beginPath(); g.rect(-1.9, 8.4, 3.8, 2.8); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.moveTo(0, -8.6); g.bezierCurveTo(8.4, -8.6, 8.2, 0.6, 3.2, 5); g.lineTo(-3.2, 5); g.bezierCurveTo(-8.2, 0.6, -8.4, -8.6, 0, -8.6); g.closePath(); g.clip();
  g.fillStyle = '#fff8e8'; g.fillRect(-9, -9, 18, 15); g.fillStyle = COL.roof; for (const x of [-7.4, -1.5, 4.4]) g.fillRect(x, -9, 3, 15);
  g.restore();
  g.beginPath(); g.moveTo(0, -8.6); g.bezierCurveTo(8.4, -8.6, 8.2, 0.6, 3.2, 5); g.lineTo(-3.2, 5); g.bezierCurveTo(-8.2, 0.6, -8.4, -8.6, 0, -8.6); g.closePath(); g.stroke();
}
function birdsArt(g, ink) { g.strokeStyle = ink; g.lineWidth = 0.6; for (const [x, y, w] of [[-7, 1, 3], [0, -2, 3.6], [7.5, 1.5, 2.6]]) { g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w / 2, y - w * 0.7, x, y); g.quadraticCurveTo(x + w / 2, y - w * 0.7, x + w, y); g.stroke(); } }
function planeArt(g, ink) {                                        // a paper plane, a dashed loop behind it
  g.strokeStyle = ink; g.lineWidth = 0.5; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(7, -2.4); g.lineTo(-6, -0.6); g.lineTo(-1.6, 1.2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = COL.cloud2; g.beginPath(); g.moveTo(7, -2.4); g.lineTo(-1.6, 1.2); g.lineTo(-0.6, 4); g.closePath(); g.fill(); g.stroke();
  g.setLineDash([0.9, 1.1]); g.beginPath(); g.moveTo(-7, 0.4); g.quadraticCurveTo(-11, 2.6, -13, 0.4); g.stroke(); g.setLineDash([]);
}
function moonArt(g) { g.fillStyle = '#fdf6dc'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(3.4, -2, 6.2, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
let ART = null;
function artFor(s, P, top) {
  const key = `${s.toFixed(2)}|${top}|${P.X}|${P.O}|${P.ink}`;
  if (ART && ART.key === key) return ART;
  const ink = P.ink, S = BRV.span / 2, strip = (h, up, fn) => mk(BRV.span, h, s, g => { g.translate(0, up - h / 2); fn(g); });
  ART = {
    key, body: mk(19, 24, s, g => barrelArt(g, ink, false)), prize: mk(19, 24, s, g => barrelArt(g, ink, true)), mouth: mk(15, 6, s, g => mouthArt(g, ink)),
    bolt: mk(6, 6, s, g => { g.beginPath(); g.arc(0, 0, 2.1, 0, 7); g.fillStyle = COL.iron2; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.6; g.stroke(); g.beginPath(); g.arc(0, 0, 0.8, 0, 7); g.fillStyle = COL.iron; g.fill(); g.beginPath(); g.arc(-0.5, -0.6, 1.25, 3.3, 4.9); g.strokeStyle = '#fff'; g.lineWidth = 0.4; g.stroke(); }),
    badge: mk(9, 9, s, g => { star(g, 0, 0, 3.7, 5); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.6; g.stroke(); }),
    tok: { X: mk(13, 13, s, g => toonArt(g, 'X', P)), O: mk(13, 13, s, g => toonArt(g, 'O', P)) }, wow: { X: mk(13, 13, s, g => toonArt(g, 'X', P, true)), O: mk(13, 13, s, g => toonArt(g, 'O', P, true)) },
    mast: mk(12, 26.4, s, g => mastArt(g, ink)), flag: mk(28, 20, s, g => flagArt(g, ink)),
    sign: Array.from({ length: top + 1 }, (_, i) => (i ? mk(10, 9, s, g => signArt(g, ink, i, i === top)) : null)),
    ground: strip(44, 4, g => groundArt(g, S, ink)),
  };
  return ART;
}
// THE BACKDROP: three layers behind the canvas, painted once for a size and a climb, then only moved (each by its
// transform, at its own share of the camera's climb: the sky's gradient runs its whole length, the far layer `FAR.f`
// of the climb, the middle one `MID.f`). A layer's own height: yl up from the ground's line as the climb starts.
const FAR = { f: 0.22, d: 1.5 }, MID = { f: 0.55, d: 2 }, SKYK = 5;
function paintFar(g, S, top, yT, cam0, vis, HT) {                  // stars and a moon high up, far peaks at the foot, small pale clouds between
  const Y = y => yT - y, hi = cam0 + HT * FAR.f;
  g.fillStyle = '#fff';
  for (let k = 0; k < 90; k++) { const x = (hash01(k * 3 + 1) * 2 - 1) * S, y = cam0 + vis + 2 + hash01(k * 3 + 2) * (HT * FAR.f + 4), al = clamp((y - (cam0 + vis + 2)) / (HT * FAR.f * 0.55)); if (al <= 0) continue; g.globalAlpha = al * (0.55 + 0.45 * hash01(k)); if (k % 5) { g.beginPath(); g.arc(x, Y(y), 0.3 + hash01(k * 3 + 3) * 0.5, 0, 7); g.fill(); } else { star(g, x, Y(y), 1.1 + hash01(k) * 1.2, 4, 0, 0.3); g.fill(); } }
  g.globalAlpha = 1;
  g.save(); g.translate(S * 0.52, Y(hi + vis * 0.8)); moonArt(g); g.restore();
  g.save(); g.translate(0, Y(BRV.ground)); peaksArt(g, S); g.fillStyle = COL.haze; g.fillRect(-S, 1.5, 2 * S, vis); g.restore();
  for (let j = 0; j < 6; j++) { const y = BRV.ground + 50 + (j + 0.5 * hash01(j + 11)) / 6 * (HT * FAR.f * 0.62 + vis * 0.3), x = (hash01(j * 5 + 3) * 2 - 1) * (S - 8), w = 12 + 7 * hash01(j + 2); g.save(); g.translate(x, Y(y)); g.globalAlpha = 0.75; cloudArt(g, w, null, 0); g.restore(); }
}
function paintMid(g, S, top, yT, cam0, vis, HT, ink) {            // hills and the town at the foot; clouds, birds, a balloon and a paper plane on the way up
  const Y = y => yT - y, R = HT * MID.f;
  g.save(); g.translate(0, Y(BRV.ground)); hillsArt(g, S, ink); townArt(g, S, ink); g.fillStyle = COL.meadow; g.fillRect(-S, 2, 2 * S, vis + R); g.restore();
  for (let j = 0; j < 8; j++) { const y = BRV.ground + 62 + Math.pow((j + 0.3 + 0.4 * hash01(j + 21)) / 8, 1.2) * (R * 0.6 + vis * 0.2), sd = j % 2 ? 1 : -1, x = sd * (20 + hash01(j * 7 + 5) * (S - 30)), w = 15 + 10 * hash01(j + 4); g.save(); g.translate(x, Y(y)); cloudArt(g, w, ink, 0.32); g.restore(); }
  for (const [fn, at, x] of [[birdsArt, 0.2, -30], [balloonArt, 0.43, 38], [planeArt, 0.62, -34]]) { g.save(); g.translate(x, Y(BRV.ground + 70 + R * at)); fn(g, ink); g.restore(); }
}
// The two painted layers are still pictures: each is painted once into a canvas kept here (`BG`, for the size and the
// climb) and handed to its element as a bitmap (a `bitmaprenderer` canvas where there is one: nothing to decode as it
// first scrolls into sight, nothing copied a frame; else drawn onto it once).
const bd = { cv: null, sky: null, far: null, mid: null, key: '', ty: [null, null, null] }, BG = { key: '', src: [null, null], h: [0, 0] };
function backdrop(cv, W, H, u, dpr, HT, top, P, cam0, vis, rise, kx, ky) {
  if (bd.cv !== cv) { const f = cv.parentNode, q = f && f.querySelectorAll ? f.querySelectorAll('.brlbg') : []; Object.assign(bd, { cv, sky: f && f.querySelector ? f.querySelector('.brlsky') : null, far: q[0] || null, mid: q[1] || null, key: '', ty: [null, null, null] }); }
  if (!bd.far || !bd.mid || !bd.far.style) return;
  const key = `${W}|${H}|${HT}|${top}|${dpr}|${P.ink}`, hOf = L => vis + HT * L.f + 6;
  if (BG.key !== key) {                                             // a new size or climb: painted once, off the page
    BG.key = key;
    [[FAR, paintFar], [MID, paintMid]].forEach(([L, fn], k) => {
      const h = hOf(L), d = Math.min(dpr, L.d, Math.sqrt(4e6 / Math.max(1, W * h * u))), el = document.createElement('canvas');
      el.width = Math.max(1, Math.round(W * d)); el.height = Math.max(1, Math.round(h * u * d)); BG.h[k] = h * u; BG.src[k] = el;
      const g = el.getContext('2d'); g.setTransform(u * d, 0, 0, u * d, el.width / 2, 0); g.lineJoin = 'round'; g.lineCap = 'round';
      fn(g, BRV.span / 2, top, cam0 + h, cam0, vis, HT, P.ink);
    });
  }
  if (bd.key !== key) {                                             // (this scene's elements have not been given them yet)
    bd.key = key; bd.ty = [null, null, null];
    [bd.far, bd.mid].forEach((el, k) => {
      const from = BG.src[k]; el.width = from.width; el.height = from.height; el.style.height = `${BG.h[k].toFixed(2)}px`;
      let br = null; try { br = typeof createImageBitmap === 'function' && el.getContext('bitmaprenderer'); } catch (e) { br = null; }
      if (br && br.transferFromImageBitmap) createImageBitmap(from).then(b => { if (BG.src[k] === from && el.isConnected !== false) br.transferFromImageBitmap(b); }, () => {});
      else { const g = el.getContext('2d'); if (g) g.drawImage(from, 0, 0); }
    });
  }
  const set = (k, el, ty, x) => { const v = `translate3d(${x.toFixed(1)}px,${ty.toFixed(1)}px,0)`; if (bd.ty[k] !== v && el && el.style) { bd.ty[k] = v; el.style.transform = v; } };
  set(0, bd.sky, -(SKYK - 1) * H * (1 - clamp(rise / HT)), 0);
  set(1, bd.far, -(hOf(FAR) * u - H) + rise * FAR.f * u + ky * FAR.f, kx * FAR.f);
  set(2, bd.mid, -(hOf(MID) * u - H) + rise * MID.f * u + ky * MID.f, kx * MID.f);
}

// ---- a frame ----
function paint(g, W, H, now) {
  if (!src) return false;
  const { mini, a, by, view } = src, P = runColours(), c = barrelCfg(mini), u = W / BRV.span, vis = H / u, dpr = Math.min(2, window.devicePixelRatio || 1);
  const A = artFor(u * dpr, P, c.top), HT = Math.max(1, c.top * c.gap), calm = REDUCED;
  // the scene's memory: a new square, or back after a while away: nothing carried over but the clocks
  const key = `${state.id || ''}|${src.zoom}|${mini.top}|${mini.gap}|${view ? 1 : 0}`, fresh = sc.key !== key || now - sc.last > 600;
  if (sc.key !== key) { sc.key = key; for (const p of ['X', 'O']) sc[p] = { tau: mini.c[p], at: now }; }
  if (fresh) { sc.cam = null; sc.shown = null; sc.slip = null; sc.join = ''; for (const p of ['X', 'O']) if (!(tauOf(p, now) >= mini.c[p] - (shot && shot.p === p ? 1e7 : 1))) sc[p] = { tau: mini.c[p], at: now }; }
  sc.last = now;
  // the shot on show: a move's flash, or this phone's own from its tap; T: ms into its picture
  const s0 = a ? a.br : null, mineShot = shot && shot.sq === src.zoom && (s0 ? s0.by === shot.p && s0.n === shot.s.n : by === shot.p && mini.n[shot.p] === shot.s.n + (shot.ok ? 1 : 0));
  let s = null, T = 0, rate = 1, own = false;
  if (mineShot) { s = s0 || shot.s; own = true; rate = shot.rate; T = BARREL.pre + (now - shot.at) * rate; }
  else if (s0) { const atv = fxAt('move', a); s = s0; own = !!src.own; rate = (fx.move && fx.move.key === a && fx.move.rate) || 1; T = (atv == null ? 1e9 : now - atv) + (own ? BARREL.pre : 0); }
  const Tu = Math.min(T, BARREL.pre + BARREL.fly + BARREL.fall + BARREL.top + 600);
  if (s && mineShot && !s0 && !shot.ok) T = Math.min(T, BARREL.pre + BARREL.fly - 1);   // (online, the record still on its way: the shot hangs at the top of its flight until it lands)
  // the column's clock: a shot's own while it plays, else running on
  let tau = s ? s.c + s.t - BARREL.pre + Tu : tauOf(by, now);
  if (s) sc[s.by] = { tau, at: now };
  const lvl = s ? (s.hit && T >= BARREL.pre + BARREL.fly ? s.from + 1 : s.from) : Math.min(c.top, mini.at[by]), Pm = barrelPeriod(c, Math.min(c.top, lvl));
  const lead = s && !own && T < BARREL.pre, join = by + '|' + (s && !own ? `${s.by}${s.n}` : '');
  if (sc.join !== join) {                                          // the column on show changed, or someone else's shot begins: the picture carries on from where it was
    if (!fresh && sc.shown) {
      const d = wrap(sc.shown.tau + (now - sc.shown.at) - tau, Pm);
      if (lead) sc.slip = { d, id: join };
      else if (!s) { sc[by].tau += d; while (tauOf(by, now) < mini.c[by]) sc[by].tau += Pm; tau = tauOf(by, now); }
    }
    sc.join = join;
  }
  const slip = lead && sc.slip && sc.slip.id === join ? sc.slip.d * (1 - T / BARREL.pre) : 0, shown = tau + slip;
  sc.shown = { tau: shown, at: now };
  const tAt = T2 => tau + (T2 - Tu);
  // the camera: where the mover's barrel is, eased to wherever that moves
  const target = lvl * c.gap - (lvl >= c.top ? BRV.focusTop : BRV.focus) * vis;                   // (the top barrel sits higher in the scene: the flag over it, room for its stars)
  if (!sc.cam) sc.cam = { y: target, a: target, b: target, t0: now, dur: 1 };
  else if (Math.abs(sc.cam.b - target) > 0.01) sc.cam = { y: sc.cam.y, a: sc.cam.y, b: target, t0: now, dur: (s ? BRV.rise : BRV.pan) / rate * (calm ? 0.45 : 1) };
  sc.cam.y = sc.cam.a + (sc.cam.b - sc.cam.a) * easeIO((now - sc.cam.t0) / sc.cam.dur);
  const camY = sc.cam.y, cam0 = -BRV.focus * vis, rise = camY - cam0;
  const pose = s ? brlPose(mini, c, s, T, tAt) : { sit: lvl, since: 1e6 }, ts = s ? T - BARREL.pre : -1;   // ts: ms since the shot left
  // the scene's kick as a shot leaves
  let kx = 0, ky = 0;
  if (s && !calm && ts >= 0 && ts < BRV.shake) { const d = dirOf(s.th), k = 1 - ts / BRV.shake; kx = -d.x * 2.6 * k * k; ky = d.y * 2.6 * k * k; }
  const X = x => W / 2 + x * u + kx, Y = y => H - (y - camY) * u + ky;
  // -- the backdrop's layers moved to where the camera is; this canvas: the ground, the mast and all that moves
  backdrop(g.canvas, W, H, u, dpr, HT, c.top, P, cam0, vis, rise, kx, ky);
  g.clearRect(0, 0, W, H);
  { const y = H - (BRV.ground - cam0) * u + ky + rise * u; if (y - 4 * u < H) g.drawImage(A.ground.cv, kx, y - 4 * u, W, A.ground.h * u); }
  // -- the mast, its arms and signs, the other player's place on it
  const i0 = Math.max(0, Math.floor((camY - 16) / c.gap)), i1 = Math.min(c.top, Math.ceil((camY + vis + 16) / c.gap)), mTop = c.top * c.gap + 16;
  for (let y = BRV.ground + 13.2; y - 13.2 < mTop; y += 26.4) { const sy = Y(y); if (sy > -14 * u && sy < H + 14 * u) put(g, A.mast, X(0), sy, u); }
  { const fy = BRV.ground + 26.4 * Math.ceil((mTop - BRV.ground) / 26.4), sy = Y(fy + 6); if (sy > -12 * u && sy < H + 12 * u) { g.save(); g.translate(X(0), sy + 9 * u); if (!calm) g.rotate(Math.sin(now / 420) * 0.05); put(g, A.flag, 9 * u, -9 * u, u); g.restore(); } }
  g.lineCap = 'round';
  for (let i = i0; i <= i1; i++) {
    const b = pvt(mini, c, i), sg = b.x < 0 ? -1 : 1, py = Y(b.y);
    if (i && A.sign[i]) put(g, A.sign[i], X(0), Y(b.y - 15.5), u);
    if (Math.abs(b.x) > 3) {
      for (const [lw, col] of [[3.5, P.ink], [2.1, COL.beam]]) { g.strokeStyle = col; g.lineWidth = lw * u; g.beginPath(); g.moveTo(X(sg * 2.2), py); g.lineTo(X(b.x), py); if (Math.abs(b.x) > 9) { g.moveTo(X(sg * 2.4), Y(b.y - 6.5)); g.lineTo(X(sg * 8.5), py); } g.stroke(); }
    }
  }
  const rv = other(by), rl = Math.min(c.top, mini.at[rv]), ry = Y(rl * c.gap + 7), rx = X((pvt(mini, c, rl).x < 0 ? 1 : -1) * 15);
  if (!view && ry > -6 * u && ry < H + 6 * u) {                    // the other player's mark, hung on the mast where they are
    g.strokeStyle = P.ink; g.lineWidth = 1.4 * u; g.beginPath(); g.moveTo(X(0), ry); g.lineTo(rx, ry); g.stroke();
    g.beginPath(); g.arc(rx, ry, 4.6 * u, 0, 7); g.fillStyle = P.paper; g.fill(); g.lineWidth = 0.6 * u; g.stroke(); put(g, A.tok[rv], rx, ry, u, 0.58);
  }
  // -- the barrels, each about its bolt at the column's clock; whoever sits in one rides it
  const fl = s && ts >= 0, hitAt = s && s.hit ? ts - BARREL.fly : -1, backAt = s && !s.hit ? ts - BARREL.fly - BARREL.fall : -1, won = !!(s && s.hit && s.from + 1 >= c.top);
  let clonk = null;
  if (fl && !s.hit && s.off < c.win + 6.5) { const tg = barrelTarget(mini, c, s.from), R = tg.dist * 1.14 + 4, q = clamp(tg.dist * Math.cos((s.th - tg.phi) * DEG) / R), tc = BARREL.fly * (1 - Math.sqrt(1 - q)); clonk = { k: (ts - tc) / BRV.clonk, sg: s.th < tg.phi ? 1 : -1 }; }
  const sitOff = since => {                                        // a player just in: sunk into the mouth, then up to peek out (a hop on the top barrel)
    if (since >= 1e5 || calm) return { d: BRV.peek, rot: 0 };
    const k1 = since / BRV.sink; if (k1 < 1) return { d: 1 - 5 * k1, rot: 0 };
    const k2 = (since - BRV.sink) / BRV.up, d = -4 + (BRV.peek + 4) * (k2 >= 1 ? 1 : 1 - Math.pow(1 - k2, 2) * Math.cos(k2 * 5.5) * (1 - k2 * 0.2));
    if (won && since > BRV.sink + BRV.up) { const kh = clamp((since - BRV.sink - BRV.up) / BRV.hop); return { d: BRV.peek + 11 * Math.sin(kh * Math.PI), rot: kh * Math.PI * 2 }; }
    return { d, rot: 0 };
  };
  const tokSp = p => A.tok[p], sitter = pose.sit != null ? pose.sit : -1;
  for (let i = i0; i <= i1; i++) {
    const b = pvt(mini, c, i), px = X(b.x), py = Y(b.y); let th = barrelAim(mini, c, i, shown), kick = 0, sx = 1, sy = 1;
    if (fl && i === s.from && ts < BRV.kick) { const k = ts / BRV.kick, e = k < 0.16 ? k / 0.16 : spring(k - 0.16, 10); kick += 3.4 * e; sy -= 0.13 * Math.max(0, e); sx += 0.09 * Math.max(0, e); }
    if (hitAt >= 0 && i === s.from + 1 && hitAt < BRV.pop + 200) { const k = hitAt / (BRV.pop + 200), e = k < 0.12 ? k / 0.12 : spring(k - 0.12, 9); kick += 3 * e; sy -= 0.12 * Math.max(0, e); sx += 0.08 * Math.max(0, e); }
    if (backAt >= 0 && i === s.from && backAt < BRV.bump) { const k = backAt / BRV.bump, e = k < 0.14 ? k / 0.14 : spring(k - 0.14, 9); kick += 2.2 * e; sy -= 0.1 * Math.max(0, e); sx += 0.07 * Math.max(0, e); }
    if (clonk && i === s.from + 1 && clonk.k >= 0 && clonk.k < 1) th += clonk.sg * 9 * Math.exp(-4 * clonk.k) * Math.sin(clonk.k * 17);
    const tf = () => { g.translate(px, py); g.rotate(th * DEG); if (kick) g.translate(0, kick * u); if (sx !== 1 || sy !== 1) g.scale(sx, sy); };
    g.save(); tf(); put(g, A.mouth, 0, -HL * u, u);
    if (sitter === i) { const o = sitOff(pose.since), p = s ? s.by : by; g.translate(0, -(HL + o.d) * u); if (o.rot) g.rotate(o.rot); put(g, pose.back && pose.since < BRV.dizzy ? A.wow[p] : tokSp(p), 0, 0, u); }
    g.restore();
    if (pose.x != null && pose.in === i) drawFlier(g, A, pose, s.by, X, Y, u, calm);
    g.save(); tf(); put(g, i === c.top ? A.prize : A.body, 0, 0, u); put(g, i === c.top ? A.badge : A.bolt, 0, 0, u); g.restore();
  }
  // -- the one aid: the arrow from the mover's barrel along its aim
  const grow = s ? (lead ? 1 : s.hit && !won ? clamp((hitAt - (BARREL.land - BRV.arrow.grow)) / BRV.arrow.grow) : 0) : 1;
  if (!view && grow > 0 && lvl < c.top && !(src.over)) {
    const ar = brlArrow(mini, c, lvl, shown), R = BRV.arrow, d = ar.d, nx = d.y, ny = -d.x, bob = calm ? 0 : 0.9 * Math.sin(now / 170), L = R.len * grow;
    const pt = (al, ac) => [X(ar.from.x + d.x * (al + bob) + nx * ac), Y(ar.from.y + d.y * (al + bob) + ny * ac)];
    g.beginPath();
    for (const [al, ac] of [[0, R.w / 2], [L - R.tip, R.w / 2], [L - R.tip, R.head / 2], [L, 0], [L - R.tip, -R.head / 2], [L - R.tip, -R.w / 2], [0, -R.w / 2]]) { const q = pt(Math.max(0, al), ac * Math.min(1, grow * 1.6)); g.lineTo(q[0], q[1]); }
    g.closePath(); g.lineJoin = 'round'; g.fillStyle = by === 'O' ? P.O : P.X; g.strokeStyle = P.ink; g.lineWidth = 0.8 * u; g.fill(); g.stroke();
  }
  // -- the player in the air, and what a shot throws up
  if (pose.x != null && pose.in == null) drawFlier(g, A, pose, s.by, X, Y, u, calm);
  if (fl && !calm) {
    const a0 = pvt(mini, c, s.from), d = dirOf(s.th), mx = a0.x + d.x * (HL + 1), myy = a0.y + d.y * (HL + 1);
    if (ts < BRV.blast) { const k = ts / BRV.blast; g.save(); g.globalAlpha = 1 - k * k; star(g, X(mx + d.x * 3), Y(myy + d.y * 3), (6 + 7 * k) * u, 9, k * 0.6 + 0.3, 0.55); g.fillStyle = COL.flash2; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.6 * u; g.stroke(); star(g, X(mx + d.x * 3), Y(myy + d.y * 3), (3.4 + 4 * k) * u, 9, -k * 0.5, 0.55); g.fillStyle = COL.flash; g.fill(); g.restore(); }
    if (ts < BRV.smoke) {                                          // the smoke ring, and three puffs drifting off
      const k = ts / BRV.smoke, e = easeOut(k); g.save(); g.globalAlpha = 0.9 * (1 - k);
      g.translate(X(mx + d.x * (4 + 13 * e)), Y(myy + d.y * (4 + 13 * e))); g.rotate(s.th * DEG); g.beginPath(); g.ellipse(0, 0, (4 + 6 * e) * u, (1.2 + 1.6 * e) * u, 0, 0, 7); g.strokeStyle = P.ink; g.lineWidth = (2.3 - 1.2 * k) * u; g.stroke(); g.strokeStyle = COL.smoke; g.lineWidth = (1.4 - 0.8 * k) * u; g.stroke(); g.restore();
      g.save(); g.globalAlpha = 0.85 * (1 - k); g.fillStyle = COL.smoke; g.strokeStyle = P.ink; g.lineWidth = 0.45 * u;
      for (const sg of [-1, 0, 1]) { const ang = (s.th + sg * 62) * DEG, r = 4 + 9 * e * (sg ? 1 : 0.6); g.beginPath(); g.arc(X(mx + Math.sin(ang) * r), Y(myy + Math.cos(ang) * r + 3 * e), (1.6 + 2.6 * e) * u, 0, 7); g.fill(); g.stroke(); }
      g.restore();
    }
    if (ts < BRV.bits) { const k = ts / BRV.bits; g.save(); g.globalAlpha = 1 - k * k; g.fillStyle = '#fff'; g.strokeStyle = P.ink; g.lineWidth = 0.35 * u; for (let j = 0; j < 5; j++) { const ang = (s.th + (j - 2) * 24 + 8 * hash01(j + s.n)) * DEG, r = (10 + 16 * hash01(j * 7 + 1)) * easeOut(k); star(g, X(mx + Math.sin(ang) * r), Y(myy + Math.cos(ang) * r - 9 * k * k), (1.5 - 0.7 * k) * u, 4, k * 4 + j, 0.4); g.fill(); g.stroke(); } g.restore(); }
  }
  if (hitAt >= 0 && !calm) {                                       // a catch: a ring off the mouth and four sparks
    const b = pvt(mini, c, s.from + 1), d = dirOf(barrelAim(mini, c, s.from + 1, shown)), mx = b.x + d.x * (HL + 1), myy = b.y + d.y * (HL + 1);
    if (hitAt < BRV.pop) { const k = hitAt / BRV.pop, r = (5 + 11 * easeOut(k)) * u; g.save(); g.globalAlpha = 1 - k * k; g.beginPath(); g.arc(X(mx), Y(myy), r, 0, 7); g.strokeStyle = P.ink; g.lineWidth = (2.2 - 1.3 * k) * u; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = (1.3 - 0.8 * k) * u; g.stroke(); g.fillStyle = '#fff'; g.strokeStyle = P.ink; g.lineWidth = 0.35 * u; for (let j = 0; j < 4; j++) { const ang = j * 1.57 + 0.6, rr = 8 + 9 * easeOut(k); star(g, X(mx + Math.cos(ang) * rr), Y(myy + Math.sin(ang) * rr * 0.8 + 2), (2 - 1.2 * k) * u, 4, k * 3, 0.4); g.fill(); g.stroke(); } g.restore(); }
    if (won) {                                                     // the top: rays behind the barrel, a fountain of stars
      const k = clamp(hitAt / (BARREL.land + BARREL.top)), cx = X(b.x), cy = Y(b.y);
      g.save(); g.globalAlpha = 0.5 * Math.min(1, k * 6) * (1 - Math.max(0, k - 0.75) * 4); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#fff'; g.beginPath(); for (let j = 0; j < 10; j++) { const a1 = j * 0.628 + now / 1500, r = 46 * u; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r); g.lineTo(cx + Math.cos(a1 + 0.26) * r, cy + Math.sin(a1 + 0.26) * r); } g.fill(); g.restore();
      g.save(); g.strokeStyle = P.ink; g.lineWidth = 0.4 * u; for (let j = 0; j < 14; j++) { const t0 = j * 55, kk = (hitAt - t0) / 900; if (kk <= 0 || kk >= 1) continue; const vx = (hash01(j * 3 + 1) * 2 - 1) * 26, vy = 30 + 22 * hash01(j * 3 + 2); g.globalAlpha = 1 - kk * kk; star(g, X(mx + vx * kk), Y(myy + vy * kk - 46 * kk * kk), (2.6 - kk) * u, 5, kk * 5 + j); g.fillStyle = j % 3 ? '#fff' : COL.prize2; g.fill(); g.stroke(); } g.restore();
    }
  }
  if (clonk && clonk.k >= 0 && clonk.k < 1 && !calm) { const b = pvt(mini, c, s.from + 1), k = clonk.k; g.save(); g.globalAlpha = 1 - k; star(g, X(b.x - clonk.sg * 8), Y(b.y - 2), (3 + 4 * k) * u, 6, k, 0.5); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.5 * u; g.stroke(); g.restore(); }
  if (backAt >= 0 && !calm) {                                      // back in its barrel: dust either side, stars round its head
    const b = pvt(mini, c, s.from), d = dirOf(barrelAim(mini, c, s.from, shown));
    if (backAt < BRV.bump) { const k = backAt / BRV.bump; g.save(); g.globalAlpha = 0.85 * (1 - k); g.fillStyle = COL.smoke; g.strokeStyle = P.ink; g.lineWidth = 0.45 * u; for (const sg of [-1, 1]) { g.beginPath(); g.arc(X(b.x + d.x * HL + sg * (6 + 7 * easeOut(k)) * d.y), Y(b.y + d.y * HL - sg * (6 + 7 * easeOut(k)) * d.x + 2 * k), (1.6 + 2.2 * k) * u, 0, 7); g.fill(); g.stroke(); } g.restore(); }
    if (backAt < BRV.dizzy) { const k = backAt / BRV.dizzy, hx = b.x + d.x * (HL + BRV.peek + 6.5), hy = b.y + d.y * (HL + BRV.peek + 6.5); g.save(); g.globalAlpha = Math.min(1, (1 - k) * 3); g.fillStyle = '#fff'; g.strokeStyle = P.ink; g.lineWidth = 0.35 * u; for (let j = 0; j < 3; j++) { const ang = backAt / 130 + j * 2.094; star(g, X(hx + Math.cos(ang) * 5.2), Y(hy + Math.sin(ang) * 1.6), 1.5 * u, 5, ang); g.fill(); g.stroke(); } g.restore(); }
  }
  if (!view && (ry <= -6 * u || ry >= H + 6 * u)) {                // the other player out of sight: a chip at the edge, pointing their way
    const up = ry < 0, cx = W - 7.5 * u, cy = up ? 9 * u : H - 9 * u, r = 4.4 * u;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = P.paper; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.6 * u; g.stroke(); put(g, A.tok[rv], cx, cy, u, 0.55);
    g.beginPath(); const ty = cy + (up ? -1 : 1) * (r + 2.6 * u); g.moveTo(cx - 2.2 * u, cy + (up ? -1 : 1) * (r + 0.4 * u)); g.lineTo(cx, ty); g.lineTo(cx + 2.2 * u, cy + (up ? -1 : 1) * (r + 0.4 * u)); g.closePath(); g.fillStyle = P.ink; g.fill();
  }
  return true;
}
// The player in the air: stretched along its way by its speed, round at rest; speed lines behind it; tumbling as it falls.
function drawFlier(g, A, pose, p, X, Y, u, calm) {
  const x = X(pose.x), y = Y(pose.y), st = calm ? 1 : 1 + 0.42 * pose.sp, ang = Math.atan2(pose.vx, pose.vy);
  if (!calm && pose.sp > 0.25 && !pose.fall) {
    g.save(); g.translate(x, y); g.rotate(ang); g.lineCap = 'round'; g.strokeStyle = '#fff'; g.globalAlpha = 0.85 * pose.sp;
    for (const [ox, l, w] of [[-3.4, 9, 0.9], [0, 13, 1.2], [3.4, 8, 0.9]]) { g.lineWidth = w * u; g.beginPath(); g.moveTo(ox * u, (BRV.tok + 1.5) * u); g.lineTo(ox * u, (BRV.tok + 1.5 + l * pose.sp) * u); g.stroke(); }
    g.restore();
  }
  g.save(); g.translate(x, y);
  if (pose.fall) g.rotate(pose.spin * Math.PI * 2); else { g.rotate(ang); g.scale(1 / Math.sqrt(st), st); }
  put(g, pose.fall || pose.sp > 0.3 ? A.wow[p] : A.tok[p], 0, 0, u);
  g.restore();
}
const go = stage('canvas.brlcv', paint);
// For the tests and the frame-time check: a frame drawn on demand, and what the scene last showed (the column's clock, the camera).
export const brlPaint = paint;
export const brlScene = () => ({ tau: sc.shown ? sc.shown.tau : null, cam: sc.cam ? sc.cam.y : null });

// ---- the view's hooks ----
const WORD = (l, won) => (won ? ['ok', 'To the top!'] : l.hit ? ['ok', 'Caught!'] : ['no', 'Missed!']);
const FIRE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = barrelCfg(mini), s = a && a.br ? a.br : null, own = !!s && ownMove(a), o = { view, locked, turn }, now = performance.now();
  // this phone's shot under way: dropped once another move is on show, its own was never taken, or its picture is over
  if (shot && (shot.sq !== state.zoom || (s ? s.by !== shot.p || s.n !== shot.s.n : shot.due || mini.n[shot.p] > shot.s.n + 1 || (mini.n[shot.p] === shot.s.n && now - shot.at > BRV.stuck)))) shot = null;
  if (shot && !s && mini.n[shot.p] === shot.s.n + 1) shot.ok = true;                               // (its move is in)
  if (shot && s && ended !== a) { const sh = shot; setTimeout(() => (sh.due ? finish(sh) : settle(sh)), 0); }   // (online: the record has landed)
  const fly = shot && !s && shot.ok ? shot : null;                // a catch playing on by itself: its words and pip from the shot
  const by = s ? a.by || s.by : (view || d) && mini.last ? mini.last.by : turn, mine = !view && !locked && !s && !d && !shot;
  if (mine && aim && aim.phase === 4) aim = null;
  if (mine && !(aim && aim.sq === state.zoom && aim.p === turn && aim.n === mini.n[turn])) {
    aim = { sq: state.zoom, p: turn, n: mini.n[turn], phase: 0, at: 0 };
    if (!(tauOf(turn, now) >= mini.c[turn])) sc[turn] = { tau: mini.c[turn], at: now };          // (never before the clock the rules have: a square first seen, a record that moved on)
    else if (tauOf(turn, now) - mini.c[turn] > BARREL.maxT / 2) { const P = barrelPeriod(c, Math.min(c.top, mini.at[turn])); sc[turn].tau -= Math.floor((tauOf(turn, now) - mini.c[turn]) / P) * P; }
  }
  if (!mine && aim && s) aim = null;
  const sv = s || (fly ? fly.s : null), k = fly ? 1 / fly.rate : 1, land = ((s ? own : true) ? 0 : BARREL.pre) + BARREL.fly;
  const tal = p => arcTally(p, o, pips(p, mini.at[p], c.top, !!(sv && sv.hit && sv.by === p), land * k));
  const l = sv || ((view || d) && mini.last ? mini.last : null), top = !!(l && l.hit && mini.at[l.by] >= c.top && l.from + 1 >= c.top), w = l ? WORD(l, top) : null;
  const line = l ? `<p ${sv ? lateAt('brlline ' + w[0], (land + (l.hit ? 0 : BARREL.fall - 120)) * k) : `class="brlline ${w[0]}"`} role="status">${w[1]}</p>` : '<p class="brlline"></p>';
  src = { mini, a: s ? a : null, by, own, mine, view: !!view, over: !!state.winner && !s, zoom: state.zoom };
  const btn = view ? '' : `<button class="big ${turn} brlbtn" data-act="brl-fire" aria-label="Fire into the barrel above"${mine && aim && aim.phase < 4 ? '' : ' disabled'}><b>Fire!</b>${FIRE}</button>`;
  go();
  return `<div class="g-brl pc-${by}"${fly ? ` data-fx="${fly.at}" data-fxk="rt"` : ''}><div class="ctals${c.top > 4 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="brlbox"><div class="brlfield${mine ? ' live' : ''}" role="img" aria-label="${by}'s column of barrels: ${mini.at[by]} of ${c.top} up"><i class="brlsky" data-own></i><canvas class="brlbg" data-own></canvas><canvas class="brlbg" data-own></canvas><canvas class="brlcv" data-own></canvas></div></div>${line}${btn}</div>`;
}
// Someone else's catch keeps the turn: its result is held a short moment only (the redraw that clears it comes once
// the camera has settled, never in its climb); a miss holds its result the usual moment.
export function hold(f) { return f && f.br && f.br.hit && f.kind === 'again' ? 150 : null; }
// The miniature: two little columns of barrels, X's and O's, each player's mark at the barrel they have reached, the
// top barrel green; each player's climb as a bar beside it.
export function miniature(mini, final) {
  const top = barrelCfg(mini).top, col = (p, x) => {
    const n = 4, y = k => 53 - k * 13, k = Math.min(n - 1, Math.round(mini.at[p] / top * (n - 1)));
    const barrels = Array.from({ length: n }, (_, i) => `<g transform="translate(${x} ${y(i)}) rotate(${i % 2 ? 14 : -14})"><rect class="tbrb${i === n - 1 ? ' g' : ''}" x="-8" y="-6" width="16" height="12" rx="3"/><path class="tbrh" d="M-8.400 -2.500h16.800M-8.400 2.500h16.800"/></g>`).join('');
    return `${barrels}<circle class="tbrt ${p}" cx="${x}" cy="${y(k) - 7}" r="5.500"/>`;
  };
  const art = `<svg class="tbrl" viewBox="0 0 60 60">${col('X', 15)}${col('O', 45)}</svg>`;
  return thumbArt(art, barRows(mini.at, top), 'tbrlw', `Barrel Launch: X ${mini.at.X}, O ${mini.at.O} of ${top} barrels up`);
}
// The title bar's line while the turn is held to the square (ui/mini.js heldSub): a catch, so the player fires again.
export function heldSub(mini, turn, f, a) { return f || shot ? '' : `<b class="${turn}">${N(turn)}</b> fires again`; }
export function moveText(f, who) { const l = f.br; return !l ? '' : l.hit ? `${who} landed in the next barrel` : `${who} fell back`; }
// Someone else's shot: the launch's boom, then the flight's whoosh; a catch: the wooden clunk and its spring as it
// lands, the pop as the player peeks out (the top: its fanfare); a miss: a knock if it clipped the barrel, a falling
// whistle from the top of its flight, the bump back into its barrel. This phone's own shot had its boom as it was fired.
export function sounds(f, add, won, mini, last) {
  const l = f.br; if (!l) return;
  const own = ownMove(f), pre = own ? 0 : BARREL.pre, land = pre + BARREL.fly;
  if (!own) add('blFire', pre);
  add('blWhoosh', pre + 20);
  if (l.hit) { add('blCatch', land); add('blPeek', land + BRV.sink + 60); if (won) add('blTop', land + 240); }
  else { if (mini && l.off < barrelCfg(mini).win + 6.5) add('blClonk', pre + BARREL.fly * 0.42); add('blMiss', land - 30); add('blBump', land + BARREL.fall - 20); }
}
