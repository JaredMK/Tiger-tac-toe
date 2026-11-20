'use strict';
// Glass Bridge (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/bridge/rules.js');
const M = require('../../src/games/bridge/meta.js');

const idx = m => max => Number.isInteger(m) && m >= 0 && m < max;
const safeOf = (m, p, r) => { const bad = m.sep ? m.bad[p][r] : m.bad[r]; return Array.from({ length: m.n[r] }, (_, i) => i).find(i => !bad.includes(i)); };

test('bridge: Admin only, luck; the deal: rows of platforms, every row with a safe one, the weak ones hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'luck', '1.24.0']);
  assert.deepEqual(E.tuneFields('bridge').map(f => f.k), ['rows', 'pmin', 'pmax', 'bmin', 'bmax', 'boards']);
  for (const set of [null, { pmin: 2, pmax: 3, bmin: 0, bmax: 2, rows: 9 }, { boards: 'separate' }]) {
    E.setTune('bridge', set);
    try {
      for (let g = 0; g < 60; g++) {
        const m = E.newMini('bridge', E.makeRng('d' + g));
        for (const lay of m.sep ? [m.bad.X, m.bad.O] : [m.bad]) m.n.forEach((k, r) => { assert.ok(k >= 2 && k <= 3); assert.ok(lay[r].length <= k - 1, 'a safe platform in every row'); assert.ok(lay[r].every(i => i >= 0 && i < k)); });
        if (m.sep) m.n.forEach((k, r) => assert.equal(m.bad.X[r].length, m.bad.O[r].length, 'as hard for each'));
        const pub = E.publicMini(m); assert.ok(!('bad' in pub), 'never public');
        assert.deepEqual(R.secret(m), { bad: m.bad }); const c = JSON.parse(JSON.stringify(m)); R.hide(c); assert.ok(!('bad' in c));
      }
    } finally { E.setTune('bridge', null); }
  }
  const d = E.newMini('bridge', E.makeRng('def')); assert.deepEqual([d.n.length, d.n.every(k => k === 3), d.bad.every(b => b.length === 2)], [6, true, true], 'the defaults: 6 rows of 3, 2 weak');
});

test('bridge: safe glass holds and keeps the turn; weak glass breaks for good, ends the turn and leaves the player where they were', () => {
  const m = E.newMini('bridge', E.makeRng('a')), s0 = safeOf(m, 'X', 0), b0 = m.bad[0][0];
  let r = E.applyMove(m, 'X', b0, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.at.X, m.seen[0][b0], m.falls.X], ['continue', 'fall', false, -1, 2, 1]);
  assert.equal(E.applyMove(m, 'O', b0, E.makeRng('x')).reason, 'gone', 'broken for both');
  r = E.applyMove(m, 'O', s0, E.makeRng('x'));
  assert.deepEqual([r.note, r.again, m.at.O, m.pos.O, m.seen[0][s0]], ['hop', true, 0, s0, 1]);
  assert.equal(E.applyMove(m, 'O', 7, E.makeRng('x')).ok, false);
  assert.ok(R.bridgeMoves(m, 'X').includes(s0) && !R.bridgeMoves(m, 'X').includes(b0));
  const hidden = JSON.parse(JSON.stringify(m)); R.hide(hidden);
  assert.equal(E.applyMove(hidden, 'X', s0, E.makeRng('x')).reason, 'secret', 'a phone without the layout cannot judge a hop');
});

test('bridge: a player crosses alone, however the other plays; landing on the last row wins', () => {
  const m = E.newMini('bridge', E.makeRng('b')); let r;
  for (let k = 0; k < m.n.length; k++) r = E.applyMove(m, 'X', safeOf(m, 'X', k), E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, m.at.X], ['win', 'across', m.n.length - 1]);
  for (let g = 0; g < 40; g++) {                                 // any play at all ends: one side hopping at random alone
    const rng = E.makeRng('solo' + g), t = E.newMini('bridge', rng); let won = false;
    for (let k = 0; k < 200 && !won; k++) won = E.applyMove(t, 'O', E.randomLegalMove(t, 'O', rng), rng).outcome === 'win';
    assert.ok(won);
  }
});

test('bridge: separate bridges: each player their own glass; one side\'s break changes nothing for the other', () => {
  E.setTune('bridge', { boards: 'separate' });
  try {
    const m = E.newMini('bridge', E.makeRng('s')), b = m.bad.X[0][0];
    E.applyMove(m, 'X', b, E.makeRng('x'));
    assert.equal(m.seen.X[0][b], 2); assert.equal(m.seen.O[0][b], 0);
    assert.equal(E.applyMove(m, 'O', safeOf(m, 'O', 0), E.makeRng('x')).again, true);
  } finally { E.setTune('bridge', null); }
});

test('bridge: the computer takes glass known to hold, else glass nobody has tried; a timeout mid-turn plays nothing', () => {
  const m = E.newMini('bridge', E.makeRng('c')), s0 = safeOf(m, 'X', 0);
  m.seen[0][s0] = 1;
  for (const level of ['normal', 'hard']) for (let k = 0; k < 10; k++) assert.equal(E.localBest(E.publicMini(m), 'O', E.makeRng(level + k), {}, { level }).move, s0);
  m.seen[0][s0] = 0; m.seen[0][m.bad[0][0]] = 2;
  for (let k = 0; k < 20; k++) assert.notEqual(E.localBest(E.publicMini(m), 'O', E.makeRng('n' + k), {}, { level: 'normal' }).move, m.bad[0][0]);
  assert.equal(R.timeoutClose(m, 'X'), null);
  const st = E.newMatch(E.makeRng('i'), { games: ['bridge'] }), p = st.turn, q = st.squares[4].mini;
  assert.ok(E.playMove(st, 4, safeOf(q, p, 0), E.makeRng('e')).ok);
  assert.deepEqual(st.flash.gb, { r: 0, i: q.pos[p], fall: false, from: -1 }); E.endFlash(st);
  assert.equal(st.lock, 4);
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.notEqual(st.turn, p); assert.equal(q.at[p], 0, 'the row reached is kept');
});
