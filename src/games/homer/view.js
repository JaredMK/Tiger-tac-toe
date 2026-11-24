// Home Run Heroes: the screen, the miniature, the move's words and sounds, and this phone's at-bat.
// The field is a canvas, seen from behind the plate: the outfield wall and its crowd, the grass, the mound with the
// pitcher, the plate with the batter in the mover's colour. An at-bat runs on its own clock (rules.js homerPlan): for
// each pitch the pitcher winds up (HOMER.wind), the ball comes in growing for its time in the air, and the bat swings
// at the tap. A home run sails over the wall with a star burst, a hit drops into the outfield, a miss goes by; the
// lamps over the wall keep the at-bat's pitches. This phone's at-bat is played live from Play ball (the taps are the
// move: one swing a pitch, the first tap; real time whatever the Animation setting) and goes in when its last pitch is
// done; anyone else's plays from the move itself, the same pitches and the swings where they were made.
import { HOMER, homerCfg, homerJudge, homerPitches, homerPlan } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, app, state } from '../../ui/app.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is its swings: played from the flash, never pressed in
let live = null;                                                   // this phone's at-bat under way: { sq, p, c, pitches, plan, s: [], res: [], t0, hr }
let src = null;                                                    // what the canvas shows now (set by screen)
let skipped = null, hooked = false;
// A pitch's word (December 2026, the owner's ask): a swing that is not a home run says how to do better, by how far it
// was from the home run window (dt: ms from the perfect moment, below zero early): within the hit window "A bit early"
// or "A bit late" (a hit: it counts for nothing), beyond it "Way early" or "Way late" (a miss); no swing, "No swing".
// `hit` the hit window's ms (homerCfg's `hit`), a square's own settings.
export const homerWord = (res, dt, hit = 90) => (res === 'hr' ? 'Home run!' : dt == null ? 'No swing' : `${Math.abs(dt) <= hit ? 'A bit' : 'Way'} ${dt < 0 ? 'early' : 'late'}`);

// ---- this phone's at-bat ----
function start() {
  const sq = state.squares && state.squares[state.zoom];
  if (live || !sq || sq.mini.type !== 'homer' || sq.owner || state.flash || state.done || state.winner || blocked() || !src || !src.mine) return false;
  const mini = sq.mini, p = state.turn, pitches = homerPitches(mini, p);
  live = { sq: state.zoom, p, mini, c: homerCfg(mini), pitches, plan: homerPlan(pitches), s: [], res: [], t0: performance.now(), hr: mini.hr[p], over: null };
  render(); go();
  return true;
}
function swing() {
  const L = live; if (!L) return false;
  const t = performance.now() - L.t0, i = L.plan.at.findIndex((q, k) => L.s[k] === undefined && L.res[k] === undefined && t >= q.s + HOMER.wind * HOMER.early && t <= q.c + HOMER.late);
  if (i < 0) return false;
  L.s[i] = Math.max(-HOMER.max, Math.min(HOMER.max, Math.round(t - L.plan.at[i].c)));
  SND.play('hrSwing'); haptic('tap');
  return true;
}
// The clock's work each frame: a pitch judged once its swing is in (or its time is up), its sound with it; the at-bat
// over after its last pitch, at the home run that wins, when the turn's time runs out or the square is left.
function tick(now) {
  const L = live; if (!L) return;
  if (state.screen !== 'mini' || state.zoom !== L.sq || state.winner) { finish(); return; }
  const left = clockLeft(); if (left != null && left <= (state.online ? 900 : 0)) { finish(); return; }
  const t = now - L.t0;
  L.plan.at.forEach((q, i) => {
    if (L.res[i] !== undefined) return;
    if (i > 0 && L.res[i - 1] === undefined) return;
    if (L.thrown !== i && t >= q.go) { L.thrown = i; SND.play('hrPitch'); }
    const dt = L.s[i], due = dt !== undefined ? q.c + Math.max(0, dt) : q.c + HOMER.late;
    if (t < due) return;
    const r = homerJudge(L.c, dt === undefined ? null : dt);
    L.res[i] = r; if (dt === undefined) L.s[i] = null;
    if (r === 'hr') { L.hr++; SND.play('hrCrack'); SND.play('hrCheer', { at: 0.12 }); haptic('success'); }
    else if (r === 'hit') { SND.play('hrCrack', { rate: 0.8 }); haptic('medium'); }
    else { SND.play('hrMitt'); if (r === 'miss') haptic('error'); }
    if (L.hr >= L.c.goal || i === L.plan.at.length - 1) L.over = q.e;
    if (r === 'hr') render();                                  // (the tally's pip, at once)
  });
  if (L.over != null && t >= L.over) finish();
}
function finish() {
  const L = live; if (!L) return;
  live = null;
  const s = []; for (let i = 0; i < L.pitches.length; i++) { if (L.res[i] === undefined && i > 0 && L.res[i - 1] === undefined) break; s.push(L.s[i] === undefined ? null : L.s[i]); }   // (the pitches thrown; the rest of a cut-short at-bat: never swung at)
  while (s.length < L.pitches.length) s.push(null);
  attemptMove({ s });
  render();
}
function hook() {                                                  // a tap anywhere on the field swings (once, the first time it is drawn)
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (!live || state.screen !== 'mini' || !runInputAt(e.target)) return;
    if (e.target.closest && e.target.closest('button')) return;
    if (swing()) { e.preventDefault(); ownPress(); }
  }, { passive: false });
}
export const actions = { 'hr-go': () => { ownPress(); if (live) swing(); else start(); } };

// ---- the drawing ----
const lerp = (a, b, u) => a + (b - a) * u, clamp01 = u => Math.max(0, Math.min(1, u));
// One frame of an at-bat at time t (ms from its start; null: nothing under way): o = { by, pitches, plan, s, res, hr0, goal }.
function draw(c, W, H, o, t) {
  const P = runColours(), col = o.by === 'O' ? P.O : P.X;
  const wallY = H * 0.2, moundX = W / 2, moundY = H * 0.4, plateX = W / 2, plateY = H * 0.86, u = Math.min(W, H) / 100;
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#9ad7f2'; c.fillRect(0, 0, W, wallY);
  // the crowd: rows of dots over the wall
  for (let r = 0; r < 3; r++) for (let k = 0; k * 9 * u < W + 9 * u; k++) { c.fillStyle = ['#e8785f', '#f4d35e', '#6fb3d9', '#f7f0e0'][(k * 7 + r * 3) % 4]; c.beginPath(); c.arc(k * 9 * u + (r % 2) * 4.5 * u, wallY - (2.4 + r * 4.4) * u, 2.6 * u, 0, 7); c.fill(); }
  c.fillStyle = '#2e6b3a'; c.fillRect(0, wallY - 1.5 * u, W, 5 * u); c.fillStyle = P.ink; c.fillRect(0, wallY + 3.5 * u, W, 0.9 * u);
  const g = c.createLinearGradient(0, wallY, 0, H); g.addColorStop(0, '#5fb85a'); g.addColorStop(1, '#3f9a48'); c.fillStyle = g; c.fillRect(0, wallY + 4.4 * u, W, H);
  // the infield: a diamond of dirt, the mound, the plate
  c.fillStyle = '#d9a86c'; c.beginPath(); c.moveTo(plateX, plateY + 6 * u); c.lineTo(plateX + W * 0.42, lerp(moundY, plateY, 0.5)); c.lineTo(moundX, moundY - 9 * u); c.lineTo(plateX - W * 0.42, lerp(moundY, plateY, 0.5)); c.closePath(); c.fill();
  c.fillStyle = '#58b254'; c.beginPath(); c.moveTo(plateX, plateY - 10 * u); c.lineTo(plateX + W * 0.27, lerp(moundY, plateY, 0.5)); c.lineTo(moundX, moundY + 3 * u); c.lineTo(plateX - W * 0.27, lerp(moundY, plateY, 0.5)); c.closePath(); c.fill();
  c.fillStyle = '#c9925a'; c.beginPath(); c.ellipse(moundX, moundY, 9 * u, 3.6 * u, 0, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.moveTo(plateX - 5 * u, plateY - 2 * u); c.lineTo(plateX + 5 * u, plateY - 2 * u); c.lineTo(plateX + 5 * u, plateY + 1.5 * u); c.lineTo(plateX, plateY + 5 * u); c.lineTo(plateX - 5 * u, plateY + 1.5 * u); c.closePath(); c.fill(); c.stroke();
  // which pitch is on, and where its ball is
  const at = o.plan ? o.plan.at : [], i = t == null ? -1 : Math.max(0, at.findIndex(q => t < q.e) < 0 ? at.length - 1 : at.findIndex(q => t < q.e));
  const q = i >= 0 ? at[i] : null, pit = q ? o.pitches[i] : null, dt = q ? o.s[i] : undefined, res = q ? o.res[i] : undefined;
  // the pitcher: a little figure on the mound, its arm coming over as the pitch goes
  const wind = q && t < q.go ? clamp01((t - q.s) / HOMER.wind) : 0, arm = q && t < q.go ? -2.2 + wind * 3.4 : 1.2;
  c.strokeStyle = P.ink; c.lineWidth = 1.1 * u; c.lineCap = 'round';
  c.fillStyle = '#f7f0e0'; c.beginPath(); c.arc(moundX, moundY - 10.5 * u, 2.6 * u, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(moundX, moundY - 8 * u); c.lineTo(moundX, moundY - 2.5 * u); c.moveTo(moundX, moundY - 2.5 * u); c.lineTo(moundX - 2.2 * u, moundY + 0.8 * u); c.moveTo(moundX, moundY - 2.5 * u); c.lineTo(moundX + 2.2 * u, moundY + 0.8 * u);
  c.moveTo(moundX, moundY - 7 * u); c.lineTo(moundX + Math.cos(arm) * 4.4 * u, moundY - 7 * u + Math.sin(arm) * 4.4 * u); c.stroke();
  // the batter: a figure left of the plate in the mover's colour, the bat swung through at the tap
  const sw = q && dt != null && dt !== undefined ? clamp01((t - (q.c + dt)) / HOMER.swing) : 0, bx = plateX - 15 * u, by = plateY - 6 * u;
  c.fillStyle = col; c.beginPath(); c.arc(bx, by - 15 * u, 4 * u, 0, 7); c.fill(); c.stroke();
  c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(bx, by - 11 * u); c.lineTo(bx, by - 1 * u); c.moveTo(bx, by - 1 * u); c.lineTo(bx - 3.4 * u, by + 6 * u); c.moveTo(bx, by - 1 * u); c.lineTo(bx + 3.4 * u, by + 6 * u); c.stroke();
  const ba = lerp(-2.3, 0.75, sw), hx = bx + 3.5 * u, hy = by - 7.5 * u;
  c.beginPath(); c.moveTo(bx, by - 9 * u); c.lineTo(hx, hy); c.stroke();
  c.strokeStyle = '#8d5a2b'; c.lineWidth = 2.6 * u; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(ba) * 17 * u, hy + Math.sin(ba) * 17 * u); c.stroke();
  if (sw > 0 && sw < 1) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2 * u; c.beginPath(); c.arc(hx, hy, 17 * u, lerp(-2.3, 0.75, Math.max(0, sw - 0.5)), ba); c.stroke(); }
  // the ball
  let more = t != null && o.plan && t < o.plan.end + 200;
  if (q && t >= q.go) {
    const tx = plateX + pit.x * 4 * u, ty = plateY - 7 * u, decided = res !== undefined, hitAt = dt != null && dt !== undefined ? q.c + Math.max(0, dt) : null;
    let x, y, r, show = true;
    if (decided && (res === 'hr' || res === 'hit') && t >= hitAt) {
      const v = clamp01((t - hitAt) / (res === 'hr' ? 620 : 520)), dir = Math.max(-1, Math.min(1, -dt / 60 + pit.x * 0.4));
      if (res === 'hr') { x = lerp(tx, W / 2 + dir * W * 0.3, v); y = lerp(ty, -4 * u, v) - Math.sin(v * Math.PI) * 6 * u; r = lerp(3.1, 0.9, v) * u; show = v < 1; burst(c, x, Math.max(wallY * 0.5, y), u, v, P); }
      else { x = lerp(tx, W / 2 + dir * W * 0.26, v); y = lerp(ty, lerp(wallY, moundY, 0.6), v) - Math.sin(v * Math.PI) * 10 * u; r = lerp(3.1, 1.3, v) * u; }
    } else {
      const v = (t - q.go) / pit.f;                                 // 0 at the hand, 1 at the plate, on past it for a ball let go or missed
      x = lerp(moundX + 3 * u, tx, Math.min(1.4, v)); y = lerp(moundY - 9 * u, ty, v) - Math.sin(clamp01(v) * Math.PI) * 3 * u; r = lerp(0.9, 3.1, Math.min(1.25, v * v)) * u;
      show = y < H + 6 * u;
    }
    if (show) { c.fillStyle = 'rgba(22,18,16,.22)'; c.beginPath(); c.ellipse(x, Math.min(H - 2 * u, y + 5 * u + r), r * 1.1, r * 0.45, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke(); c.strokeStyle = '#d6402b'; c.lineWidth = 0.4 * u; c.beginPath(); c.arc(x - r * 0.9, y, r * 0.9, -0.9, 0.9); c.stroke(); }
  }
  // the lamps over the wall: one a pitch (gold a home run, white a hit, dark a miss), and the word of the pitch just judged
  const n = o.pitches ? o.pitches.length : 0, lw = 7 * u;
  for (let k = 0; k < n; k++) { const r0 = o.res[k], x = W / 2 + (k - (n - 1) / 2) * lw * 1.5, y = wallY + 1.1 * u; c.fillStyle = r0 === 'hr' ? '#ffd23f' : r0 === 'hit' ? '#fff' : r0 ? '#3a3a3a' : 'rgba(255,255,255,.28)'; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.arc(x, y, 2.4 * u, 0, 7); c.fill(); c.stroke(); }
  if (q && res && t < q.e) { const since = t - (dt != null && dt !== undefined ? q.c + Math.max(0, dt) : q.c + HOMER.late), k = clamp01(since / 140); c.save(); c.translate(W / 2, H * 0.62); c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); c.rotate(-0.06); c.font = `400 ${Math.round(11 * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 2.2 * u; c.strokeStyle = P.ink; c.fillStyle = res === 'hr' ? '#ffd23f' : res === 'hit' ? '#fff' : '#ff8a75'; const wd = homerWord(res, dt, o.hit).toUpperCase(); c.strokeText(wd, 0, 0); c.fillText(wd, 0, 0); c.restore(); }
  return more;
}
function burst(c, x, y, u, v, P) {                               // a home run's star burst as the ball clears the wall
  if (v < 0.55) return; const k = (v - 0.55) / 0.45;
  c.save(); c.translate(x, y); c.globalAlpha = 1 - k * 0.7; c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = 0.6 * u;
  c.beginPath(); for (let a = 0; a < 16; a++) { const rr = (a % 2 ? 4 : 9) * u * (0.5 + k), an = a * Math.PI / 8; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore();
}
const go = stage('canvas.hrcv', (c, W, H, now) => {
  if (live) tick(now);
  if (!src) return false;
  if (live && src.zoom === live.sq) { draw(c, W, H, { by: live.p, pitches: live.pitches, plan: live.plan, s: live.s, res: live.res, hit: live.c.hit }, now - live.t0); return true; }
  const a = src.a;
  if (a) {                                                        // someone else's at-bat, from the move: the swings as made, each pitch judged as its moment comes
    const at = fxAt('move', a), t = at == null ? Infinity : now - at, f = a.hr, plan = homerPlan(f.pitches);
    const res = f.res.map((r, i) => { const dt = f.s[i], due = dt != null ? plan.at[i].c + Math.max(0, dt) : plan.at[i].c + HOMER.late; return t >= due ? r : undefined; });
    return draw(c, W, H, { by: a.by, pitches: f.pitches, plan, s: f.s.map(v => (v == null ? undefined : v)), res, hit: homerCfg(src.mini).hit }, Math.min(t, plan.end + 250)) && t < plan.end + 250;
  }
  const l = src.rest;                                             // at rest: the last at-bat's lamps, the batter waiting
  draw(c, W, H, { by: src.by, pitches: l ? l.s.map(() => ({ f: 1, x: 0 })) : homerPitches(src.mini, src.by), plan: null, s: [], res: l ? l.res : [] }, null);
  return false;
});

// ---- the view's hooks ----
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = homerCfg(mini), s = a && a.hr ? a.hr : null, own = !!s && ownMove(a), o = { view, locked, turn };
  // A move made here has been watched already, live: its flash goes straight to its result, once.
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }
  const end = s ? homerPlan(s.pitches).end : 0, mine = !view && !s && !locked && !d, on = !!live && live.sq === state.zoom;
  const tal = p => arcTally(p, o, pips(p, on && live.p === p ? live.hr : mini.hr[p], c.goal, !!(s && !own && a.by === p && s.to > s.from), end));
  const l = s || ((view || d) && mini.last ? mini.last : null), n = l ? l.to - l.from : 0;
  const words = l ? (n ? `${n} home run${n === 1 ? '' : 's'}!` : 'No home run') : '';
  const line = s && !own ? `<p ${lateAt('hrline ' + (n ? 'ok' : 'no'), end)} role="status">${words}</p>` : `<p class="hrline${l ? (n ? ' ok' : ' no') : ''}">${on ? '' : words}</p>`;
  src = { mini, a: s && !own ? a : null, by: s ? a.by : (view || d) && mini.last ? mini.last.by : turn, rest: !s && (view || d) ? mini.last : s && own ? s : null, mine, zoom: state.zoom };
  const btn = view ? '' : `<button class="big ${turn} hrbtn" data-act="hr-go"${mine || on ? '' : ' disabled'}>${on ? 'Swing!' : 'Play ball'}</button>`;
  go();
  return `<div class="g-hr pc-${src.by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="hrfield${on ? ' live' : ''}"><canvas class="hrcv" aria-label="The ballpark"></canvas></div>${line}${btn}</div>`;
}
// The miniature: the ballpark from above (the outfield, the diamond, a ball over the wall), beside each player's home runs as pips.
export function miniature(mini, final) {
  const c = homerCfg(mini);
  const art = '<svg class="thr" viewBox="0 0 60 60"><path class="thrg" d="M30 56 4 30A36 36 0 0 1 56 30Z"/><path class="thrw" d="M4 30A36 36 0 0 1 56 30" fill="none"/><path class="thrd" d="M30 54 18 42 30 30 42 42Z"/><circle class="thrm" cx="30" cy="42" r="2.4"/><circle class="thrb" cx="44" cy="9" r="4.2"/><path class="thrs" d="M41.600 9.500a3 3 0 0 0 4.800-1.800" fill="none"/></svg>';
  return thumbArt(art, pipRows(mini.hr, c.goal), 'thrw', `Home Run Heroes: X ${mini.hr.X}, O ${mini.hr.O} of ${c.goal} home runs`);
}
export function moveText(f, who) { const s = f.hr, n = s ? s.to - s.from : 0; return n ? `${who} hit ${n} home run${n === 1 ? '' : 's'}` : `${who} hit no home run`; }
// Someone else's at-bat, each pitch at its moment: the throw, the swing, then the crack and the cheer of a home run, a
// duller crack for a hit, the ball in the mitt for a miss. An at-bat played here had its sounds live.
export function sounds(f, add, won, mini, last) {
  const s = f.hr; if (!s || ownMove(f)) return;
  const plan = homerPlan(s.pitches);
  s.res.forEach((r, i) => {
    const q = plan.at[i], dt = s.s[i], due = dt != null ? q.c + Math.max(0, dt) : q.c + HOMER.late;
    add('hrPitch', q.go); if (dt != null) add('hrSwing', q.c + dt);
    if (r === 'hr') { add('hrCrack', due); add('hrCheer', due + 120); } else if (r === 'hit') add('hrCrack', due, 0.8); else add('hrMitt', due);
  });
}
