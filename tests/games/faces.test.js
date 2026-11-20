'use strict';
// Mystery Face (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/faces/rules.js');
const M = require('../../src/games/faces/meta.js');

test('faces: Admin only, brain; the deal: distinct faces, a mystery face each (never the same), hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'brain', '1.24.0']);
  assert.deepEqual(E.tuneFields('faces').map(f => f.k), ['faces', 'traits', 'vals', 'clue', 'boards']);
  for (let g = 0; g < 40; g++) {
    const m = E.newMini('faces', E.makeRng('d' + g));
    assert.deepEqual([m.faces.length, m.faces[0].length, m.sep, m.clue], [16, 5, true, 'which']);
    assert.equal(new Set(m.faces.map(f => f.join(''))).size, 16, 'no two faces the same');
    for (const f of m.faces) for (const v of f) assert.ok(v >= 0 && v < 3);
    assert.notEqual(m.tg.X, m.tg.O);
    assert.ok(!('tg' in E.publicMini(m))); const c = JSON.parse(JSON.stringify(m)); R.hide(c); assert.ok(!('tg' in c)); assert.deepEqual(R.secret(m), { tg: m.tg });
  }
  E.setTune('faces', { faces: 20, traits: 3, vals: 2 });
  try { assert.equal(E.newMini('faces', E.makeRng('small')).faces.length, 8, 'never more faces than there are different ones'); } finally { E.setTune('faces', null); }
});

test('faces: a guess gets a tick or a cross on every feature; a face is never guessed twice; one\'s own mystery face wins', () => {
  const m = E.newMini('faces', E.makeRng('a')), other = [...m.faces.keys()].find(i => i !== m.tg.X && i !== m.tg.O);
  let r = E.applyMove(m, 'X', other, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again], ['continue', 'clue', false]);
  assert.deepEqual(m.g.X[0], { f: other, m: m.faces[other].map((v, j) => (v === m.faces[m.tg.X][j] ? 1 : 0)) });
  assert.equal(E.applyMove(m, 'X', other, E.makeRng('x')).reason, 'guessed');
  assert.equal(E.applyMove(m, 'O', other, E.makeRng('x')).ok, true, 'the other player\'s clues are their own');
  assert.ok(R.faceLeft(m, 'X').includes(m.tg.X) && !R.faceLeft(m, 'X').includes(other), 'the mystery face is always still possible');
  assert.equal(E.applyMove(m, 'X', m.tg.O, E.makeRng('x')).outcome, 'continue', 'the other player\'s face is only a guess');
  r = E.applyMove(m, 'X', m.tg.X, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, m.last.hit], ['win', 'found', true]);
  assert.equal(E.applyMove(m, 'O', 99, E.makeRng('x')).ok, false);
  const hidden = JSON.parse(JSON.stringify(m)); R.hide(hidden); assert.equal(E.applyMove(hidden, 'O', 0, E.makeRng('x')).reason === 'secret' || hidden.g.O.some(c => c.f === 0), true);
});

test('faces: the other clues: one feature in common (one not shown yet), or how many match; what is known so far', () => {
  for (const clue of ['one', 'count']) {
    E.setTune('faces', { clue });
    try {
      for (let g = 0; g < 30; g++) {
        const rng = E.makeRng(clue + g), m = E.newMini('faces', rng); let won = false;
        for (let k = 0; k < 20 && !won; k++) {
          const left = R.faceLeft(m, 'X'); assert.ok(left.includes(m.tg.X), 'the mystery face fits every clue');
          const f = left[0], r = E.applyMove(m, 'X', f, rng), c = m.g.X[m.g.X.length - 1];
          const same = m.faces[f].map((v, j) => (v === m.faces[m.tg.X][j] ? 1 : 0)), n = same.reduce((x, v) => x + v, 0);
          if (clue === 'count') assert.deepEqual(c, { f, n }); else if (!m.last.hit) { assert.equal(c.m, undefined); if (c.j < 0) assert.equal(n, 0); else assert.equal(same[c.j], 1); }
          won = r.outcome === 'win';
        }
        assert.ok(won);
        if (clue === 'one') R.faceKnown(m, 'X').forEach((v, j) => { if (v >= 0) assert.equal(v, m.faces[m.tg.X][j], 'what is known is true'); });
      }
    } finally { E.setTune('faces', null); }
  }
});

test('faces: shared: one mystery face, every clue goes for both, the first to guess it wins', () => {
  E.setTune('faces', { boards: 'shared' });
  try {
    const m = E.newMini('faces', E.makeRng('s')), other = [...m.faces.keys()].find(i => i !== m.tg);
    assert.equal(typeof m.tg, 'number');
    E.applyMove(m, 'X', other, E.makeRng('x'));
    assert.equal(E.applyMove(m, 'O', other, E.makeRng('x')).reason, 'guessed'); assert.deepEqual(R.faceLeft(m, 'O'), R.faceLeft(m, 'X'));
    assert.equal(E.applyMove(m, 'O', m.tg, E.makeRng('x')).outcome, 'win');
  } finally { E.setTune('faces', null); }
});

test('faces: the computer guesses only faces its clues leave possible (Easy strays); Hard takes the guess that leaves fewest; a timeout plays nothing', () => {
  for (const level of ['normal', 'hard']) for (let g = 0; g < 25; g++) {
    const rng = E.makeRng(level + g), m = E.newMini('faces', rng); let won = false, n = 0;
    for (let k = 0; k < 16 && !won; k++) { const mv = E.localBest(E.publicMini(m), 'O', rng, {}, { level }).move; assert.ok(R.faceLeft(m, 'O').includes(mv)); won = E.applyMove(m, 'O', mv, rng).outcome === 'win'; n++; }
    assert.ok(won && n <= 5, `${level}: found in ${n}`);
  }
  const st = E.newMatch(E.makeRng('i'), { games: ['faces'] }), p = st.turn, q = st.squares[4].mini, other = [...q.faces.keys()].find(i => i !== q.tg.X && i !== q.tg.O);
  assert.ok(E.playMove(st, 4, other, E.makeRng('e')).ok);
  assert.deepEqual(Object.keys(st.flash.fc).sort(), ['clue', 'f', 'hit', 'k', 'm']); assert.ok(E.playMs(st.flash) >= R.facesMs('which', 5));
  assert.equal(R.timeoutClose(q, p), null);
});
