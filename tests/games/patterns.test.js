'use strict';
// Patterns: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));

/* ===================================== Patterns ===================================== */
test('patterns: 1,000 puzzles, every one with exactly one option that fits its rule and no two options alike', () => {
  const rng = E.makeRng('pat-1000'), kinds = {}, fams = {};
  let last = null, middle = 0;
  for (let k = 0; k < 1000; k++) {
    const g = E.patPuzzle(rng, last);
    assert.ok(g, 'a puzzle every time');
    last = g.puz.fam;
    const { puz, answer } = g;
    assert.equal(puz.opts.length, 4, 'four options');
    assert.equal(puz.seq.filter(x => x == null).length, 1, 'one gap');
    assert.equal(new Set(puz.opts.map(E.patKey)).size, 4, `no duplicate options: ${g.rule}`);
    assert.deepEqual(E.patFitting(puz, puz.opts), [answer], `exactly one fits: ${g.rule} ${JSON.stringify(puz)}`);
    if (puz.seq.indexOf(null) !== puz.seq.length - 1) middle++;
    kinds[g.rule.replace(' (gap)', '')] = 1; fams[puz.fam] = (fams[puz.fam] || 0) + 1;
  }
  for (const k of ['add', 'subtract', 'multiply', 'alternate', 'squares', 'fibonacci', 'two sequences', 'turn', 'sides', 'size', 'colour', 'fill', 'dots add', 'dots double', 'dots triangle', 'dots +2 -1']) assert.ok(kinds[k], `the ${k} kind comes up`);
  assert.ok(fams.num > 300 && fams.shape > 300 && fams.dots > 120, `every family often: ${JSON.stringify(fams)}`);
  assert.ok(middle > 150 && middle < 350, `missing-middle puzzles about a quarter of the time (${middle})`);
});
test('patterns: a wrong pick is crossed out for both and the puzzle stays; the right one scores and a new puzzle comes; 3 right wins', () => {
  const rng = E.makeRng('pat-rules'), m = E.newMini('patterns', rng), first = JSON.stringify(m.puz);
  const wrong = [0, 1, 2, 3].filter(k => k !== m.answer);
  let r = E.applyMove(m, 'X', wrong[0], rng);
  assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); assert.equal(r.note, 'wrong');
  assert.deepEqual(m.crossed, [wrong[0]]); assert.equal(JSON.stringify(m.puz), first, 'the same puzzle');
  assert.equal('right' in m.last, false, 'a wrong pick never carries the answer');
  assert.equal(E.applyMove(m, 'O', wrong[0], rng).reason, 'crossed', 'a crossed-out option cannot be picked again');
  r = E.applyMove(m, 'O', wrong[1], rng);
  assert.deepEqual(m.crossed, [wrong[0], wrong[1]], 'crossed out for both');
  r = E.applyMove(m, 'X', m.answer, rng);
  assert.equal(r.note, 'right'); assert.equal(m.right.X, 1); assert.deepEqual(m.crossed, []);
  assert.notEqual(JSON.stringify(m.puz), first, 'a new puzzle for the next turn');
  for (const bad of [-1, 4, 1.5, 'a', null]) assert.equal(E.applyMove(m, 'O', bad, rng).ok, false, `refused: ${bad}`);
  E.applyMove(m, 'X', m.answer, rng);
  r = E.applyMove(m, 'X', m.answer, rng);
  assert.equal(r.outcome, 'win', 'the third right answer wins');
});
test('patterns: online the answer stays on the server; a timeout is one wrong pick, never the answer', () => {
  const rng = E.makeRng('pat-secret');
  for (let k = 0; k < 200; k++) {
    const m = E.newMini('patterns', rng), hidden = JSON.parse(JSON.stringify(m));
    E.hideMini(hidden);
    assert.equal('answer' in hidden, false); assert.equal('rule' in hidden, false);
    assert.equal(E.applyMove(hidden, 'X', 0, rng).reason, 'secret', 'a phone without the answer cannot judge');
    assert.deepEqual(E.secretOf(m), { answer: m.answer, rule: m.rule });
    assert.equal(E.randomLegalMove(m, 'X', rng), 'auto');
    const r = E.applyMove(m, 'X', 'auto', rng);
    assert.equal(r.note, 'wrong'); assert.equal(m.crossed.length, 1); assert.notEqual(m.crossed[0], m.answer);
  }
  // the flash for a wrong pick: no answer in it
  const st = E.newMatch(rng, { games: only('patterns') }), i = 4, mini = st.squares[i].mini;
  E.playMove(st, i, [0, 1, 2, 3].find(k => k !== mini.answer), rng);
  assert.equal('right' in st.flash.pat, false); assert.equal(st.flash.pat.correct, false);
});
test('patterns: the computer is right about 60% of the time and never picks a crossed-out option', () => {
  const rng = E.makeRng('pat-ai');
  let right = 0, n = 0;
  for (let k = 0; k < 3000; k++) {
    const m = E.newMini('patterns', rng);
    if (k % 3) E.applyMove(m, 'O', [0, 1, 2, 3].find(j => j !== m.answer), rng);
    const b = E.localBest(E.publicMini(m, 'X'), 'X', rng);
    assert.ok(!(m.crossed || []).includes(b.move), 'never a crossed-out option');
    n++; if (b.move === m.answer) right++;
  }
  assert.ok(Math.abs(right / n - 0.6) < 0.035, `right ${(100 * right / n).toFixed(1)}%`);
});

/* ---------- the admin's Mini-game Settings ---------- */
test('patterns: the admin\'s settings: two to win, dot puzzles only with the gap in the middle, and the computer always right', () => {
  E.setTune('patterns', { goal: 2, num: 0, shape: 0, dots: 100, mid: 100, right: 100 });
  try {
    const rng = E.makeRng('pat-tune'), m = E.newMini('patterns', rng);
    assert.equal(m.puz.fam, 'dots'); assert.notEqual(m.puz.seq.indexOf(null), m.puz.seq.length - 1, 'the gap in the middle');
    assert.equal(E.applyMove(m, 'X', m.answer, rng).outcome, 'continue');
    assert.equal(m.puz.fam, 'dots');
    const b = E.localBest(E.publicMini(m), 'X', rng);
    assert.equal(b.move, m.answer, 'right every time');
    assert.equal(E.applyMove(m, 'X', m.answer, rng).outcome, 'win', 'two right wins');
  } finally { E.setTune('patterns', null); }
  assert.equal(E.newMini('patterns', E.makeRng('pat-tune')).tune, undefined);
});
