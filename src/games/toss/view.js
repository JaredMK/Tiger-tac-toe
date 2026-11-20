// Bin Shot: the screen, the miniature, the move's words and sounds, and this phone's flick.
// The room is a canvas seen from above: a carpet, the bin up the room, a desk fan at the side it blows from with its
// streaks drifting across (faster for a stronger fan) and a sign saying which way and how many bin-widths it will
// carry a throw. The paper ball waits at the near end. A flick up the room throws it (ui/flick.js): it leaves at once
// and, as the move comes back, flies to where it landed (TOSS.fly), rising and bending with the fan: into the bin (it
// drops in), off the rim, or onto the floor. Anyone else's throw plays the same from the move.
import { tune } from '../../core/tune.js';
import { TOSS, tossAim, tossCfg } from './rules.js';
import { flickMove } from '../shared/flick.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { state } from '../../ui/app.js';
import { flickPad } from '../../ui/flick.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the flick: played from the flash
let src = null, pend = null;
const VIEW = { y0: -12, h: 122 };                                  // the room on the canvas: from behind the thrower to past the bin
const hook = flickPad('.tsfield.live', fl => {
  const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini;
  if (!mini || mini.type !== 'toss' || !src || !src.mine || state.flash || state.done || blocked()) return;
  const m = flickMove(fl.ang, fl.v, tune(mini));
  pend = { sq: state.zoom, m, t0: performance.now() };
  ownPress(); SND.play('pongThrow', { rate: 0.9 + m.p * 0.25 }); haptic('tap');
  attemptMove(m); go();
});
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u);
function paper(c, u, X, Y, x, y, k, P, alpha) {                    // a crumpled ball; k: its height (1 on the floor, more in the air)
  const r = TOSS.r * u * k;
  c.save(); c.globalAlpha = (alpha == null ? 1 : alpha) * 0.22; c.fillStyle = '#161210'; c.beginPath(); c.ellipse(X(x) + (k - 1) * 5 * u, Y(y) + (k - 1) * 7 * u + r * 0.5, r * 0.95, r * 0.6, 0, 0, 7); c.fill();
  c.globalAlpha = alpha == null ? 1 : alpha; c.translate(X(x), Y(y)); c.rotate(x * 0.13 + y * 0.09);
  c.fillStyle = '#fbfbf6'; c.strokeStyle = P.ink; c.lineWidth = 0.6 * u; c.lineJoin = 'round'; c.beginPath();
  [[1, 0.1], [0.62, 0.72], [-0.1, 1], [-0.8, 0.62], [-1, -0.12], [-0.55, -0.82], [0.2, -1], [0.82, -0.6]].forEach(([a, b], i) => (i ? c.lineTo(a * r, b * r) : c.moveTo(a * r, b * r))); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(22,18,16,.3)'; c.lineWidth = 0.4 * u; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.2); c.lineTo(r * 0.1, r * 0.1); c.lineTo(r * 0.5, -r * 0.3); c.moveTo(-r * 0.1, r * 0.6); c.lineTo(r * 0.1, r * 0.1); c.stroke();
  c.restore();
}
const go = stage('canvas.tscv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), u = W / TOSS.w, X = x => x * u, Y = y => (VIEW.y0 + VIEW.h - 2 - y) * u, col = by === 'O' ? P.O : P.X;
  const s = a ? a.ts : null, at = s ? (src.own && pend && pend.sq === src.zoom ? pend.t0 : fxAt('move', a)) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  const landed = s && t >= TOSS.fly, wind = s && t < TOSS.fly + TOSS.drop + 200 ? s.wind : mini.wind[by], D = mini.dist, bx = TOSS.w / 2;
  c.clearRect(0, 0, W, H); c.fillStyle = '#c9d8e6'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 9; i++) for (let j = 0; j < 11; j++) if ((i + j) % 2) c.fillRect(i * W / 9, j * H / 11, W / 9, H / 11);
  // the fan's streaks: short lines drifting the way it blows
  const dir = Math.sign(wind) || 1, str = Math.abs(wind), n = Math.round(4 + str / 3);
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.8 * u; c.lineCap = 'round';
  for (let k = 0; k < n; k++) { const ph = ((now / 1000) * (0.25 + str / 40) + k * 0.37) % 1, x = dir > 0 ? ph * 120 - 10 : 110 - ph * 120, y = 12 + ((k * 37) % 88), len = 6 + str * 0.35; c.globalAlpha = Math.sin(ph * Math.PI) * 0.9; c.beginPath(); c.moveTo(X(x), Y(y)); c.lineTo(X(x + dir * len), Y(y)); c.stroke(); }
  c.globalAlpha = 1;
  // the fan: a round cage and turning blades at the side it blows from
  const fx = dir > 0 ? 7 : 93, fy = D * 0.55;
  c.save(); c.translate(X(fx), Y(fy)); c.fillStyle = '#5c6b7a'; c.strokeStyle = P.ink; c.lineWidth = 0.8 * u; c.beginPath(); c.arc(0, 0, 8 * u, 0, 7); c.fill(); c.stroke();
  c.rotate(now / 1000 * (3 + str / 4)); c.fillStyle = '#dfe7ee'; for (let k = 0; k < 3; k++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.ellipse(3.6 * u, 0, 3.4 * u, 1.7 * u, 0.4, 0, 7); c.fill(); c.stroke(); }
  c.fillStyle = P.ink; c.beginPath(); c.arc(0, 0, 1.3 * u, 0, 7); c.fill(); c.restore();
  // the bin: its shadow, its rim and its dark inside
  c.fillStyle = 'rgba(22,18,16,.2)'; c.beginPath(); c.ellipse(X(bx) + 1.4 * u, Y(D) + 2 * u, (mini.bin + 2.4) * u, (mini.bin + 2.4) * u, 0, 0, 7); c.fill();
  c.fillStyle = '#7d8a96'; c.strokeStyle = P.ink; c.lineWidth = 0.9 * u; c.beginPath(); c.arc(X(bx), Y(D), (mini.bin + 2.2) * u, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#2a323a'; c.beginPath(); c.arc(X(bx), Y(D), mini.bin * u, 0, 7); c.fill(); c.stroke();
  const got = s ? (landed ? s.to : s.from) : mini.in[by];
  for (let k = 0; k < Math.min(got, 5); k++) paper(c, u, X, Y, bx + [-3, 3.4, 0, -1.6, 2.2][k], D + [1.5, 0.6, -3, -0.4, 3][k], 0.6, P, 0.9);
  // the fan's sign: which way, and how many bin-widths
  const txt = `${dir > 0 ? '' : '← '}${(str / (2 * mini.bin)).toFixed(1)}${dir > 0 ? ' →' : ''}`;
  c.font = `400 ${Math.round(Math.max(15, 8.5 * u))}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tw = c.measureText(txt).width + 5 * u, sy = Y(D * 0.24);
  c.fillStyle = '#fff8dc'; c.strokeStyle = P.ink; c.lineWidth = 0.8 * u; c.beginPath(); c.rect(X(50) - tw / 2, sy - 5.5 * u, tw, 11 * u); c.fill(); c.stroke(); c.fillStyle = P.ink; c.fillText(txt, X(50), sy + 0.5 * u);
  let more = true;                                                 // (the fan never stops)
  const fly = (ax, ay, w, e) => [TOSS.w / 2 + (ax - TOSS.w / 2) * e + w * Math.max(0, ay) / D * e * e, ay * e];
  if (s) {
    const e = ease(t / TOSS.fly), k2 = Math.max(0, Math.min(1, (t - TOSS.fly) / TOSS.drop));
    if (!landed) { const [x, y] = fly(s.ax, s.ay, s.x - s.ax, e); paper(c, u, X, Y, x, y, 1 + Math.sin(e * Math.PI) * 1.1, P); }
    else if (s.in) { if (k2 < 1) paper(c, u, X, Y, s.x + (bx - s.x) * k2, s.y + (D - s.y) * k2, 1 - 0.4 * k2, P, 1 - k2 * 0.3); }
    else { const out = s.rim ? 1 + k2 * 0.9 : 1 + k2 * 0.12, dx = s.x - bx, dy = s.y - D; paper(c, u, X, Y, bx + dx * out, D + dy * out, 1 + (s.rim ? Math.sin(k2 * Math.PI) * 0.5 : Math.sin(k2 * Math.PI) * 0.15), P); }
  } else if (pend && pend.sq === src.zoom) { const [ax, ay] = tossAim(pend.m), e = Math.min(0.8, (now - pend.t0) / TOSS.fly), [x, y] = fly(ax, ay, wind, e); paper(c, u, X, Y, x, y, 1 + Math.sin(e * Math.PI) * 1.1, P); }
  else if (src.mine) { paper(c, u, X, Y, TOSS.w / 2, 0, 1.15, P); c.strokeStyle = col; c.lineWidth = 1 * u; c.beginPath(); c.arc(X(TOSS.w / 2), Y(0), 6.4 * u, 0, 7); c.stroke(); }
  else if (src.rest && !src.rest.in) paper(c, u, X, Y, src.rest.x, src.rest.y, 1, P, 0.8);
  return more;
});
const words = l => (l.in ? 'In the bin!' : l.rim ? 'Off the rim' : 'Missed');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = tossCfg(mini), s = a && a.ts ? a.ts : null, own = !!s && ownMove(a), o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, land = TOSS.fly + (s && s.in ? TOSS.drop : 0);
  if (pend && (s || pend.sq !== state.zoom) && !(s && own)) pend = null;
  const tal = p => arcTally(p, o, pips(p, mini.in[p], c.goal, !!(s && s.in && a.by === p), land));
  const line = s ? `<p ${lateAt('tsline ' + (s.in ? 'ok' : 'no'), land)} role="status">${words(s)}</p>` : `<p class="tsline${l ? (l.in ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom, rest };
  if (s && own) setTimeout(() => { if (pend && state.flash !== a) pend = null; }, 0);
  go();
  const w = mini.wind[by];
  return `<div class="g-ts pc-${by}"><div class="ctals${c.goal > 5 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="tsbox"><div class="tsfield${mine ? ' live' : ''}"><canvas class="tscv" aria-label="The bin, and a fan blowing ${w > 0 ? 'right' : 'left'}: ${(Math.abs(w) / (2 * mini.bin)).toFixed(1)} bin widths"></canvas></div></div>${line}</div>`;
}
// The miniature: the bin from above with a paper ball going in and the fan's streaks, beside each player's baskets as pips.
export function miniature(mini, final) {
  const c = tossCfg(mini);
  const art = '<svg class="tts" viewBox="0 0 60 60"><path class="ttsw" d="M4 14h13M8 26h9M4 38h12"/><circle class="ttsr" cx="36" cy="30" r="20"/><circle class="ttsb" cx="36" cy="30" r="15"/><path class="ttsp" d="M41 22l5 2 1 6-4 5-6-1-3-5 2-5z"/></svg>';
  return thumbArt(art, pipRows(mini.in, c.goal), 'ttsw2', `Bin Shot: X ${mini.in.X}, O ${mini.in.O} of ${c.goal} baskets`);
}
export function moveText(f, who) { const s = f.ts; return !s ? `${who} threw` : s.in ? `${who} got it in the bin` : `${who} missed the bin`; }
// The throw's whoosh (someone else's: a throw made here was heard as it was made), then its landing: a rustle and a
// thump with a chime in the bin, a knock on the rim, a soft tap on the floor.
export function sounds(f, add, won, mini, last) {
  const s = f.ts; if (!s) return;
  if (!ownMove(f)) add('pongThrow', 0, 0.9 + s.p * 0.25);
  if (s.in) { add('tsIn', TOSS.fly + TOSS.drop * 0.5); add('ding', TOSS.fly + TOSS.drop); } else add(s.rim ? 'tsRim' : 'mbStop', TOSS.fly);
}
