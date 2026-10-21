'use strict';
// Echo: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Echo ===================================== */
test('echo: one 10-step pattern per square, shared by both players; the levels are its first 4, 6, 8 and 10 steps; an attempt is judged in order; a failed level plays again unchanged; beating all four wins', () => {
  const m = E.newMini('echo', lcg(2));
  assert.equal(m.base.length, 10); assert.equal(m.seqs, undefined, 'no pattern of each player\'s own');
  assert.ok(m.base.every(k => k >= 0 && k < 4));
  assert.deepEqual([0, 1, 2, 3].map(l => E.echoSeq(m, 'X', l)), [4, 6, 8, 10].map(n => m.base.slice(0, n)));
  assert.deepEqual(E.echoSeq(m, 'O', 2), E.echoSeq(m, 'X', 2), 'the same for both players');
  const s0 = E.echoSeq(m, 'X', 0);
  const wrong = s0.slice(0, 2).concat((s0[2] + 1) % 4);
  assert.deepEqual(E.applyMove(m, 'X', wrong), { ok: true, outcome: 'continue', note: 'fail' });
  assert.deepEqual([m.last.failAt, m.last.pass, m.level.X], [2, false, 0], 'wrong at the third step: no progress');
  assert.deepEqual(m.last.seq, s0, 'the attempt keeps the pattern it was at (for the replay)');
  assert.deepEqual(E.echoSeq(m, 'X', 0), s0, 'the same pattern waits for the next attempt');
  assert.equal(E.applyMove(m, 'X', s0.slice(0, 3)).note, 'fail', 'short of the end: a fail');
  assert.equal(m.last.failAt, 3);
  assert.deepEqual(E.applyMove(m, 'X', s0), { ok: true, outcome: 'continue', note: 'pass' });
  assert.equal(m.level.X, 1, 'on to the 6-step pattern');
  assert.equal(E.applyMove(m, 'X', 'auto').note, 'fail', 'a timeout: a failed attempt');
  assert.equal(m.last.len, 6);
  for (const bad of [[0, 1, 2, 3, 0, 1, 2], 'pass', 7, [-1], [4]]) assert.equal(E.applyMove(m, 'X', bad).ok, false, `refused: ${JSON.stringify(bad)}`);
  for (let l = 1; l < 4; l++) { const r = E.applyMove(m, 'X', m.base.slice(0, [4, 6, 8, 10][l])); assert.equal(r.note, 'pass'); assert.equal(r.outcome, l < 3 ? 'continue' : 'win', `pattern ${l + 1}`); }
  assert.equal(m.level.X, 4); assert.equal(m.level.O, 0);
  assert.equal(E.applyMove(m, 'X', [0]).reason, 'done');
  // a square dealt before the change keeps each player's own patterns
  const old = { type: 'echo', level: { X: 0, O: 1 }, seqs: { X: E.echoSeqs(lcg(5)), O: E.echoSeqs(lcg(6)) }, last: null };
  assert.equal(E.applyMove(old, 'O', old.seqs.O[1]).note, 'pass');
  // the computer's attempts: right as often as the length allows, and its taps come from the pattern
  const rng = lcg(9);
  for (const [level, want] of [[0, 0.95], [1, 0.85], [2, 0.7], [3, 0.55]]) {
    let pass = 0;
    for (let k = 0; k < 1500; k++) {
      const mm = E.newMini('echo', lcg(k + 1)); mm.level.O = level;
      const plan = E.localBest(E.publicMini(mm), 'O', rng), taps = E.cpuEcho(mm, 'O', plan.move, rng);
      const r = E.applyMove(mm, 'O', taps);
      assert.equal(r.ok, true);
      if (r.note === 'pass' || r.outcome === 'win') pass++;
    }
    assert.ok(Math.abs(pass / 1500 - want) < 0.05, `level ${level}: ${pass / 1500} passed (wanted ~${want})`);
  }
});
test('echo: someone else\'s attempt replays as it looked (the pattern, a beat, their taps), and the move\'s time includes it', () => {
  const A = E.echoAim({ seq: [0, 1, 2, 3, 0, 1], taps: [0, 1, 3] });
  assert.equal(A.play, 6 * E.ECHO.step); assert.equal(A.t0, A.play + E.ECHO.gap);
  assert.deepEqual([0, 1, 2].map(A.tap), [A.t0, A.t0 + E.ECHO.tap, A.t0 + 2 * E.ECHO.tap]);
  assert.equal(A.end, A.tap(2) + E.ECHO.gap, 'the result a beat after the last tap');
  const st = E.newMatch(lcg(4), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'echo'])) });
  E.playMove(st, 4, E.echoSeq(st.squares[4].mini, st.turn, 0), lcg(5));
  assert.equal(st.flash.echo.seq.length, 4);
  assert.equal(E.playMs(st.flash), E.echoAim(st.flash.echo).end + E.ECHO.result + (st.flash.kind === 'claim' ? 600 : 0));
});

/* ---------- the admin's Mini-game Settings ---------- */
test('echo: the admin\'s settings: patterns of 3, 6, 9 and 12 steps at a slower pace, and the computer\'s rates, deal a square that plays by them', () => {
  E.setTune('echo', { start: 3, add: 3, step: 600, ai1: 100, ai2: 100, ai3: 100, ai4: 100 });
  try {
    const m = E.newMini('echo', lcg(2));
    assert.equal(m.base.length, 12);
    assert.deepEqual([0, 1, 2, 3].map(l => E.echoSeq(m, 'X', l).length), [3, 6, 9, 12]);
    for (let l = 0; l < 4; l++) { const plan = E.localBest(E.publicMini(m), 'O', lcg(l)), taps = E.cpuEcho(m, 'O', plan.move, lcg(l)); assert.equal(E.applyMove(m, 'O', taps).note, 'pass', 'the computer at 100%'); }
    assert.equal(m.level.O, 4);
    const st = E.newMatch(lcg(4), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'echo'])) });
    E.playMove(st, 4, E.echoSeq(st.squares[4].mini, st.turn, 0), lcg(5));
    assert.equal(st.flash.echo.step, 600); assert.equal(E.echoAim(st.flash.echo).play, 3 * 600);
  } finally { E.setTune('echo', null); }
  assert.equal(E.newMini('echo', lcg(2)).base.length, 10);
});
