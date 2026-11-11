'use strict';
// "Go again on success" (November 2026, core/tune.js AGAIN_TUNE): one switch per game, off by default. Off, every move
// is one action and the turn ends (nothing but a game's own mechanics keeps it: 21's deal and hits, a push's new hand);
// on, a success keeps the turn. Squares played out by the computer, both ways.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const TYPES = ['war', 'craps', 'bj', 'rl', 'hangman', 'bs', 'pool', 'bus', 'oddone', 'pong'];
const MECHANIC = { bj: ['deal', 'hit', 'push'] };   // (21: a hand in play, or a tie dealt again: not a success)

function play(type, on, games) {
  E.setTune(type, on ? { again: 'on' } : null);
  let agains = 0;
  try {
    for (let g = 0; g < games; g++) {
      const rng = E.makeRng(type + on + g), m = E.newMini(type, rng); let p = 'X';
      for (let k = 0; k < 200; k++) {
        const mv = E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move;
        const r = E.applyMove(m, p, mv, rng);
        assert.ok(r.ok, `${type}: a legal move (${JSON.stringify(mv)}: ${r.reason})`);
        if (r.outcome !== 'continue') break;
        if (r.again && !(MECHANIC[type] || []).includes(r.note)) agains++;
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune(type, null); }
  return agains;
}
test('go again: every game that can keep the turn on a success has the switch, off by default', () => {
  for (const t of TYPES) {
    const f = E.tuneFields(t).find(x => x.k === 'again');
    assert.ok(f, t + ': the switch'); assert.deepEqual([f.label, f.def, f.opts], ['Go again on success', 'off', ['off', 'on']]);
    assert.equal(E.newMini(t, E.makeRng('d' + t)).tune, undefined, t + ': nothing kept for the default');
  }
});
test('go again: off, no success keeps the turn; on, successes do', () => {
  for (const t of TYPES) {
    const n = t === 'pool' || t === 'pong' ? 4 : 12;
    assert.equal(play(t, false, n), 0, t + ': off, never again');
    assert.ok(play(t, true, n) > 0, t + ': on, a success goes again');
  }
});
