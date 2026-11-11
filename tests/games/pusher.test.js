'use strict';
// Coin Pusher (November 2026): its rules and computer, test by test (npm test). The engine is the one the page and the
// server run: the move is played on the server online, and the phones play the same frames again from the flash.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/pusher/rules.js');
const A = require('../../src/games/pusher/ai.js');

const fresh = s => E.newMini('pusher', E.makeRng('psh-' + s));
const clone = v => JSON.parse(JSON.stringify(v));

test('pusher: each player their own machine, alike at the start, its coins in whole units; the settings are the admin\'s', () => {
  const m = fresh('a'), c = E.tuneLive('pusher');
  assert.equal(c.target, 12); assert.equal(c.perMove, 3); assert.equal(c.again, 'off');
  assert.equal(m.coins.X.length, c.start); assert.deepEqual(m.coins.X, m.coins.O);
  assert.ok(m.coins.X.every(a => Number.isInteger(a[0]) && Number.isInteger(a[1])));
  assert.deepEqual(m.score, { X: 0, O: 0 });
  assert.equal(E.applyMove(clone(m), 'X', { s: [1, 2] }, E.makeRng('x')).ok, false, 'three slots, no fewer');
  assert.equal(E.applyMove(clone(m), 'X', { s: [1, 2, 9] }, E.makeRng('x')).ok, false, 'slots 0..8 only');
  E.setTune('pusher', { target: 20, start: 30 });
  try { const t = fresh('b'); assert.equal(t.coins.X.length, 30); assert.deepEqual(t.tune, { target: 20, start: 30 }); } finally { E.setTune('pusher', null); }
});

test('pusher: the same move gives the same push, frame for frame: the server\'s result and the phones\' replay agree', () => {
  const m = fresh('c'), m2 = clone(m);
  const r1 = E.applyMove(m, 'X', { s: [4, 4, 5] }, E.makeRng('same')), r2 = E.applyMove(m2, 'X', { s: [4, 4, 5] }, E.makeRng('same'));
  assert.deepEqual([r1, m.coins, m.score], [r2, m2.coins, m2.score]);
  const l = m.last, c = E.tuneLive('pusher'), replay = R.pushSim(c, l.from, l.drops, true, l.ph);
  assert.deepEqual(replay.coins, m.coins.X, 'the replay from the flash ends where the server did');
  assert.equal(replay.scored, l.scored); assert.equal(replay.frames.length, Math.round(c.secs * R.PUSH.hz));
  assert.deepEqual(R.pushSim(c, l.from, l.drops, true, l.ph).frames, replay.frames, 'every frame the same');
  // the flash carries what the replay needs, and the move's sounds and time
  const st = E.newMatch(E.makeRng('pm'), { games: ['pusher'] }); st.turn = 'X';
  assert.ok(E.playMove(st, 4, { s: [0, 4, 8] }, E.makeRng('f')).ok);
  const f = st.flash.push;
  for (const k of ['slots', 'drops', 'ph', 'from', 'scored', 'pts', 'lost', 'before', 'after', 'ms']) assert.ok(k in f, k);
  assert.ok(E.playMs(st.flash) >= f.ms);
});

test('pusher: coins over the front edge score (a star coin its worth), coins off the sides near the front are lost, and the machine keeps the rest', () => {
  const c = Object.assign(E.tuneLive('pusher'), { starPct: 0 }), r = R.PUSH.r, Q = R.PUSH.Q;
  // a column of coins from the bar to the front edge: the push shoves the front one over
  const col = []; for (let y = R.PUSH.back + r + 0.001; y < 1; y += 2 * r) col.push([Math.round(0.5 * Q), Math.round(y * Q)]);
  const res = R.pushSim(c, col, [], false, 0);
  assert.ok(res.scored >= 1, 'a full column: the front coin goes over'); assert.equal(res.pts, res.scored);
  assert.equal(res.coins.length + res.scored + res.lost, col.length, 'every coin counted');
  const star = col.map((a, i) => (i === col.length - 1 ? a.concat([1]) : a)), rs = R.pushSim(Object.assign({}, c, { starWorth: 3 }), star, [], false, 0);
  assert.equal(rs.pts, rs.scored + 2, 'the star coin at the front is worth 3');
  // a coin at the edge of a gutter, pushed outwards by its neighbour, is lost
  const side = [[Math.round(0.02 * Q), Math.round(0.9 * Q)], [Math.round(0.08 * Q), Math.round(0.9 * Q)]];
  const rl = R.pushSim(c, side, [], false, 0);
  assert.equal(rl.lost, 1); assert.equal(rl.coins.length, 1);
  // the machine persists: the next move starts from what the last left
  const m = fresh('d'), was = m.coins.O.slice();
  E.applyMove(m, 'X', { s: [3, 4, 5] }, E.makeRng('p1'));
  assert.deepEqual(m.coins.O, was, "the other player's machine untouched");
  assert.equal(m.coins.X.length, was.length + 3 - m.last.scored - m.last.lost);
  const keep = m.coins.X.slice(); E.applyMove(m, 'O', { s: [0, 0, 0] }, E.makeRng('p2'));
  assert.deepEqual(m.last.from, was); assert.deepEqual(m.coins.X, keep);
});

test('pusher: reaching the target lets the other player finish the round; the higher total wins, level totals are a draw', () => {
  const m = fresh('e'); m.score = { X: 11, O: 3 }; m.turns = { X: 4, O: 4 }; m.moves = { X: 4, O: 4 }; m.last = { by: 'O' };
  m.coins.X = m.coins.X.concat([]);
  // X reaches 12 on a full shelf (pushes coins off)
  let r = null; for (let k = 0; k < 20 && !(r && r.note === 'reached'); k++) { const t = clone(m); r = E.applyMove(t, 'X', { s: [k % 9, 4, 4] }, E.makeRng('r' + k)); if (r.note === 'reached') Object.assign(m, t); }
  assert.equal(r.note, 'reached'); assert.equal(r.outcome, 'continue'); assert.deepEqual(m.final, { by: 'X' });
  const o = E.applyMove(clone(m), 'O', { s: [4, 4, 4] }, E.makeRng('o'));
  assert.equal(o.outcome, 'win'); assert.equal(o.winner, 'X', 'O could not catch up');
  const lvl = clone(m); lvl.score.O = lvl.score.X; lvl.coins.O = [];   // (an empty shelf: O's last turn scores nothing)
  assert.equal(E.applyMove(lvl, 'O', { s: [4, 4, 4] }, E.makeRng('l')).outcome, 'draw', 'level: a draw');
  // the second player reaching it: settled at once (the round is complete)
  const s = fresh('g'); s.score = { X: 5, O: 11 }; s.turns = { X: 5, O: 4 }; s.moves = { X: 5, O: 4 }; s.last = { by: 'X' };
  for (let k = 0; k < 20; k++) { const t = clone(s), rr = E.applyMove(t, 'O', { s: [k % 9, 4, 4] }, E.makeRng('s' + k)); if (t.score.O >= 12) { assert.deepEqual([rr.outcome, rr.winner], ['win', 'O']); break; } }
});

test('pusher: the computer: legal drops at every level; Normal leans on the fullest column; Hard through the real push, quickly; needs counts turns', () => {
  const m = fresh('h'), pm = E.publicMini(m, 'X');
  for (const level of ['easy', 'normal', 'hard']) {
    const b = E.localBest(pm, 'X', E.makeRng('ai' + level), {}, { level, until: null });
    assert.ok(Array.isArray(b.move.s) && b.move.s.length === 3 && b.move.s.every(s => s >= 0 && s < 9), level);
    assert.ok(E.applyMove(clone(m), 'X', b.move, E.makeRng('a')).ok);
  }
  const shelf = []; for (let y = 0.3; y < 0.98; y += 0.1) shelf.push([Math.round(0.85 * R.PUSH.Q), Math.round(y * R.PUSH.Q)]);
  assert.ok(A.pushPressure(shelf, 7) > A.pushPressure(shelf, 1), 'pressure where the coins are');
  assert.equal(A.pushNormal(shelf, 3)[0], 7);
  const t0 = performance.now(); E.localBest(pm, 'X', E.makeRng('h'), {}, { level: 'hard', until: null });
  assert.ok(performance.now() - t0 < 1500, 'Hard is quick');
  assert.ok(A.needs(pm, 'X') >= 1);
});

test('pusher: whole squares between the computers end with a winner or a draw in a few turns', () => {
  let ended = 0;
  for (let g = 0; g < 20; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('pusher', rng); let p = 'X';
    for (let k = 0; k < 60; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { ended++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(ended, 20);
});
