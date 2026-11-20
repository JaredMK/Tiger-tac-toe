// Marble Toss: the screen, the miniature, the move's words and sounds, and this phone's flick.
// The table is a canvas seen from above: a wooden board with its holes (each with its points) and the marble in the
// mover's colour at the near end, the turn's marbles still to come beside it. A flick up the table rolls it (ui/flick.js):
// it leaves at once along its aim and, as the move comes back, runs on to where it landed (MARB.roll): into a hole
// (it drops, a "+N" rises) or to a stop (it fades), or off the table. Anyone else's flick plays the same from the move.
import { tune } from '../../core/tune.js';
import { MARB, marbleAim, marbleCfg } from './rules.js';
import { flickMove } from '../shared/flick.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, state } from '../../ui/app.js';
import { flickPad } from '../../ui/flick.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { lateAt } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the flick: played from the flash
let src = null, pend = null;                                       // what the canvas shows; this phone's flick on its way: { sq, m, t0 }
const hook = flickPad('.mbfield.live', fl => {
  const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini;
  if (!mini || mini.type !== 'marble' || !src || !src.mine || state.flash || state.done || blocked()) return;
  const m = flickMove(fl.ang, fl.v, tune(mini));
  pend = { sq: state.zoom, m, t0: performance.now() };
  ownPress(); SND.play('mbFlick', { rate: 0.9 + m.p * 0.3 }); haptic('tap');
  attemptMove(m); go();
});
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.pow(1 - u, 2.4));
function ball(c, u, x, y, r, col, P, alpha) {
  c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
  c.fillStyle = 'rgba(22,18,16,.25)'; c.beginPath(); c.ellipse((x + 0.6) * u, (y + 0.9) * u, r * u, r * 0.8 * u, 0, 0, 7); c.fill();
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.arc(x * u, y * u, r * u, 0, 7); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc((x - r * 0.35) * u, (y - r * 0.38) * u, r * 0.3 * u, 0, 7); c.fill();
  c.restore();
}
const go = stage('canvas.mbcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), u = W / MARB.w, col = by === 'O' ? P.O : P.X;
  c.clearRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#d9a55f'); g.addColorStop(0.5, '#e6b877'); g.addColorStop(1, '#d39c55'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(120,72,24,.22)'; c.lineWidth = Math.max(1, 0.5 * u); for (let k = 1; k < 7; k++) { c.beginPath(); c.moveTo(k * W / 7 + (k % 2 ? 2 : -2) * u, 0); c.bezierCurveTo(k * W / 7 - 3 * u, H * 0.3, k * W / 7 + 3 * u, H * 0.7, k * W / 7, H); c.stroke(); }
  c.strokeStyle = 'rgba(22,18,16,.35)'; c.setLineDash([2 * u, 2 * u]); c.lineWidth = 0.6 * u; c.beginPath(); c.moveTo(6 * u, 101 * u); c.lineTo(94 * u, 101 * u); c.stroke(); c.setLineDash([]);
  const s = a ? a.mb : null, at = s ? (src.own && pend && pend.sq === src.zoom ? pend.t0 : fxAt('move', a)) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  const landed = s && t >= MARB.roll, k2 = s ? Math.max(0, Math.min(1, (t - MARB.roll) / MARB.drop)) : 0;
  mini.holes.forEach((h, i) => {
    const hit = s && s.hole === i && landed;
    c.fillStyle = '#3b2412'; c.strokeStyle = P.ink; c.lineWidth = 0.8 * u; c.beginPath(); c.arc(h.x * u, h.y * u, h.r * u, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#1d110a'; c.beginPath(); c.arc(h.x * u, (h.y + h.r * 0.14) * u, h.r * 0.84 * u, 0, 7); c.fill();
    c.font = `400 ${Math.round(Math.max(11, h.r * 1.15 * u))}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = hit ? '#ffd23f' : '#f7e9c8'; c.fillText(String(h.v), h.x * u, (h.y + 0.6) * u);
  });
  let more = false;
  const [fx, fy] = MARB.from;
  if (s) {
    const e = ease(t / MARB.roll), x = fx + (s.x - fx) * e, y = fy + (s.y - fy) * e;
    if (!landed) ball(c, u, x, y, MARB.r, col, P);
    else if (s.hole >= 0) { const h = mini.holes[s.hole]; if (k2 < 1) ball(c, u, s.x + (h.x - s.x) * k2, s.y + (h.y - s.y) * k2, MARB.r * (1 - 0.65 * k2), col, P, 1 - k2 * 0.6); const r2 = Math.min(1, (t - MARB.roll) / 420); c.save(); c.globalAlpha = Math.max(0, 1 - Math.max(0, (t - MARB.roll - 500) / 300)); c.font = `400 ${Math.round(12 * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 2 * u; c.strokeStyle = P.ink; c.fillStyle = '#ffd23f'; c.strokeText('+' + s.pts, h.x * u, (h.y - h.r - 2 - r2 * 6) * u); c.fillText('+' + s.pts, h.x * u, (h.y - h.r - 2 - r2 * 6) * u); c.restore(); }
    else if (!s.off) ball(c, u, s.x, s.y, MARB.r, col, P, Math.max(0.25, 1 - k2 * 0.75));
    more = t < MARB.roll + 900;
  } else if (pend && pend.sq === src.zoom) {                      // flicked here, the move still on its way: off along its aim
    const [ax, ay] = marbleAim(pend.m), e = ease((now - pend.t0) / MARB.roll) * 0.85;
    ball(c, u, fx + (ax - fx) * e, fy + (ay - fy) * e, MARB.r, col, P); more = now - pend.t0 < 6000;
  } else if (src.mine) ball(c, u, fx, fy, MARB.r, col, P);
  const left = src.left - (s || (pend && pend.sq === src.zoom) || !src.mine ? 0 : 1);
  for (let k = 0; k < left; k++) ball(c, u, 8 + k * 8, 113, MARB.r * 0.8, col, P);
  return more;
});
const words = l => (l.hole >= 0 ? `In the ${l.pts}!` : l.off ? 'Off the table' : 'Missed');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = marbleCfg(mini), s = a && a.mb ? a.mb : null, own = !!s && ownMove(a), o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d;
  if (pend && (s || pend.sq !== state.zoom) && !(s && own)) pend = null;
  const land = MARB.roll + (s && s.hole >= 0 ? MARB.drop : 0);
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && a.by === p ? s.from : null, land);
  const line = s ? `<p ${lateAt('mbline ' + (s.hole >= 0 ? 'ok' : 'no'), land)} role="status">${words(s)}</p>` : `<p class="mbline${l ? (l.hole >= 0 ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  const left = s ? s.left : mini.run && mini.run.by === turn ? mini.run.left : mine ? c.marbles : 0;
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom, left };
  if (s && own) setTimeout(() => { if (pend && state.flash !== a) pend = null; }, 0);
  go();
  return `<div class="g-mb pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="mbbox"><div class="mbfield${mine ? ' live' : ''}"><canvas class="mbcv" aria-label="The table: holes worth ${mini.holes.map(h => h.v).join(', ')}"></canvas></div></div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f || !mini.run ? '' : `<b class="${turn}">${N(turn)}</b>: ${mini.run.left} marble${mini.run.left === 1 ? '' : 's'} left`; }
// The miniature: the table with its holes and a marble, over each player's points as a bar.
export function miniature(mini, final) {
  const c = marbleCfg(mini), l = mini.last;
  const art = `<svg class="tmb" viewBox="0 0 100 120"><rect class="tmbt" x="2" y="2" width="96" height="116" rx="9"/>${mini.holes.map(h => `<circle class="tmbh" cx="${h.x}" cy="${h.y}" r="${h.r}"/>`).join('')}<circle class="tmbm ${l ? l.by : 'X'}" cx="${l && !l.off && l.hole < 0 ? l.x : 50}" cy="${l && !l.off && l.hole < 0 ? l.y : 108}" r="6"/></svg>`;
  return thumbArt(art, barRows(mini.score, c.target), 'tmbw', `Marble Toss: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.mb; return !s ? `${who} flicked` : s.hole >= 0 ? `${who} scored ${s.pts}` : `${who} missed`; }
// The flick (someone else's: a flick made here was heard as it was made), the marble's roll, then where it ends: a
// drop and a chime in a hole, a soft knock at rest on the table, a thud off it.
export function sounds(f, add, won, mini, last) {
  const s = f.mb; if (!s) return;
  if (!ownMove(f)) add('mbFlick', 0, 0.9 + s.p * 0.3);
  add('mbRoll', 40);
  if (s.hole >= 0) { add('mbDrop', MARB.roll + MARB.drop * 0.6); add('ding', MARB.roll + MARB.drop); } else add(s.off ? 'thud' : 'mbStop', MARB.roll);
}
