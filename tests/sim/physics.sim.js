'use strict';
// Simulations: physics games (Mini Golf, Pool, Bowling). Slow, so never part of npm test:
// npm run sim -- physics
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
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

test('physics games: the computer against the computer finishes matches of each, and of all three with the rest', () => {
  for (const [games, seed] of [[['golf'], 1], [['pool'], 2], [['bowling'], 3], [['golf', 'pool', 'bowling', 'ttt', 'dash'], 4]]) {
    const t0 = Date.now();
    const { st, n } = cpuMatch(games, seed);
    assert.ok(st.winner, `${games.join('+')}: a winner after ${n} moves`);
    assert.ok(n < 300, `${games.join('+')}: within 300 moves (${n})`);
    console.log(`${games.join('+')}: ${n} moves, ${Date.now() - t0} ms`);
  }
});
