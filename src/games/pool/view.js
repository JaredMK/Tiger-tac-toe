// Pool: the screen, the miniature, the move's words and sounds, and the inputs.
import { PHYSICS } from '../shared/physics.js';
import { poolRank } from './rules.js';
import { state } from '../../ui/app.js';
import { physBall, physResult, physSkull, physTable, physThumb } from '../../ui/physics.js';
export { physReplay as replay } from '../../ui/physics.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

export const POOL_RAIL = 6;                                             // the pool table's rail, in table units, the same on all four sides
export function drawPool(g, mini, pos, pop) {   // pop: { id, s } a ball popping onto the table at scale s (a scratch: ui/physics.js poolPop)
  const c = g.c, P = runColours(), L = PHYSICS.lib, S = L.POOL;
  c.fillStyle = '#4a2b12'; c.fillRect(0, 0, g.W, g.H);                                   // round the table
  const M = g.M || 0;                                                                     // the rail: one width on every side, outlined like the rest of the game
  rr(c, g.X(-M), g.Y(-M), (S.w + 2 * M) * g.k, (S.h + 2 * M) * g.k, M * g.k * 0.9); outlined(c, '#7a4a22', P.ink, 2.5);
  c.fillStyle = '#2d8a4e'; c.fillRect(g.X(0), g.Y(0), S.w * g.k, S.h * g.k);           // the cloth
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.strokeRect(g.X(0), g.Y(0), S.w * g.k, S.h * g.k);
  c.fillStyle = 'rgba(255,255,255,.35)';                                                  // the spots
  for (const [x, y] of [S.start.cue, S.start.black]) { c.beginPath(); c.arc(g.X(x), g.Y(y), 1.1 * g.k, 0, Math.PI * 2); c.fill(); }
  for (const [x, y, r] of S.pockets) { c.beginPath(); c.arc(g.X(x), g.Y(y), r * g.k, 0, Math.PI * 2); c.fillStyle = '#0d0d0d'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#3b2412'; c.stroke(); }
  for (const id of Object.keys(pos).sort((a, b) => poolRank(a) - poolRank(b))) {
    if (!pos[id]) continue;
    const [x, y] = pos[id], r = pop && pop.id === id ? S.ballR * pop.s : S.ballR;
    if (r <= 0) continue;
    if (pop && pop.id === id) { physBall(g, x, y, r, id[0] === 'x' ? P.X : P.O, r > S.ballR * 0.6 ? id[0].toUpperCase() : '', P.ink); continue; }
    if (id === 'cue') physBall(g, x, y, S.ballR, '#fdfaf0', '', P.ink);
    else if (id === 'black') { physBall(g, x, y, S.ballR, '#1b1b1b', '', P.ink); physSkull(g, x, y, S.ballR); }
    else physBall(g, x, y, S.ballR, id[0] === 'x' ? P.X : P.O, id[0].toUpperCase(), P.ink);
  }
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
