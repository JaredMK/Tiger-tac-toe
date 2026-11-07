'use strict';
// Apple Pick: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/apple/ai.js');
const R = require('../../src/games/apple/rules.js');
const { timeoutClose } = require('../../src/core/board.js');
E.setPhysics(require('../physics.js'));
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

const BIRD = R.BIRD, SPILL = R.SPILL;
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const land = (k, n = 10) => seq((k + 0.5) / n, 0.5);   // an rng that lands the spin in segment k (then the stop inside it)
const mini = (bucket, seed) => { const m = E.newMini('apple', E.makeRng(seed || 'ap')); if (bucket) Object.assign(m.bucket, bucket); return m; };
const spin = (m, p, k) => E.applyMove(m, p, 'spin', land(k, m.segs.length));

/* ===================================== Apple Pick ===================================== */
test('apple: the defaults: 10 apples a tree, ten segments (two of each pick, the bird, a spill) dealt round the wheel in turn, both buckets empty', () => {
  const m = mini();
  assert.equal(m.target, 10); assert.deepEqual(m.segs, [1, 3, BIRD, 2, 4, SPILL, 1, 3, 2, 4]);
  assert.deepEqual(m.bucket, { X: 0, O: 0 }); assert.deepEqual(m.spins, { X: 0, O: 0 }); assert.equal(m.last, null); assert.equal(m.rest, 0);
  assert.equal(R.appleTree(m, 'X'), 10);
  for (const bad of ['roll', 0, null, ['spin'], 'bank']) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false);
  assert.equal(E.randomLegalMove(m, 'X', lcg(2)), 'spin');
  assert.deepEqual(R.appleSegs({ one: 0, two: 0, three: 0, four: 0, bird: 2, spill: 1 }), [1, 3, BIRD, 2, 4, SPILL, BIRD], 'no picks at all: one of each number is dealt');
  assert.deepEqual(R.appleSegs({ one: 1, two: 1, three: 1, four: 1, bird: 0, spill: 0 }), [1, 3, 2, 4]);
});

test('apple: a pick moves that many apples from the tree to the bucket (never past the target), the bird takes two back, a spill tips half the bucket back (rounded up), never below empty', () => {
  const m = mini();
  assert.deepEqual(spin(m, 'X', 1), { ok: true, outcome: 'continue', note: 'pick' });   // segment 1: pick 3
  assert.equal(m.bucket.X, 3); assert.equal(R.appleTree(m, 'X'), 7); assert.equal(m.spins.X, 1);
  assert.deepEqual([m.last.by, m.last.kind, m.last.seg, m.last.v, m.last.n, m.last.was, m.last.bucket], ['X', 'pick', 1, 3, 3, 0, 3]);
  assert.ok(m.last.at > 0.1 && m.last.at < 0.2 && m.last.from === 0 && m.rest === m.last.at, 'the stop inside its segment, from where the wheel rested');
  assert.deepEqual(spin(m, 'X', 2), { ok: true, outcome: 'continue', note: 'bird' });   // the bird: 2 back
  assert.equal(m.bucket.X, 1); assert.deepEqual([m.last.kind, m.last.v, m.last.n, m.last.was], ['bird', BIRD, 2, 3]);
  assert.deepEqual(spin(m, 'X', 2), { ok: true, outcome: 'continue', note: 'bird' });   // the bird again: only the one apple there
  assert.equal(m.bucket.X, 0); assert.equal(m.last.n, 1);
  assert.deepEqual(spin(m, 'X', 2), { ok: true, outcome: 'continue', note: 'bird' });   // an empty bucket: nothing to take
  assert.equal(m.bucket.X, 0); assert.equal(m.last.n, 0);
  spin(m, 'X', 4); spin(m, 'X', 0);                                                       // 4 then 1: 5 in the bucket
  assert.equal(m.bucket.X, 5);
  assert.deepEqual(spin(m, 'X', 5), { ok: true, outcome: 'continue', note: 'spill' });  // a spill: half of 5, rounded up
  assert.equal(m.bucket.X, 2); assert.deepEqual([m.last.kind, m.last.v, m.last.n], ['spill', SPILL, 3]);
  spin(m, 'X', 5); assert.equal(m.bucket.X, 1); spin(m, 'X', 5); assert.equal(m.bucket.X, 0);
  assert.deepEqual(spin(m, 'X', 5), { ok: true, outcome: 'continue', note: 'spill' }); assert.equal(m.last.n, 0, 'an empty bucket spills nothing');
  assert.deepEqual(m.bucket, { X: 0, O: 0 }, 'O\'s bucket is O\'s');
  // the win: the pick that fills the bucket, the extra apples not picked
  m.bucket.X = 8;
  assert.deepEqual(spin(m, 'X', 4), { ok: true, outcome: 'win', note: 'full' });
  assert.deepEqual([m.bucket.X, m.last.n, m.last.v, R.appleTree(m, 'X')], [10, 2, 4, 0], 'a 4 with two to go picks two');
  m.bucket.O = 9; assert.deepEqual(spin(m, 'O', 0), { ok: true, outcome: 'win', note: 'full' }); assert.equal(m.bucket.O, 10);
});

test('apple: over thousands of random spins no bucket goes below empty or past the target, every segment comes up about as often, and a win is the full bucket', () => {
  const rng = E.makeRng('ap-random'), hit = new Array(10).fill(0);
  let wins = 0, spins = 0;
  for (let g = 0; g < 400; g++) {
    const m = mini(null, 'g' + g);
    let p = 'X';
    for (let k = 0; k < 400; k++) {
      const r = E.applyMove(m, p, 'spin', rng); spins++;
      assert.ok(r.ok); hit[m.last.seg]++;
      assert.ok(m.bucket[p] >= 0 && m.bucket[p] <= 10, `bucket ${m.bucket[p]}`);
      assert.equal(m.last.bucket, m.bucket[p]); assert.equal(m.last.was + (m.last.kind === 'pick' ? m.last.n : -m.last.n), m.bucket[p]);
      assert.equal(r.outcome === 'win', m.bucket[p] === 10);
      if (r.outcome === 'win') { wins++; break; }
      assert.ok(!r.again, 'one spin a move');
      p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 400);
  hit.forEach((h, k) => assert.ok(Math.abs(h / spins - 0.1) < 0.02, `segment ${k}: ${(100 * h / spins).toFixed(1)}%`));
});

test('apple: the public view is the whole square (nothing hidden), its settings with it; the flash carries the spin and its apples; flashMs covers the spin and every apple\'s journey', () => {
  E.setTune('apple', { apples: 8, bird: 2, spillPct: 100, birdTakes: 3 });
  const m = E.newMini('apple', E.makeRng('ap-tune'));
  E.setTune('apple', null);
  assert.deepEqual(m.tune, { apples: 8, bird: 2, spillPct: 100, birdTakes: 3 });
  assert.equal(m.target, 8); assert.deepEqual(m.segs, [1, 3, BIRD, 2, 4, SPILL, 1, 3, BIRD, 2, 4]);
  const pv = E.publicMini(m);
  assert.deepEqual(pv, { type: 'apple', target: 8, segs: m.segs, bucket: { X: 0, O: 0 }, spins: { X: 0, O: 0 }, rest: 0, last: null, tune: m.tune });
  assert.equal(E.secretOf(m), null, 'no secret');
  m.bucket.X = 5;
  assert.equal(spin(m, 'X', 2).note, 'bird'); assert.equal(m.bucket.X, 2, 'the admin\'s bird takes 3');
  m.bucket.X = 5;
  assert.equal(spin(m, 'X', 5).note, 'spill'); assert.equal(m.bucket.X, 0, 'the admin\'s spill tips the whole bucket');
  // the flash, through playMove
  const st = E.newMatch(E.makeRng('ap-st'), { games: ['ttt', 'apple'] });
  st.squares[0] = { owner: null, mini: mini({ X: 7 }) }; st.turn = 'X';
  const r = E.playMove(st, 0, 'spin', land(1));
  assert.ok(r.ok); assert.equal(st.flash.kind, 'claim'); assert.equal(st.flash.note, 'full'); assert.equal(st.flash.m, 'spin');
  assert.deepEqual(st.flash.apple, { by: 'X', kind: 'pick', seg: 1, at: st.squares[0].mini.last.at, from: 0, v: 3, n: 3, was: 7, bucket: 10, target: 10 });
  const T = R.APPLET, f = st.flash;
  assert.deepEqual(R.appleTimes(f.apple), { landed: T.spin, start: T.spin + T.hold, land: T.spin + T.hold + 2 * T.gap + T.fall, end: T.spin + T.hold + 2 * T.gap + T.fall });
  assert.equal(E.playMs(f, 4), T.spin + T.hold + 2 * T.gap + T.fall + T.won, 'a square won: the burst after the last apple lands');
  assert.equal(R.flashMs({ apple: { kind: 'pick', n: 2 } }, 4, false), T.spin + T.hold + T.gap + T.fall);
  assert.equal(R.flashMs({ apple: { kind: 'pick', n: 0 } }, 4, false), T.spin + T.hold + 200, 'a pick with nothing left to pick');
  assert.equal(R.flashMs({ apple: { kind: 'bird', n: 2 } }, 4, false), T.spin + T.hold + T.grab + T.carry + T.off);
  assert.equal(R.flashMs({ apple: { kind: 'spill', n: 3 } }, 4, false), T.spin + T.hold + T.tip + 2 * T.gap + T.roll + T.right);
  assert.equal(R.flashMs({ apple: { kind: 'spill', n: 0 } }, 4, false), T.spin + T.hold + T.tip + 200 + T.right);
  assert.equal(st.squares[0].owner, 'X');
});

test('apple: a timeout plays nothing (no spin for a player out of time): the turn is missed; online too', () => {
  const m = mini({ X: 4 });
  assert.equal(timeoutClose(m, 'X'), null);
  const st = E.newMatch(E.makeRng('ap-to'), { games: ['ttt', 'apple'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.timer = E.newTimer(30); st.lock = null;
  const r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.missed, st.turn, m.bucket.X, m.spins.X], [true, 'X', 'O', 4, 0]);
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'apple']));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(3), 'ap');
  const p = rec.state.turn;
  const t = E.applyOnlineTimeout(rec, lcg(2));
  assert.deepEqual([t.ok, t.entries, t.missed], [true, [], p]);
  assert.ok(t.rec.state.squares.every(s => s.mini.bucket.X === 0 && s.mini.bucket.O === 0), 'nothing spun');
  rec = t.rec;
  const mv = E.applyOnlineMove(rec, rec.state.turn, 0, 'spin', lcg(4));
  assert.ok(mv.ok, JSON.stringify(mv)); assert.ok(['pick', 'bird', 'spill'].includes(mv.entries[0].apple.kind), 'the move\'s entry carries the spin');
  assert.ok(mv.rec.state.squares[0].mini.spins.X + mv.rec.state.squares[0].mini.spins.O === 1, 'a spin through the record');
  assert.equal(E.applyOnlineMove(mv.rec, mv.rec.state.turn, 0, 'auto', lcg(5)).ok, false, 'no automatic move from a phone');
});

test('apple: the computer: the one move is the spin; the spins a bucket still needs fall as it fills, none once full; q is this spin\'s chance of the square', () => {
  const m = mini(), pm = E.publicMini(m), rng = lcg(9);
  const n = b => A.needs(Object.assign({}, pm, { bucket: { X: b, O: 0 } }), 'X');
  assert.equal(n(10), 0);
  assert.ok(n(0) > 5.5 && n(0) < 8, 'from empty: about 6.7 spins (' + n(0).toFixed(2) + ')');
  for (let b = 1; b <= 9; b++) assert.ok(n(b) < n(b - 1), `${b} apples: ${n(b).toFixed(2)} < ${n(b - 1).toFixed(2)}`);
  assert.ok(n(9) > 1 && n(9) < 2, 'one to go: more than one spin (a bird or a spill sends it back)');
  for (const level of ['easy', 'normal', 'hard']) {
    const b = A.best(pm, 'X', rng, {}, { level, until: null });
    assert.equal(b.move, 'spin'); assert.equal(b.q, 0);
  }
  assert.equal(A.best(Object.assign({}, pm, { bucket: { X: 8, O: 0 } }), 'X', rng, {}, { level: 'normal' }).q, 0.6, 'two to go: a 2, 3 or 4 (six segments of ten)');
  assert.equal(A.best(Object.assign({}, pm, { bucket: { X: 9, O: 0 } }), 'X', rng, {}, { level: 'normal' }).q, 0.8);
  assert.equal(E.localBest(pm, 'O', rng).move, 'spin');
  assert.equal(E.needsOf(pm, 'X'), n(0));
  // the admin's settings change the odds
  E.setTune('apple', { bird: 3, spillPct: 100 });
  const hard = E.publicMini(E.newMini('apple', E.makeRng('ap-hard')));
  E.setTune('apple', null);
  assert.ok(A.needs(hard, 'X') > n(0), 'more birds, whole spills: more spins');
});

test('apple: whole squares, computer against computer: every one ends, the winner takes about 4 to 6 spins, the first mover wins under 60%', () => {
  let first = 0, wSpins = 0;
  const N = 600;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('ap-sq' + g), m = E.newMini('apple', rng);
    let p = 'X', done = false;
    for (let k = 0; k < 400 && !done; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: k % 2 ? 'hard' : 'normal', until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok);
      if (r.outcome === 'win') { done = true; if (p === 'X') first++; wSpins += m.spins[p]; }
      else p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done, 'no end');
  }
  assert.ok(first / N < 0.6, `the first mover: ${(100 * first / N).toFixed(1)}%`);
  assert.ok(wSpins / N >= 4 && wSpins / N <= 6, `the winner's spins: ${(wSpins / N).toFixed(2)}`);
});

test('apple: Super Chaos: dealt there; both play their own bucket in one square in one round, each move in, the square settles to both; the wheel rests where the last spin stopped it', () => {
  assert.ok(E.scTypes().includes('apple'));
  const rng = E.makeRng('ap-sc'), st = E.newState(rng);
  st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
  E.seatLocal(st.setup, rng);
  assert.ok(E.startChaos(st, rng));
  const m = mini({ X: 2, O: 7 });
  st.squares = Array.from({ length: 9 }, () => ({ owner: null, mini: JSON.parse(JSON.stringify(m)), mv: { X: 0, O: 0 } }));
  E.scBegin(st, rng);
  st.sc.cpu = E.scCpu(st, land(4), { square: 0, moves: ['spin'], rng: land(4) });   // the computer (O): a 4: its bucket fills, 7 + 3
  const r = E.playMove(st, 0, 'spin', land(1));                                      // the human (X): a 3
  assert.ok(r.ok); assert.equal(st.flash.kind, 'move'); assert.equal(st.squares[0].mini.bucket.X, 5); assert.equal(st.squares[0].mini.bucket.O, 7, 'the computer\'s move is kept apart until the recap');
  st.flash = null; E.leaveSquare(st);
  const rc = E.chaosResolve(st, E.makeRng('resolve'));
  assert.ok(rc);
  assert.equal(st.squares[0].owner, 'O', 'the full bucket takes the square');
  assert.deepEqual(st.squares[0].mini.bucket, { X: 5, O: 10 }, 'both buckets as each played');
  assert.ok(st.squares[0].mini.rest > 0.4 && st.squares[0].mini.rest < 0.5, 'the wheel rests on the computer\'s 4 (segment 4 of ten)');
});
