'use strict';
// The attempt's time limit (November 2026): every real-time skill game with a run of its own (Snake runCap, Muncher
// runSecs, Star Swarm maxSecs, Brick Break runSecs: "Attempt time limit (s)") ends an attempt that reaches it as a crash
// would, its progress kept, and the server's check of the move agrees. Each played by the computer with a short limit.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const GAMES = [
  { t: 'snake', k: 'runCap', v: 10, end: 'out', score: m => m.score.X },
  { t: 'muncher', k: 'runSecs', v: 4, end: 'time', score: m => (m.ate ? m.ate.X.length : 0) + (m.gh ? m.gh.X : 0) },
  { t: 'swarm', k: 'maxSecs', v: 10, end: 'out', score: m => m.score.X },
  { t: 'bricks', k: 'runSecs', v: 10, end: 'out', score: m => m.wall.X.filter(b => !b).length },
];
test('attempt time limit: the setting is each game\'s own, labelled alike, at most a turn\'s 60 s', () => {
  for (const g of GAMES) {
    const f = E.tuneFields(g.t).find(x => x.k === g.k);
    assert.ok(f, g.t); assert.equal(f.label, 'Attempt time limit (s)'); assert.equal(f.group, 'Timing'); assert.ok(f.max <= 60, g.t);
  }
});
test('attempt time limit: an attempt that reaches it ends there as a crash would, its progress kept, and passes the server\'s check', () => {
  for (const g of GAMES) {
    E.setTune(g.t, { [g.k]: g.v });
    try {
      let capped = 0;
      for (let i = 0; i < 12 && capped < 2; i++) {
        const m = E.newMini(g.t, E.makeRng(g.t + 'cap' + i)), before = g.score(m);
        const mv = E.localBest(E.publicMini(m, 'X'), 'X', E.makeRng(g.t + 'ai' + i), {}, { level: 'hard', until: null }).move;
        if (mv.end !== g.end) continue;
        capped++;
        const r = E.applyMove(m, 'X', mv, E.makeRng('x'));
        assert.ok(r.ok, `${g.t}: the capped attempt is taken (${r.reason})`);
        assert.ok(g.score(m) >= before, g.t + ': nothing lost');
        assert.equal(m.last.end, g.end);
      }
      assert.ok(capped > 0, g.t + ': some attempts run to the limit');
    } finally { E.setTune(g.t, null); }
  }
});
