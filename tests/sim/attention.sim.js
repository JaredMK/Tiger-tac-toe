'use strict';
// Simulations: attention games (Headcount, Flash, Snapshot). Slow, so never part of npm test:
// npm run sim -- attention
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('attention games: the computer gets right as often as a typical player (Headcount 45%, 30%, 20%; Flash 80%, 70%, 60%; Snapshot 65%, 50%, 35%), and its misses are near misses', () => {
  const want = { headcount: [0.45, 0.3, 0.2], flash: [0.8, 0.7, 0.6], snapshot: [0.65, 0.5, 0.35] };
  for (const type of E.ATT_TYPES) for (const level of [0, 1, 2]) {
    const rng = lcg(91 + level); let ok = 0; const N = 1200;
    for (let k = 0; k < N; k++) {
      const m = E.newMini(type, lcg(k)); m.right.X = level; m.round.X = E.attRound(type, level, lcg(k + 5));
      const b = E.localBest(E.publicMini(m), 'X', rng);
      assert.ok(E.attValid(type, m.round.X, b.move), 'a real answer');
      if (E.attJudge(type, m.round.X, b.move)) ok++;
      else if (type === 'headcount') assert.ok(Math.abs(b.move - E.attTruth(type, m.round.X)) <= 2, 'one or two off');
    }
    assert.equal(E.attOk(type, level), want[type][level]);
    assert.ok(Math.abs(ok / N - want[type][level]) < 0.045, `${type} level ${level + 1}: ${(ok / N).toFixed(3)} (wanted ~${want[type][level]})`);
  }
});
