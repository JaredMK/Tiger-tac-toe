'use strict';
// Simulations: Pool. Slow, so never part of npm test:
// npm run sim -- pool
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
const inside = (pos, S) => pos == null || (pos[0] >= -0.01 && pos[0] <= S.w + 0.01 && pos[1] >= -0.01 && pos[1] <= S.h + 0.01);

test('pool: balls never leave the table nor end overlapping; pockets take what rolls into them', () => {
  const rng = lcg(11);
  let pocketed = 0;
  for (let k = 0; k < 40; k++) {
    const m = mini('pool', 'tbl' + k);
    const r = P.run('pool', m, 'X', { aim: (rng() - 0.5) * 1.2, power: 0.5 + rng() * 0.5 });
    const up = Object.entries(r.final).filter(([, v]) => v);
    for (const [id, v] of up) assert.ok(inside(v, P.POOL), `${id} on the table (${v})`);
    for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) assert.ok(Math.hypot(up[i][1][0] - up[j][1][0], up[i][1][1] - up[j][1][1]) >= P.POOL.ballR * 2 - 0.3, `${up[i][0]} and ${up[j][0]} do not overlap`);
    pocketed += r.result.pocketed.length;
    for (const id of r.result.pocketed) assert.equal(r.final[id], null, 'a pocketed ball is gone');
  }
  // the balls half as big again as they were (2.6 across the radius), the pockets twice the size (4.2): about 2.2 times the ball across
  assert.ok(Math.abs(P.POOL.ballR - 2.6 * 1.5) < 1e-9); for (const [, , r] of P.POOL.pockets) assert.ok(Math.abs(r - 4.2 * 2) < 1e-9, `a pocket ${2 * r} across, the ball ${2 * P.POOL.ballR}`);
  // the rack still fits: every ball clear of the others, of the rails and of the pockets
  const st = Object.entries(P.POOL.start);
  for (const [id, [x, y]] of st) { assert.ok(x - P.POOL.ballR > 0 && x + P.POOL.ballR < P.POOL.w && y - P.POOL.ballR > 0 && y + P.POOL.ballR < P.POOL.h, `${id} on the table`); for (const [px, py, pr] of P.POOL.pockets) assert.ok(Math.hypot(x - px, y - py) > pr + P.POOL.ballR * 2, `${id} well clear of the pockets`); }
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) assert.ok(Math.hypot(st[i][1][0] - st[j][1][0], st[i][1][1] - st[j][1][1]) > 2 * P.POOL.ballR + 2, `${st[i][0]} and ${st[j][0]} apart`);
  let aimed = 0;
  for (let g = 0; g < 4; g++) {                                // the computer's shots through a few racks
    const m = mini('pool', 'aim' + g); let turn = 'X';
    for (let k = 0; k < 12; k++) { const ai = E.physAi(m, turn, rng), r = E.applyMove(m, turn, ai.move, rng); aimed += m.last.own + m.last.theirs; if (r.outcome === 'win') break; if (!r.again) turn = turn === 'X' ? 'O' : 'X'; }
  }
  assert.ok(aimed + pocketed > 3, `aimed shots pocket something now and then (${aimed} in up to 48, and ${pocketed} from 40 random)`);
});
