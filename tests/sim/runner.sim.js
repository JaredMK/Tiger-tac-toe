'use strict';
// Simulations: runners (Dash, Lane Rush, Flap, Chopper). Slow, so never part of npm test:
// npm run sim -- runner
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
// Play whole turns until the match is over: the computer on both sides.
function cpuMatch(games, seed, guard = 900) {
  const rng = lcg(seed), st = E.newMatch(rng, { games });
  let n = 0;
  while (!st.winner && n++ < guard) {
    const m = E.cpuMove(st, rng);
    const r = E.playMove(st, m.square, m.move, rng);
    assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    E.endFlash(st);
  }
  return { st, n };
}

test('runners: the computer against the computer finishes matches of Dash, of Lane Rush and of both with the rest', () => {
  E.setRunConfig(null);
  for (const [games, seed] of [[['dash'], 1], [['lane'], 2], [['dash', 'lane'], 3], [['dash', 'lane', 'ttt', 'bullseye', 'pong'], 4]]) {
    const { st, n } = cpuMatch(games, seed);
    assert.ok(st.winner, `${games.join('+')}: a winner after ${n} moves`);
    assert.ok(n < 400);
    for (const sq of st.squares) if (sq.owner && E.RUN_TYPES.includes(sq.mini.type)) assert.equal(sq.mini.dist[sq.owner], sq.mini.cfg.target, 'a claimed runner square: its owner at the target');
  }
  assert.ok(E.TEST_TYPES.includes('dash') && E.TEST_TYPES.includes('lane'), 'both admin only to begin with');
  assert.ok(E.TYPES.includes('dash') && E.TYPES.includes('lane'));
});
