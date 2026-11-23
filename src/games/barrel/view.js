// Barrel Launch: the screen, the miniature, the move's words and sounds, and this phone's tap.
// The scene is one canvas (BRV.w across, BRV.h up, scaled to its box): the mover's column large on the left and the
// other player's beside it, smaller, both drawn from the same deal (rules.js `xs`, `ph`) and each followed by its own
// camera, which climbs as its player does. Every barrel is an original wooden launcher on a round bracket: a stout
// cask with two iron hoops, its mouth up its axis; the top barrel gold-hooped with a star. Each swings about its
// bracket on its column's clock (rules.js barrelAim); the player's drawn X or O peeks out of the barrel they are in,
// a short dotted sight shows where it points, and a dashed ring round the next barrel's middle shows how close a shot
// must pass to be caught (the rules' `win`). This phone's shot: a tap on the scene or on Fire, at once, at the aim of
// that moment (the move is the moment, `{ t }`; the rules work out the aim and judge it). Then, from the move: the shot
// flies; a catch drops into the barrel above (it recoils, a burst pops at its mouth) and the camera climbs; a miss
// sails past and falls back into the barrel it came from (a bump); the top barrel reached: a star burst and the
// token hops out on top. The swing and this phone's own shot are real time whatever the Animation setting; someone
// else's shot shows their swing up to their tap first (BARREL.pre).
import { BARREL, barrelAim, barrelCfg, barrelMs, barrelTarget } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows } from '../../ui/tok.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the tap's moment: shown from the flash
// The scene's size (units; the big column takes `big` of its width and shows `span` units across); a barrel's width
// and length, the token's radius, the sight's length; where the camera keeps the current barrel (a share of the
// height up); ms: the barrel's kick as it fires, the puff, the burst at a catch, the bump, the win's hop and burst;
// a sent shot never answered let go.
export const BRV = { w: 100, h: 125, big: 0.68, span: 92, bw: 13, bl: 17, tok: 4.6, sight: 15, focus: 0.24, kick: 170, puff: 320, pop: 380, bump: 300, hop: 520, stuck: 8000 };
const WOOD = '#c27b3c', WOOD2 = '#9a5a26', WOOD3 = '#e0a35f', IRON = '#3b3f4a', GOLD = '#f2b51b', MOUTH = '#2a160b', SKY1 = '#bfe4f4', SKY2 = '#fff4da';
let aim = null;                                                    // this phone's shot under way: { sq, p, n, phase 0 ready, 4 sent; t0, t, at }
let src = null, hooked = false, skipped = null, idle = { key: '', at: 0 };
const clamp = v => (v <= 0 ? 0 : v >= 1 ? 1 : v), easeOut = v => { const k = clamp(v); return 1 - (1 - k) * (1 - k); }, easeIO = v => { const k = clamp(v); return k * k * (3 - 2 * k); };
const DEG = Math.PI / 180;
const calm = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
const live = () => {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  return aim && m && m.type === 'barrel' && aim.sq === state.zoom && !state.flash && !state.done && !blocked() && src && src.mine ? m : null;
};
function label() {                                                 // the button follows the shot without a redraw of the screen
  const b = app && app.querySelector ? app.querySelector('.brlbtn') : null; if (!b || !aim) return;
  b.disabled = aim.phase >= 4;
}
function fire() {
  const m = live(); if (!m || aim.phase !== 0) return false;
  const now = performance.now();
  aim.phase = 4; aim.t = Math.max(0, Math.round(now - aim.t0)); aim.at = now;
  SND.play('blFire'); haptic('tap'); label();
  attemptMove({ t: aim.t });                                       // (the move may redraw the screen at once and drop the aim: nothing of it is read after)
  go();
  return true;
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

// ---- the drawing ----
// A column's frame: where it sits on the canvas and its scale; its camera from the barrel it follows.
function frame(mini, c, W, H, big) {
  const x0 = big ? 0 : W * BRV.big, w = big ? W * BRV.big : W * (1 - BRV.big), u = w / BRV.span;
  return { x0, w, u, cx: x0 + w / 2, H, vis: H / u };
}
const camOf = (F, c, f) => Math.max(-14, f * c.gap - BRV.focus * F.vis);
const SX = (F, x) => F.cx + x * F.u, SY = (F, cam, y) => F.H - (y - cam) * F.u;
function drawSky(g, F, cam, P, small) {
  const gr = g.createLinearGradient(0, 0, 0, F.H); gr.addColorStop(0, SKY1); gr.addColorStop(1, SKY2);
  g.fillStyle = gr; g.fillRect(F.x0, 0, F.w, F.H);
  g.fillStyle = 'rgba(88,168,207,.16)';                           // a halftone that drifts with the climb
  const step = 6 * F.u, off = ((cam * 0.4 * F.u) % step + step) % step;
  for (let y = -step + off, r = 0; y < F.H + step; y += step, r++) for (let x = F.x0 + ((r % 2) ? step / 2 : 0); x < F.x0 + F.w; x += step) { g.beginPath(); g.arc(x, y, F.u * 0.7, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.strokeStyle = P.ink; g.lineWidth = Math.max(1, F.u * 0.5);   // clouds, a little slower than the column
  for (let k = 0; k < 6; k++) {
    const wy = 30 + k * 52, sy = F.H - (wy - cam * 0.6) * F.u, sx = F.cx + ((k * 37) % 70 - 35) * F.u;
    if (sy < -20 * F.u || sy > F.H + 20 * F.u) continue;
    g.beginPath(); g.arc(sx, sy, 4.2 * F.u, Math.PI, 0); g.arc(sx + 6 * F.u, sy - 1.5 * F.u, 5.5 * F.u, Math.PI, 0); g.arc(sx + 12 * F.u, sy, 4 * F.u, Math.PI, 0); g.closePath(); g.fill(); if (!small) g.stroke();
  }
  const gy = SY(F, cam, -9);                                       // the ground at the foot
  if (gy < F.H) { g.fillStyle = '#6cbf62'; g.fillRect(F.x0, gy, F.w, F.H - gy); g.strokeStyle = P.ink; g.lineWidth = Math.max(1.2, F.u * 0.6); g.beginPath(); g.moveTo(F.x0, gy); g.lineTo(F.x0 + F.w, gy); g.stroke(); }
}
// A barrel about its pivot (sx, sy) in canvas pixels, turned th degrees from straight up; kick: pushed back along its
// axis (units); squash: a recoil's squeeze; gold: the top barrel.
function drawBarrel(g, F, sx, sy, th, P, o) {
  const u = F.u, w = BRV.bw / 2, l = BRV.bl / 2, k = o.kick || 0, sq = o.squash || 0;
  g.save(); g.translate(sx, sy);
  g.fillStyle = IRON; g.strokeStyle = P.ink; g.lineWidth = Math.max(1, u * 0.5);   // the round bracket behind it, with its bolts
  g.beginPath(); g.arc(0, 0, 4.4 * u, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#7d8495'; for (let b = 0; b < 4; b++) { const a = b * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(Math.cos(a) * 3 * u, Math.sin(a) * 3 * u, 0.7 * u, 0, 7); g.fill(); }
  g.rotate(th * DEG); g.translate(0, k * u); g.scale(1 + sq * 0.12, 1 - sq * 0.14);
  g.lineWidth = Math.max(1.2, u * 0.62); g.lineJoin = 'round';
  g.beginPath();                                                   // the cask: bellied sides, a flat foot and a mouth at the top
  g.moveTo(-w * 0.82 * u, l * u); g.quadraticCurveTo(-w * 1.12 * u, 0, -w * 0.88 * u, -l * u); g.lineTo(w * 0.88 * u, -l * u); g.quadraticCurveTo(w * 1.12 * u, 0, w * 0.82 * u, l * u); g.closePath();
  const gr = g.createLinearGradient(-w * u, 0, w * u, 0); gr.addColorStop(0, WOOD2); gr.addColorStop(0.35, WOOD3); gr.addColorStop(1, WOOD2);
  g.fillStyle = gr; g.fill(); g.stroke();
  g.strokeStyle = 'rgba(80,40,14,.5)'; g.lineWidth = Math.max(0.8, u * 0.3);   // the staves
  for (const f of [-0.45, 0, 0.45]) { g.beginPath(); g.moveTo(f * w * 0.9 * u, l * u); g.quadraticCurveTo(f * w * 1.18 * u, 0, f * w * 0.95 * u, -l * u); g.stroke(); }
  g.strokeStyle = P.ink; g.lineWidth = Math.max(1.2, u * 0.62);
  for (const hy of [-0.55, 0.55]) { g.fillStyle = o.gold ? GOLD : IRON; g.beginPath(); g.rect(-w * 1.04 * u, (hy * l - 1.1) * u, w * 2.08 * u, 2.2 * u); g.fill(); g.stroke(); }
  if (o.gold) { g.fillStyle = '#fff'; g.beginPath(); for (let s = 0; s < 10; s++) { const r = (s % 2 ? 1.4 : 3.1) * u, a = -Math.PI / 2 + s * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }
  g.fillStyle = MOUTH; g.beginPath(); g.ellipse(0, -l * u, w * 0.84 * u, 1.9 * u, 0, 0, 7); g.fill(); g.stroke();   // the mouth
  g.restore();
}
function drawTok(g, F, x, y, p, P, rot, scale) {                   // a player's drawn mark on a disc in their colour
  const r = BRV.tok * F.u * (scale || 1);
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  g.fillStyle = p === 'O' ? P.O : P.X; g.strokeStyle = P.ink; g.lineWidth = Math.max(1.2, F.u * 0.6);
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = p === 'O' ? P.ink : '#fff'; g.lineWidth = r * 0.3; g.lineCap = 'round';
  g.beginPath(); if (p === 'X') { const h = r * 0.45; g.moveTo(-h, -h); g.lineTo(h, h); g.moveTo(h, -h); g.lineTo(-h, h); } else g.arc(0, 0, r * 0.45, 0, 7); g.stroke();
  g.restore();
}
function burst(g, x, y, r, k, fill, P, n) {                       // a comic burst growing and fading (k 0..1)
  if (k <= 0 || k >= 1) return;
  g.save(); g.globalAlpha = 1 - k * k * k; g.fillStyle = fill; g.strokeStyle = P.ink; g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath(); const m = n || 12, rr = r * (0.5 + 0.7 * easeOut(k)); for (let s = 0; s < 2 * m; s++) { const a = s * Math.PI / m + k, q = s % 2 ? rr * 0.55 : rr; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); g.stroke();
  g.restore();
}
// One column: the player q's, on frame F at this moment. The shot `s` (their move's flash) and its time T from the
// flash's start (counting someone else's swing first) when it is theirs.
function drawColumn(g, F, mini, c, q, P, clock, sh, now, small) {
  const at = mini.at[q], col = q === 'O' ? P.O : P.X, pv = i => ({ x: mini.xs[i] || 0, y: i * c.gap });
  let focus = at, tok = null, fx = {};
  if (sh) {                                                        // the shot's moments: the swing to the tap, the flight, the catch or the fall back
    const s = sh.s, T = sh.T, pre = BARREL.pre, kf = (T - pre) / BARREL.fly, from = s.from, th = s.th * DEG, a = pv(from), dir = { x: Math.sin(th), y: Math.cos(th) };
    const mouth = { x: a.x + dir.x * BRV.bl / 2, y: a.y + dir.y * BRV.bl / 2 }, tg = barrelTarget(mini, c, from);
    focus = from;
    if (T < pre) tok = { sit: from };
    else if (s.hit) {
      const b = pv(from + 1), proj = Math.max(BRV.bl, tg.dist * Math.cos((s.th - tg.phi) * DEG)), C = { x: a.x + dir.x * proj, y: a.y + dir.y * proj };
      if (kf < 1) { const k = easeOut(kf), m1 = 1 - k; tok = { x: m1 * m1 * mouth.x + 2 * m1 * k * C.x + k * k * b.x, y: m1 * m1 * mouth.y + 2 * m1 * k * C.y + k * k * b.y, rot: kf * 6 }; }
      else tok = { sit: from + 1 };
      const kl = (T - pre - BARREL.fly) / BARREL.land;
      focus = from + easeIO((T - pre) / (BARREL.fly + BARREL.land));
      if (kl >= 0) { fx.recoil = { i: from + 1, k: kl }; fx.pop = { i: from + 1, k: (T - pre - BARREL.fly) / BRV.pop }; }
      if (from + 1 >= c.top && kl >= 0) { const kh = (T - pre - BARREL.fly - BARREL.land * 0.5) / BRV.hop; fx.win = kh; if (kh > 0) tok = { hop: from + 1, k: kh }; }
    } else {
      const reach = Math.max(BRV.bl, tg.dist * 0.92), Q = { x: a.x + dir.x * reach, y: a.y + dir.y * reach };
      const kd = (T - pre - BARREL.fly) / BARREL.fall;
      if (kf < 1) { const k = easeOut(kf); tok = { x: mouth.x + (Q.x - mouth.x) * k, y: mouth.y + (Q.y - mouth.y) * k, rot: kf * 5 }; }
      else if (kd < 1) { const k = clamp(kd), C = { x: Q.x + dir.x * 3, y: Q.y + 5 }, m1 = 1 - k * k, kk = k * k; tok = { x: m1 * m1 * Q.x + 2 * m1 * kk * C.x + kk * kk * a.x, y: m1 * m1 * Q.y + 2 * m1 * kk * C.y + kk * kk * a.y, rot: 5 + k * 7 }; }
      else { tok = { sit: from }; fx.bump = { i: from, k: (T - pre - BARREL.fly - BARREL.fall) / BRV.bump }; }
    }
    if (T >= pre) fx.kick = { i: from, k: (T - pre) / BRV.kick, puff: (T - pre) / BRV.puff, th: s.th };
  } else if (sh === null && aim && aim.phase === 4 && src.mine && q === src.by) fx.kick = { i: at, k: (now - aim.at) / BRV.kick, puff: (now - aim.at) / BRV.puff };
  const cam = camOf(F, c, focus);
  g.save(); g.beginPath(); g.rect(F.x0, 0, F.w, F.H); g.clip();
  drawSky(g, F, cam, P, small);
  g.strokeStyle = 'rgba(22,18,16,.22)'; g.lineWidth = Math.max(1, F.u * 0.5); g.setLineDash([F.u * 1.2, F.u * 2.2]);   // the rope the brackets hang on
  g.beginPath(); for (let i = 0; i <= c.top; i++) { const b = pv(i); if (i) g.lineTo(SX(F, b.x), SY(F, cam, b.y)); else g.moveTo(SX(F, b.x), SY(F, cam, b.y)); } g.stroke(); g.setLineDash([]);
  const angle = i => barrelAim(mini, c, i, clock);
  const sitAt = i => (tok && tok.sit === i) || (!tok && at === i);
  const nxt = Math.min(c.top, (tok && tok.sit != null ? tok.sit : at) + 1);
  let ring = null;
  if (!sh || sh.T < BARREL.pre) {                                  // the catch's ring round the next barrel's middle, and the sight
    const b = pv(nxt), cur = tok && tok.sit != null ? tok.sit : at;
    if (cur < c.top) {
      const a0 = pv(cur), dx = b.x - a0.x, dy = b.y - a0.y, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl * c.win, ny = dx / dl * c.win;   // the lane a shot must take: from the barrel's pivot, as wide as the catch window at the next one
      g.save(); g.globalAlpha = 0.22; g.fillStyle = col; g.beginPath(); g.moveTo(SX(F, a0.x), SY(F, cam, a0.y)); g.lineTo(SX(F, b.x + nx), SY(F, cam, b.y + ny)); g.lineTo(SX(F, b.x - nx), SY(F, cam, b.y - ny)); g.closePath(); g.fill(); g.restore();
      ring = { x: b.x, y: b.y };
      const a = pv(cur), th = angle(cur) * DEG, x0 = a.x + Math.sin(th) * (BRV.bl / 2 + 2), y0 = a.y + Math.cos(th) * (BRV.bl / 2 + 2);
      g.save(); g.fillStyle = col; g.strokeStyle = P.ink; g.lineWidth = Math.max(0.8, F.u * 0.3);
      for (let d = 0; d < BRV.sight; d += 3.2) { const x = x0 + Math.sin(th) * d, y = y0 + Math.cos(th) * d, r = F.u * (0.95 - d / BRV.sight * 0.5); g.beginPath(); g.arc(SX(F, x), SY(F, cam, y), r, 0, 7); g.fill(); g.stroke(); }
      g.restore();
    }
  }
  for (let i = 0; i <= c.top; i++) {
    const b = pv(i), sx = SX(F, b.x), sy = SY(F, cam, b.y);
    if (sy < -BRV.bl * F.u || sy > F.H + BRV.bl * F.u) continue;
    const th = angle(i), o = { gold: i === c.top };
    if (fx.recoil && fx.recoil.i === i && fx.recoil.k < 1) { const k = fx.recoil.k; o.squash = Math.sin(k * Math.PI) * (1 - k); o.kick = 2.2 * Math.sin(k * Math.PI) * (1 - k * 0.5); }
    if (fx.kick && fx.kick.i === i && fx.kick.k < 1) o.kick = 2.4 * (1 - fx.kick.k);
    if (fx.bump && fx.bump.i === i && fx.bump.k < 1) { o.kick = -1.6 * Math.sin(fx.bump.k * Math.PI * 2) * (1 - fx.bump.k); o.squash = 0.6 * (1 - fx.bump.k); }
    drawBarrel(g, F, sx, sy, th, P, o);
    if (sitAt(i)) {                                                // the player peeking up out of the mouth, riding its swing
      const t = th * DEG, d = BRV.bl / 2 + BRV.tok * 0.35 + (o.kick || 0) * 0.5;
      drawTok(g, F, SX(F, b.x + Math.sin(t) * d), SY(F, cam, b.y + Math.cos(t) * d), q, P, t, small ? 1.5 : 0.95);
    }
  }
  if (ring) {                                                       // the catch window, round the next barrel's middle, over it
    g.save(); g.strokeStyle = P.ink; g.lineWidth = Math.max(2.4, F.u * 1.1); g.beginPath(); g.arc(SX(F, ring.x), SY(F, cam, ring.y), c.win * F.u, 0, 7); g.stroke();
    g.strokeStyle = col; g.lineWidth = Math.max(1.4, F.u * 0.6); g.setLineDash([F.u * 1.4, F.u * 1]); g.lineDashOffset = -now / 40; g.stroke(); g.restore();
  }
  if (fx.kick && fx.kick.puff > 0 && fx.kick.puff < 1 && !calm()) {   // the puff at the firing barrel's mouth
    const i = fx.kick.i, b = pv(i), t = (fx.kick.th != null ? fx.kick.th : angle(i)) * DEG, d = BRV.bl / 2 + 2 + fx.kick.puff * 4, k = fx.kick.puff;
    g.save(); g.globalAlpha = 0.85 * (1 - k); g.fillStyle = '#fff'; g.strokeStyle = P.ink; g.lineWidth = Math.max(1, F.u * 0.4);
    for (let s = -1; s <= 1; s++) { const x = b.x + Math.sin(t + s * 0.5) * d, y = b.y + Math.cos(t + s * 0.5) * d; g.beginPath(); g.arc(SX(F, x), SY(F, cam, y), (1.6 + k * 2.4) * F.u, 0, 7); g.fill(); g.stroke(); }
    g.restore();
  }
  if (tok && tok.x != null) drawTok(g, F, SX(F, tok.x), SY(F, cam, tok.y), q, P, tok.rot, 1);
  if (fx.pop && fx.pop.k > 0 && fx.pop.k < 1 && !calm()) { const b = pv(fx.pop.i), t = angle(fx.pop.i) * DEG; burst(g, SX(F, b.x + Math.sin(t) * BRV.bl / 2), SY(F, cam, b.y + Math.cos(t) * BRV.bl / 2), 7 * F.u, fx.pop.k, '#fff', P, 9); }
  if (tok && tok.hop != null) {                                    // the top: the token hops out with a star burst behind it
    const b = pv(tok.hop), k = clamp(tok.k), y = b.y + BRV.bl / 2 + 6 * Math.sin(k * Math.PI) + 4 * k;
    if (!calm()) burst(g, SX(F, b.x), SY(F, cam, b.y + BRV.bl / 2 + 4), 16 * F.u, Math.min(0.95, tok.k * 0.45), GOLD, P, 12);
    drawTok(g, F, SX(F, b.x), SY(F, cam, y), q, P, k * Math.PI * 2, 1.1);
  }
  g.restore();
}
const go = stage('canvas.brlcv', (g, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), c = barrelCfg(mini), other = by === 'X' ? 'O' : 'X';
  const s = a ? a.br : null, atv = s ? fxAt('move', a) : null, own = !!(s && src.own);
  const T = s ? (atv == null ? Infinity : now - atv) + (own ? BARREL.pre : 0) : 0;
  g.clearRect(0, 0, W, H);
  const idleClock = q => mini.c[q] + (now - idle.at);
  let clock, sh = null;
  if (s) { clock = s.c + s.t - BARREL.pre + Math.min(T, BARREL.pre + barrelMs(s.hit) + 4000); sh = { s, T }; }
  else if (aim && src.mine && aim.sq === src.zoom) clock = aim.phase === 4 ? mini.c[by] + aim.t : mini.c[by] + (now - aim.t0);
  else clock = idleClock(by);
  drawColumn(g, frame(mini, c, W, H, true), mini, c, by, P, clock, sh, now, false);
  drawColumn(g, frame(mini, c, W, H, false), mini, c, other, P, idleClock(other), undefined, now, true);
  g.strokeStyle = P.ink; g.lineWidth = Math.max(2, W / 120); g.beginPath(); g.moveTo(W * BRV.big, 0); g.lineTo(W * BRV.big, H); g.stroke();
  return true;
});

// ---- the view's hooks ----
const WORD = (l, won) => (won ? ['ok', 'To the top!'] : l.hit ? ['ok', 'Caught!'] : ['no', 'Missed!']);
const FIRE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = barrelCfg(mini), s = a && a.br ? a.br : null, own = !!s && ownMove(a), o = { view, locked, turn };
  const by = s ? a.by || s.by : (view || d) && mini.last ? mini.last.by : turn, mine = !view && !locked && !s && !d;
  const key = `${state.zoom}:${mini.n.X}:${mini.n.O}`; if (idle.key !== key) idle = { key, at: performance.now() };
  if (mine && aim && aim.phase === 4 && performance.now() - aim.at > BRV.stuck) aim = null;
  if (mine && !(aim && aim.sq === state.zoom && aim.p === turn && aim.n === mini.n[turn])) aim = { sq: state.zoom, p: turn, n: mini.n[turn], phase: 0, t0: performance.now(), t: 0, at: 0 };
  if (!mine && aim && s) aim = null;
  // A shot fired here was aimed here: its flash starts at the shot and ends with its landing (the swing is not played again).
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, barrelMs(s.hit, true) + (s.hit && mini.at[s.by] >= c.top ? 700 : 260)); }
  const land = (own ? 0 : BARREL.pre) + BARREL.fly;
  const tal = p => arcTally(p, o, pips(p, mini.at[p], c.top, !!(s && s.hit && s.by === p), land));
  const l = s || ((view || d) && mini.last ? mini.last : null), top = !!(l && l.hit && mini.at[l.by] >= c.top && l.from + 1 >= c.top), w = l ? WORD(l, top) : null;
  const line = l ? `<p ${s ? lateAt('brlline ' + w[0], land + (l.hit ? 0 : BARREL.fall - 120)) : `class="brlline ${w[0]}"`} role="status">${w[1]}</p>` : '<p class="brlline"></p>';
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom };
  const ph = mine && aim ? aim.phase : 0;
  const btn = view ? '' : `<button class="big ${turn} brlbtn" data-act="brl-fire" aria-label="Fire into the barrel above"${mine && ph < 4 ? '' : ' disabled'}><b>Fire!</b>${FIRE}</button>`;
  go();
  return `<div class="g-brl pc-${by}"><div class="ctals${c.top > 4 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="brlbox"><div class="brlfield${mine ? ' live' : ''}"><canvas class="brlcv" aria-label="${by}'s column of barrels: ${mini.at[by]} of ${c.top} up"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: two little columns of barrels, X's and O's, each player's mark at the barrel they have reached, the
// top barrel gold; each player's climb as a bar beside it.
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
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> fires again`; }
export function moveText(f, who) { const l = f.br; return !l ? '' : l.hit ? `${who} landed in the next barrel` : `${who} fell back`; }
// Someone else's shot: the launch's thump, then the flight's whoosh; a catch: the wooden clunk and pop as it lands;
// a miss: a falling whistle and the bump back into its barrel. This phone's own shot had its thump as it was fired.
export function sounds(f, add, won, mini, last) {
  const l = f.br; if (!l) return;
  const own = ownMove(f), pre = own ? 0 : BARREL.pre, land = pre + BARREL.fly;
  if (!own) add('blFire', pre);
  add('blWhoosh', pre + 30);
  if (l.hit) { add('blCatch', land); if (won) add('blTop', land + 180); }
  else { add('blMiss', land - 60); add('blBump', land + BARREL.fall - 30); }
}
