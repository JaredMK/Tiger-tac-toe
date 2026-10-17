'use strict';
// Simulations: card games and the wheel (Blackjack, Ride the Bus, Roulette). Slow, so never part of npm test:
// npm run sim -- cards
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('computer against computer: mixed matches with every game finish, and the three get played', () => {
  const played = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const rng = lcg(seed * 7 + 3), st = E.newMatch(rng);
    st.squares.forEach((sq, i) => { if (i < 3) sq.mini = E.newMini(['bj', 'bus', 'rl'][i], rng); });   // one of each in every match
    let n = 0;
    while (!st.winner && n++ < 900) {
      const m = E.cpuMove(st, rng);
      const r = E.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      played.add(st.flash.type);
      E.endFlash(st);
    }
    assert.ok(st.winner, `match ${seed} finishes (${n} moves)`);
  }
  for (const t of ['bj', 'bus', 'rl']) assert.ok(played.has(t), `${t} was played`);
});
