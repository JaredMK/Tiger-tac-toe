// Mini Golf: the screen, the miniature, the move's words and sounds, and the inputs.
import { randInt } from '../../core/random.js';
import { PHYSICS } from '../shared/physics.js';
import { setGolfPick } from './rules.js';
import { state } from '../../ui/app.js';
import { physBall, physResult, physTable, physThumb } from '../../ui/physics.js';
export { physReplay as replay } from '../../ui/physics.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

// Mini Golf in a local game: a hole whose layout this device has not had lately (either way round), until
// most of them have come up; then it starts again (bar the last few). Online the server deals any hole.
const GOLF_SEEN = 'ttt-golf-seen';
setGolfPick((rng, holes) => {
  if (state && state.online) return null;
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
export function drawGolf(g, mini, pos, lit) {   // lit: the bumpers flashing now (a ball just kicked off them)
  const c = g.c, P = runColours(), L = PHYSICS.lib, S = L.GOLF, hole = L.HOLES[mini.hole];
  c.fillStyle = '#2f7a3a'; c.fillRect(0, 0, g.W, g.H);                                   // the surround
  c.fillStyle = '#5fbf5a'; c.fillRect(g.X(0), g.Y(0), S.w * g.k, S.h * g.k);           // the green
  c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1;                             // mown stripes
  for (let y = 0; y < S.h; y += 10) { c.fillStyle = (y / 10) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.03)'; c.fillRect(g.X(0), g.Y(y), S.w * g.k, 10 * g.k); }
  const tee = hole.tee;                                                                   // the tee mat
  c.fillStyle = 'rgba(0,0,0,.14)'; rr(c, g.X(tee[0] - 9), g.Y(tee[1] - 4), 18 * g.k, 8 * g.k, 3 * g.k); c.fill();
  for (const [x, y, w, h, a] of hole.walls) {                                             // the walls
    c.save(); c.translate(g.X(x), g.Y(y)); c.rotate(a || 0);
    rr(c, -w / 2 * g.k, -h / 2 * g.k, w * g.k, h * g.k, 2 * g.k); outlined(c, '#c58a4a', P.ink, 2.5);
    c.restore();
  }
  hole.bumpers.forEach(([x, y, r], k) => {                                               // the bumpers (one that has just kicked a ball off: lit, with a glow)
    const on = !!(lit && lit.has(k));
    if (on) { c.beginPath(); c.arc(g.X(x), g.Y(y), r * g.k * 1.8, 0, Math.PI * 2); c.fillStyle = 'rgba(246, 194, 27, .5)'; c.fill(); }
    c.beginPath(); c.arc(g.X(x), g.Y(y), r * g.k, 0, Math.PI * 2); outlined(c, on ? '#fff3b8' : '#f3f0e6', P.ink, 2.5);
    c.beginPath(); c.arc(g.X(x), g.Y(y), r * g.k * 0.5, 0, Math.PI * 2); c.fillStyle = on ? P.O : P.X; c.fill();
  });
  const cup = hole.cup;                                                                   // the cup, with its flag
  c.beginPath(); c.arc(g.X(cup[0]), g.Y(cup[1]), S.cupR * g.k, 0, Math.PI * 2); c.fillStyle = '#17331c'; c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();
  const fx = g.X(cup[0]), fy = g.Y(cup[1]), ph = 15 * g.k;                              // the flag: a straight pole up from the cup, the flag on its top
  c.lineCap = 'round'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - ph); c.lineWidth = 4.5; c.strokeStyle = P.ink; c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#f3f0e6'; c.stroke();
  c.beginPath(); c.moveTo(fx + 1, fy - ph); c.lineTo(fx + 9 * g.k, fy - ph + 3.2 * g.k); c.lineTo(fx + 1, fy - ph + 6.4 * g.k); c.closePath(); outlined(c, P.X, P.ink, 2);
  for (const p of ['X', 'O']) if (pos[p]) physBall(g, pos[p][0], pos[p][1], S.ballR, p === 'X' ? P.X : P.O, p, P.ink);
}
export function miniature(mini, final) {
  return physThumb(mini);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = physTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return physResult(f, true).text;
}
