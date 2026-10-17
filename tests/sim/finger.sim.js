'use strict';
// Simulations: finger games (Sky Hop, Scoop Stack, Pinball). Slow, so never part of npm test:
// npm run sim -- finger
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

test('the computer: an average player\'s hand needs about 3 to 6 attempts to win each', () => {
  const runs = { skyhop: [], scoop: [], pinball: [] };
  for (let s = 0; s < 10; s++) {
    for (const type of ['skyhop', 'scoop', 'pinball']) {
      const mini = E.newMini(type, E.makeRng('avg' + type + s)), rng = E.makeRng('hand' + type + s);
      let k = 0;
      while (E.fingAt(mini, 'X') < E.fingGoal(mini) && k < 30) {
        const m = E.fingAi(mini, 'X', rng), c = E.fingCheck(mini, 'X', m);
        assert.equal(c.why, null, `${type}: the computer's own attempt passes the checks`);
        if (type === 'skyhop') mini.height.X = Math.max(mini.height.X, E.hopResult(c.sim).h);
        else if (type === 'scoop') { mini.stack.X = mini.stack.X.concat(c.sim.got).slice(0, mini.cfg.target); mini.tries.X++; }
        else for (const [id] of m.hits) mini.lit.X[id] = 1;
        k++;
      }
      runs[type].push(k);
    }
  }
  for (const [type, a] of Object.entries(runs)) { const m = avg(a); console.log(`${type}: ${m.toFixed(2)} attempts on average (${a.join(' ')})`); assert.ok(m >= 2.5 && m <= 6.5, `${type}: ${m.toFixed(2)} attempts`); }
});
test('matches: the computer against the computer finishes matches of each finger game, and with the rest', () => {
  for (const [games, seed] of [[['skyhop'], 1], [['scoop'], 2], [['pinball'], 3], [['skyhop', 'scoop', 'pinball', 'ttt', 'dash', 'golf'], 4]]) {
    const rng = lcg(seed), st = E.newMatch(rng, { games });
    let n = 0;
    const t0 = Date.now();
    while (!st.winner && n++ < 900) {
      const m = E.cpuMove(st, rng);
      const r = E.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: refused (${r.reason})`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
      if (E.FINGER_TYPES.includes(st.flash.type)) assert.ok(st.flash.fing && (st.flash.fing.log != null || st.flash.fing.rec != null), 'the flash carries the attempt, for the replay');
      E.endFlash(st);
    }
    assert.ok(st.winner, `${games.join('+')}: a winner after ${n} moves`);
    console.log(`${games.join('+')}: ${n} moves, ${Date.now() - t0} ms`);
  }
});
