// Pool: the screen, the miniature, the move's words and sounds, and the inputs.
import { PHYSICS } from '../shared/physics.js';
import { poolIds, poolLeft, poolRank } from './rules.js';
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
// The miniature: the table as it stands (the pockets and the balls left, each in its side's colour, no numbers on them)
// and beside it each side's balls still to sink, its mark and the count.
// The table as the miniature draws it before the physics library has loaded (the board shows Pool at once, its felt,
// rails, pockets and balls: the same sizes as physics-sim.js POOL, which takes over once it is in).
const POOL_TABLE = { w: 100, h: 180, ballR: 3.9, pockets: [[0, 0, 8.4], [100, 0, 8.4], [0, 90, 8.4], [100, 90, 8.4], [0, 180, 8.4], [100, 180, 8.4]] };
export function miniature(mini, final) {
  const L = PHYSICS.lib;
  const S = L ? L.POOL : POOL_TABLE, cls = id => (id === 'cue' ? 'cue' : id === 'black' ? 'black' : id[0].toUpperCase());
  const balls = poolIds(mini).map(id => (mini.down[id] ? '' : `<circle cx="${mini.balls[id][0]}" cy="${mini.balls[id][1]}" r="${S.ballR * 1.6}" class="${cls(id)}"/>`)).join('');
  return `<div class="tpool" aria-label="Pool: X has ${poolLeft('X', mini)} balls left, O has ${poolLeft('O', mini)}"><svg class="tphys" viewBox="-4 -4 ${S.w + 8} ${S.h + 8}" aria-hidden="true">
      <rect x="-4" y="-4" width="${S.w + 8}" height="${S.h + 8}" rx="4" class="rail"/><rect x="0" y="0" width="${S.w}" height="${S.h}" class="cloth"/>
      ${S.pockets.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="pocket"/>`).join('')}${balls}</svg>`
    + `<div class="tpcnt">${['X', 'O'].map(p => `<div class="${p}"><b class="${p}">${p}</b><span>${poolLeft(p, mini)}</span></div>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = physTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return physResult(f, true).text;
}
